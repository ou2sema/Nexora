-- Tenancy: organizations, memberships, roles, and the RLS foundation.
-- Tables live in public (PostgREST convention); helper functions live in app (not exposed).

create schema if not exists app;

do $$
begin
  create type app.member_role as enum ('owner', 'admin', 'manager', 'viewer');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_slug_key on public.organizations (slug);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role app.member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_organization_user_key unique (organization_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships (user_id);

-- Reads the same transaction-local setting PostgREST uses, so API and database agree
-- on the caller without depending on Supabase-only helpers.
create or replace function app.current_user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

create or replace function app.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_org
      and m.user_id = app.current_user_id()
  )
$$;

create or replace function app.has_org_role(target_org uuid, allowed app.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_org
      and m.user_id = app.current_user_id()
      and m.role = any (allowed)
  )
$$;

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger organizations_touch_updated_at
before update on public.organizations
for each row execute function app.touch_updated_at();

create trigger memberships_touch_updated_at
before update on public.memberships
for each row execute function app.touch_updated_at();

-- Creation is the one operation RLS cannot express: the caller is not a member yet.
-- A definer function creates the organization and its first owner membership atomically.
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

  insert into public.organizations (name, slug)
  values (btrim(p_name), lower(btrim(p_slug)))
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  return v_org;
end
$$;

-- An organization must always keep at least one owner.
create or replace function app.protect_last_owner()
returns trigger
language plpgsql
as $$
declare
  v_remaining integer;
begin
  if tg_op = 'UPDATE' and new.role = 'owner' and new.organization_id = old.organization_id then
    return new;
  end if;

  select count(*)
  into v_remaining
  from public.memberships
  where organization_id = old.organization_id
    and role = 'owner'
    and id <> old.id;

  if v_remaining = 0 then
    raise exception 'organization_requires_owner' using errcode = '23514';
  end if;

  return coalesce(new, old);
end
$$;

create trigger memberships_protect_last_owner_on_update
before update of role, organization_id on public.memberships
for each row execute function app.protect_last_owner();

create trigger memberships_protect_last_owner_on_delete
before delete on public.memberships
for each row execute function app.protect_last_owner();

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (app.is_org_member(id));

create policy organizations_update_admin
on public.organizations
for update
to authenticated
using (app.has_org_role(id, array['owner', 'admin']::app.member_role[]))
with check (app.has_org_role(id, array['owner', 'admin']::app.member_role[]));

create policy memberships_select_member
on public.memberships
for select
to authenticated
using (app.is_org_member(organization_id));

create policy memberships_insert_admin
on public.memberships
for insert
to authenticated
with check (app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[]));

create policy memberships_update_admin
on public.memberships
for update
to authenticated
using (app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[]))
with check (app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[]));

create policy memberships_delete_admin
on public.memberships
for delete
to authenticated
using (app.has_org_role(organization_id, array['owner', 'admin']::app.member_role[]));

grant usage on schema public to authenticated;
grant usage on schema app to authenticated;

grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;

grant execute on function app.current_user_id() to authenticated;
grant execute on function app.is_org_member(uuid) to authenticated;
grant execute on function app.has_org_role(uuid, app.member_role[]) to authenticated;
grant execute on function app.create_organization(text, text) to authenticated;
