-- Platform administration: an application-level operator flag beside the per-
-- organization roles. Platform admins create organizations and manage membership
-- and invitations across organizations. Managers may invite viewers into their own
-- organization. Business data (catalog, stock, devices, orders) remains scoped to
-- ordinary membership; the platform flag only widens identity administration.

alter table public.profiles
  add column is_platform_admin boolean not null default false;

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.is_platform_admin
      from public.profiles p
      where p.id = app.current_user_id()
    ),
    false
  )
$$;

-- Seed the first deployment operator. This is a one-time bootstrap: the flag is
-- database-managed and has no HTTP write path.
update public.profiles
set is_platform_admin = true
where email = 'ou3sema@gmail.com';

-- Organization creation is an operator action. The creator becomes the first owner,
-- and may invite the first manager/viewer in the same transaction from the API.
create or replace function app.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := app.current_user_id();
  v_org uuid;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not app.is_platform_admin() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(p_name), lower(btrim(p_slug)))
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  return v_org;
end
$$;

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
  v_platform boolean := app.is_platform_admin();
  v_org_admin boolean := app.has_org_role(
    p_organization,
    array['owner', 'admin']::app.member_role[]
  );
begin
  if not (
    v_platform
    or v_org_admin
    or app.has_org_role(p_organization, array['manager']::app.member_role[])
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'invitation_role_owner' using errcode = '23514';
  end if;

  if not v_platform and not v_org_admin and p_role <> 'viewer' then
    raise exception 'manager_invites_viewers_only' using errcode = '42501';
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
  if not (
    app.is_platform_admin()
    or app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[])
  ) then
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

-- Owners are never silently demoted or removed by an organization admin. A platform
-- admin may touch owners, but the last-owner trigger still applies to every caller.
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
  v_platform boolean := app.is_platform_admin();
  v_owner boolean := app.has_org_role(p_organization, array['owner']::app.member_role[]);
begin
  if not (
    v_platform
    or app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[])
  ) then
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
    and not (v_platform or v_owner) then
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
  v_platform boolean := app.is_platform_admin();
  v_owner boolean := app.has_org_role(p_organization, array['owner']::app.member_role[]);
begin
  if not (
    v_platform
    or app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[])
  ) then
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
    and not (v_platform or v_owner) then
    raise exception 'owner_required' using errcode = '42501';
  end if;

  delete from public.memberships where id = v_member.id;
end
$$;

-- RLS: platform admins read identity rows across organizations, and may write
-- memberships directly with the same owner-hierarchy backstop as organization admins.
drop policy if exists organizations_select_member on public.organizations;
drop policy if exists organizations_update_admin on public.organizations;
drop policy if exists memberships_select_member on public.memberships;
drop policy if exists memberships_insert_admin on public.memberships;
drop policy if exists memberships_update_admin on public.memberships;
drop policy if exists memberships_delete_admin on public.memberships;
drop policy if exists profiles_select_self_or_shared on public.profiles;
drop policy if exists organization_invitations_select_admin on public.organization_invitations;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (app.is_org_member(id) or app.is_platform_admin());

create policy organizations_update_admin
on public.organizations
for update
to authenticated
using (
  app.is_platform_admin()
  or app.has_org_role(id, array['owner', 'admin']::app.member_role[])
)
with check (
  app.is_platform_admin()
  or app.has_org_role(id, array['owner', 'admin']::app.member_role[])
);

create policy memberships_select_member
on public.memberships
for select
to authenticated
using (app.is_org_member(organization_id) or app.is_platform_admin());

create policy memberships_insert_admin
on public.memberships
for insert
to authenticated
with check (
  app.is_platform_admin()
  or (
    app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[])
    and (role <> 'owner' or app.has_org_role(organization_id, array['owner']::app.member_role[]))
  )
);

create policy memberships_update_admin
on public.memberships
for update
to authenticated
using (
  app.is_platform_admin()
  or (
    app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[])
    and (role <> 'owner' or app.has_org_role(organization_id, array['owner']::app.member_role[]))
  )
)
with check (
  app.is_platform_admin()
  or (
    app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[])
    and (role <> 'owner' or app.has_org_role(organization_id, array['owner']::app.member_role[]))
  )
);

create policy memberships_delete_admin
on public.memberships
for delete
to authenticated
using (
  app.is_platform_admin()
  or (
    app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[])
    and (role <> 'owner' or app.has_org_role(organization_id, array['owner']::app.member_role[]))
  )
);

create policy profiles_select_self_or_shared
on public.profiles
for select
to authenticated
using (
  id = app.current_user_id()
  or app.shares_organization(id)
  or app.is_platform_admin()
);

create policy organization_invitations_select_admin
on public.organization_invitations
for select
to authenticated
using (
  app.is_platform_admin()
  or app.has_org_role(
    organization_id,
    array['owner', 'admin', 'manager']::app.member_role[]
  )
);

revoke execute on function app.is_platform_admin() from public;
grant execute on function app.is_platform_admin() to authenticated;
grant execute on function app.create_organization(text, text) to authenticated;
