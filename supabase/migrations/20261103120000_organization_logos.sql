-- Organization logos: one small brand image per organization, shown on the signed-in dashboard and
-- embedded in the header of every document the server renders. The bytes are tenant data, so they
-- live behind the same row security as every other tenant table rather than in a storage bucket the
-- API would have to reach over HTTPS on each render; writes go through a definer function gated to
-- the catalog-writing roles, exactly like app.save_customer. See ADR-0018.

create table public.organization_logos (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  -- Only the formats pdf-lib can embed. SVG is excluded on purpose: it is markup, and an image
  -- served back into the app's own origin is an inline XSS carrier.
  mime text not null check (mime in ('image/png', 'image/jpeg')),
  bytes bytea not null check (octet_length(bytes) between 8 and 409600),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger organization_logos_touch_updated_at
before update on public.organization_logos
for each row execute function app.touch_updated_at();

alter table public.organization_logos enable row level security;

-- Reading is member-tier: a viewer who can open an invoice must see the mark printed on it. Writing
-- is not granted here at all — it happens inside the definer functions below.
create policy organization_logos_select_member on public.organization_logos
for select to authenticated
using (app.is_org_member(organization_id));

grant select on public.organization_logos to authenticated;

create or replace function app.set_organization_logo(
  p_organization uuid,
  p_mime text,
  p_bytes bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_logo public.organization_logos%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- The check constraint catches these too; raising here keeps the message the API maps stable
  -- instead of leaking a constraint name.
  if p_mime is null or p_mime not in ('image/png', 'image/jpeg') then
    raise exception 'invalid_logo_mime' using errcode = '22023';
  end if;

  if p_bytes is null or octet_length(p_bytes) not between 8 and 409600 then
    raise exception 'invalid_logo_bytes' using errcode = '22023';
  end if;

  insert into public.organization_logos (organization_id, mime, bytes, updated_by)
  values (p_organization, p_mime, p_bytes, app.current_user_id())
  on conflict (organization_id) do update
  set mime = excluded.mime,
      bytes = excluded.bytes,
      updated_by = excluded.updated_by
  returning * into v_logo;

  return jsonb_build_object(
    'organizationId', v_logo.organization_id,
    'mime', v_logo.mime,
    'byteLength', octet_length(v_logo.bytes),
    'updatedAt', v_logo.updated_at
  );
end
$$;

create or replace function app.clear_organization_logo(p_organization uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.organization_logos
  where organization_id = p_organization;

  return found;
end
$$;

revoke execute on function app.set_organization_logo(uuid, text, bytea) from public;
revoke execute on function app.clear_organization_logo(uuid) from public;

grant execute on function app.set_organization_logo(uuid, text, bytea) to authenticated;
grant execute on function app.clear_organization_logo(uuid) to authenticated;
