-- Team access: readable member identities, email invitations accepted by the
-- signed-in user, and role-based member management. The API stays on JWKS;
-- no service-role key is involved. Every write is a definer function guarded by
-- the caller's own membership, and RLS still governs direct reads.

-- auth.users is not readable by the authenticated role, so the team screen needs
-- a narrow projection of the identity fields it displays. The trigger keeps it
-- current; the backfill covers accounts that predate this migration.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function app.touch_updated_at();

create or replace function app.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(nullif(btrim(new.email), '')))
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now()
    where public.profiles.email is distinct from excluded.email;

  return new;
end
$$;

create trigger auth_users_sync_profile
after insert or update of email on auth.users
for each row execute function app.sync_profile_email();

insert into public.profiles (id, email)
select id, lower(nullif(btrim(email), ''))
from auth.users
on conflict (id) do nothing;

create or replace function app.current_user_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(
    nullif(btrim(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'), '')
  )
$$;

-- Emails are visible to people who already share an organization, never beyond.
create or replace function app.shares_organization(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = app.current_user_id()
      and theirs.user_id = target_user
  )
$$;

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role app.member_role not null,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitations_email_normalized check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint organization_invitations_not_owner check (role <> 'owner'),
  constraint organization_invitations_single_outcome check (accepted_at is null or revoked_at is null)
);

create index organization_invitations_org_created_idx
  on public.organization_invitations (organization_id, created_at desc);

-- One live invitation per email per organization. Expired rows are revoked by
-- the invitation RPC before a reissue, so they never block a fresh invite.
create unique index organization_invitations_pending_email_key
  on public.organization_invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

create index organization_invitations_email_idx
  on public.organization_invitations (email)
  where accepted_at is null and revoked_at is null;

create trigger organization_invitations_touch_updated_at
before update on public.organization_invitations
for each row execute function app.touch_updated_at();

create or replace function app.create_organization_invitation(
  p_organization uuid,
  p_email text,
  p_role app.member_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
  v_invitation uuid;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'invitation_role_owner' using errcode = '23514';
  end if;

  if char_length(v_email) < 3
    or char_length(v_email) > 254
    or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_invitation_email' using errcode = '22023';
  end if;

  select u.id
  into v_user
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_user is not null and exists (
    select 1
    from public.memberships m
    where m.organization_id = p_organization
      and m.user_id = v_user
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  -- A stale invitation should not stop a fresh one; retire it first.
  update public.organization_invitations i
  set revoked_at = now()
  where i.organization_id = p_organization
    and i.email = v_email
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at <= now();

  if exists (
    select 1
    from public.organization_invitations i
    where i.organization_id = p_organization
      and i.email = v_email
      and i.accepted_at is null
      and i.revoked_at is null
  ) then
    raise exception 'invitation_already_pending' using errcode = '23505';
  end if;

  begin
    insert into public.organization_invitations (organization_id, email, role, invited_by)
    values (p_organization, v_email, p_role, v_actor)
    returning id into v_invitation;
  exception
    when unique_violation then
      raise exception 'invitation_already_pending' using errcode = '23505';
  end;

  return v_invitation;
end
$$;

create or replace function app.revoke_organization_invitation(
  p_organization uuid,
  p_invitation uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.organization_invitations%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select i.*
  into v_invitation
  from public.organization_invitations i
  where i.id = p_invitation
    and i.organization_id = p_organization
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;

  if v_invitation.accepted_at is not null or v_invitation.revoked_at is not null then
    raise exception 'invitation_not_pending' using errcode = '23514';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = '23514';
  end if;

  update public.organization_invitations
  set revoked_at = now()
  where id = p_invitation;
end
$$;

-- Owners are never silently demoted or removed by an admin: touching an owner
-- requires being an owner, and the existing last-owner trigger still applies.
create or replace function app.change_member_role(
  p_organization uuid,
  p_user uuid,
  p_role app.member_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.memberships%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select m.*
  into v_member
  from public.memberships m
  where m.organization_id = p_organization
    and m.user_id = p_user
  for update;

  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if (v_member.role = 'owner' or p_role = 'owner')
    and not app.has_org_role(p_organization, array['owner']::app.member_role[]) then
    raise exception 'owner_required' using errcode = '42501';
  end if;

  if v_member.role = p_role then
    return;
  end if;

  update public.memberships
  set role = p_role
  where id = v_member.id;
end
$$;

create or replace function app.remove_organization_member(
  p_organization uuid,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.memberships%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select m.*
  into v_member
  from public.memberships m
  where m.organization_id = p_organization
    and m.user_id = p_user
  for update;

  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if v_member.role = 'owner'
    and not app.has_org_role(p_organization, array['owner']::app.member_role[]) then
    raise exception 'owner_required' using errcode = '42501';
  end if;

  delete from public.memberships where id = v_member.id;
end
$$;

-- Acceptance matches the invitation to the email in the caller's token, so an
-- invitation cannot be redeemed by a different signed-in account.
create or replace function app.accept_invitation(p_invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := app.current_user_id();
  v_email text := app.current_user_email();
  v_invitation public.organization_invitations%rowtype;
  v_existing public.memberships%rowtype;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if v_email is null then
    raise exception 'invitation_email_required' using errcode = '42501';
  end if;

  select i.*
  into v_invitation
  from public.organization_invitations i
  where i.id = p_invitation
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;

  if v_invitation.email <> v_email then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;

  select m.*
  into v_existing
  from public.memberships m
  where m.organization_id = v_invitation.organization_id
    and m.user_id = v_user;

  if v_invitation.accepted_at is not null then
    if found then
      return v_invitation.organization_id;
    end if;

    raise exception 'invitation_not_pending' using errcode = '23514';
  end if;

  if v_invitation.revoked_at is not null then
    raise exception 'invitation_not_pending' using errcode = '23514';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = '23514';
  end if;

  if not found then
    insert into public.memberships (organization_id, user_id, role)
    values (v_invitation.organization_id, v_user, v_invitation.role);
  end if;

  update public.organization_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.organization_id;
end
$$;

-- Definition functions bypass RLS, so this returns only rows that match the
-- caller's own verified email.
create or replace function app.my_pending_invitations()
returns table (
  invitation_id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  role app.member_role,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, o.id, o.name, o.slug, i.role, i.expires_at
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.email = app.current_user_email()
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at desc
$$;

alter table public.profiles enable row level security;
alter table public.organization_invitations enable row level security;

create policy profiles_select_self_or_shared
on public.profiles
for select
to authenticated
using (id = app.current_user_id() or app.shares_organization(id));

create policy organization_invitations_select_admin
on public.organization_invitations
for select
to authenticated
using (app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[]));

grant select on public.profiles to authenticated;
grant select on public.organization_invitations to authenticated;

-- Direct membership writes stay available to RLS, but with the same owner rules
-- the RPCs enforce. Without this, an admin could sidestep the API via PostgREST.
drop policy if exists memberships_insert_admin on public.memberships;
drop policy if exists memberships_update_admin on public.memberships;
drop policy if exists memberships_delete_admin on public.memberships;

create policy memberships_insert_admin
on public.memberships
for insert
to authenticated
with check (
  app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[])
  and (role <> 'owner' or app.has_org_role(organization_id, array['owner']::app.member_role[]))
);

create policy memberships_update_admin
on public.memberships
for update
to authenticated
using (
  app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[])
  and (role <> 'owner' or app.has_org_role(organization_id, array['owner']::app.member_role[]))
)
with check (
  app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[])
  and (role <> 'owner' or app.has_org_role(organization_id, array['owner']::app.member_role[]))
);

create policy memberships_delete_admin
on public.memberships
for delete
to authenticated
using (
  app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[])
  and (role <> 'owner' or app.has_org_role(organization_id, array['owner']::app.member_role[]))
);

grant execute on function app.current_user_email() to authenticated;
grant execute on function app.shares_organization(uuid) to authenticated;
grant execute on function app.my_pending_invitations() to authenticated;

revoke execute on function app.sync_profile_email() from public;
revoke execute on function app.create_organization_invitation(uuid, text, app.member_role) from public;
revoke execute on function app.revoke_organization_invitation(uuid, uuid) from public;
revoke execute on function app.change_member_role(uuid, uuid, app.member_role) from public;
revoke execute on function app.remove_organization_member(uuid, uuid) from public;
revoke execute on function app.accept_invitation(uuid) from public;

grant execute on function app.create_organization_invitation(uuid, text, app.member_role) to authenticated;
grant execute on function app.revoke_organization_invitation(uuid, uuid) to authenticated;
grant execute on function app.change_member_role(uuid, uuid, app.member_role) to authenticated;
grant execute on function app.remove_organization_member(uuid, uuid) to authenticated;
grant execute on function app.accept_invitation(uuid) to authenticated;
