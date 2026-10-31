-- Operator audit trail: every identity-management action performed by a platform
-- admin leaves a row here. Organization owners/admins and managers keep their own
-- (narrower) powers and are intentionally not logged, so the table answers "what
-- did the operator do across tenants" rather than duplicating organization history.

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (char_length(action) between 1 and 80),
  organization_id uuid references public.organizations (id) on delete set null,
  target_user_id uuid,
  target_email text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_events_created_at_idx
  on public.admin_audit_events (created_at desc);

create index admin_audit_events_organization_idx
  on public.admin_audit_events (organization_id, created_at desc);

-- Rows are written by the RPCs below and read by operators only. Non-platform
-- calls are a silent no-op so organization-level administration keeps working
-- without producing cross-tenant noise.
create or replace function app.log_admin_action(
  p_action text,
  p_organization uuid,
  p_target_user uuid,
  p_target_email text,
  p_detail jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    return;
  end if;

  insert into public.admin_audit_events (
    actor_id,
    action,
    organization_id,
    target_user_id,
    target_email,
    detail
  )
  values (
    app.current_user_id(),
    p_action,
    p_organization,
    p_target_user,
    p_target_email,
    coalesce(p_detail, '{}'::jsonb)
  );
end
$$;

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

  perform app.log_admin_action(
    'organization_created',
    v_org,
    null,
    null,
    jsonb_build_object(
      'name', btrim(p_name),
      'slug', lower(btrim(p_slug))
    )
  );

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

  perform app.log_admin_action(
    'invitation_created',
    p_organization,
    v_user,
    v_email,
    jsonb_build_object('role', p_role::text)
  );

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

  perform app.log_admin_action(
    'invitation_revoked',
    p_organization,
    null,
    v_invitation.email,
    jsonb_build_object('role', v_invitation.role::text)
  );
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

  perform app.log_admin_action(
    'member_role_changed',
    p_organization,
    p_user,
    (select p.email from public.profiles p where p.id = p_user),
    jsonb_build_object(
      'from', v_member.role::text,
      'to', p_role::text
    )
  );
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

  perform app.log_admin_action(
    'member_removed',
    p_organization,
    p_user,
    (select p.email from public.profiles p where p.id = p_user),
    jsonb_build_object('role', v_member.role::text)
  );
end
$$;

alter table public.admin_audit_events enable row level security;

create policy admin_audit_events_select_platform
on public.admin_audit_events
for select
to authenticated
using (app.is_platform_admin());

revoke all on public.admin_audit_events from authenticated;
grant select on public.admin_audit_events to authenticated;

revoke execute on function app.log_admin_action(text, uuid, uuid, text, jsonb) from public;
