-- Product catalog, warehouses, and storage locations. Every row is organization-scoped,
-- and every foreign key between tenant-owned rows carries organization_id so a row can
-- never point at another organization's data.

create type app.product_status as enum ('active', 'inactive', 'discontinued', 'archived');

create type app.unit_of_measure as enum (
  'unit',
  'meter',
  'kilogram',
  'liter',
  'box',
  'set'
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  parent_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_organization_id_key unique (organization_id, id),
  constraint categories_parent_org_fkey
    foreign key (organization_id, parent_id)
    references public.categories (organization_id, id)
    on delete restrict,
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);

create unique index categories_org_slug_key on public.categories (organization_id, lower(slug));
create index categories_parent_idx on public.categories (parent_id);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_organization_id_key unique (organization_id, id)
);

create unique index brands_org_name_key on public.brands (organization_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sku text not null check (btrim(sku) <> '' and char_length(sku) <= 64),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text,
  category_id uuid,
  brand_id uuid,
  manufacturer_model text,
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  internal_code text check (internal_code is null or internal_code ~ '^[A-Z0-9-]{4,32}$'),
  unit_of_measure app.unit_of_measure not null default 'unit',
  purchase_price_minor bigint check (purchase_price_minor is null or purchase_price_minor >= 0),
  sale_price_minor bigint check (sale_price_minor is null or sale_price_minor >= 0),
  reorder_threshold numeric(18, 4) not null default 0 check (reorder_threshold >= 0),
  is_serialized boolean not null default false,
  status app.product_status not null default 'active',
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_organization_id_key unique (organization_id, id),
  constraint products_category_org_fkey
    foreign key (organization_id, category_id)
    references public.categories (organization_id, id)
    on delete set null (category_id),
  constraint products_brand_org_fkey
    foreign key (organization_id, brand_id)
    references public.brands (organization_id, id)
    on delete set null (brand_id)
);

create unique index products_org_sku_key on public.products (organization_id, lower(sku));
create unique index products_org_barcode_key on public.products (organization_id, barcode)
  where barcode is not null;
create unique index products_org_internal_code_key on public.products (organization_id, internal_code)
  where internal_code is not null;
create index products_org_status_idx on public.products (organization_id, status);
create index products_category_idx on public.products (category_id);
create index products_brand_idx on public.products (brand_id);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9-]{2,16}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address_line text,
  city text,
  country_code char(2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouses_organization_id_key unique (organization_id, id)
);

create unique index warehouses_org_code_key on public.warehouses (organization_id, lower(code));

create table public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null,
  code text not null check (code ~ '^[A-Z0-9-]{1,24}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storage_locations_organization_id_key unique (organization_id, id),
  constraint storage_locations_warehouse_org_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete cascade
);

create unique index storage_locations_warehouse_code_key
  on public.storage_locations (warehouse_id, lower(code));
create index storage_locations_org_idx on public.storage_locations (organization_id);

create trigger categories_touch_updated_at
before update on public.categories
for each row execute function app.touch_updated_at();

create trigger brands_touch_updated_at
before update on public.brands
for each row execute function app.touch_updated_at();

create trigger products_touch_updated_at
before update on public.products
for each row execute function app.touch_updated_at();

create trigger warehouses_touch_updated_at
before update on public.warehouses
for each row execute function app.touch_updated_at();

create trigger storage_locations_touch_updated_at
before update on public.storage_locations
for each row execute function app.touch_updated_at();

-- A category may not become its own ancestor.
create or replace function app.prevent_category_cycle()
returns trigger
language plpgsql
as $$
declare
  v_parent uuid := new.parent_id;
  v_depth integer := 0;
begin
  while v_parent is not null loop
    v_depth := v_depth + 1;

    if v_depth > 100 or v_parent = new.id then
      raise exception 'category_cycle' using errcode = '23514';
    end if;

    select parent_id into v_parent
    from public.categories
    where id = v_parent;
  end loop;

  return new;
end
$$;

create trigger categories_prevent_cycle
before insert or update of parent_id on public.categories
for each row execute function app.prevent_category_cycle();

alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.warehouses enable row level security;
alter table public.storage_locations enable row level security;

create policy categories_select_member on public.categories
for select to authenticated
using (app.is_org_member(organization_id));

create policy categories_write_manager on public.categories
for all to authenticated
using (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]))
with check (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]));

create policy brands_select_member on public.brands
for select to authenticated
using (app.is_org_member(organization_id));

create policy brands_write_manager on public.brands
for all to authenticated
using (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]))
with check (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]));

create policy products_select_member on public.products
for select to authenticated
using (app.is_org_member(organization_id));

create policy products_write_manager on public.products
for all to authenticated
using (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]))
with check (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]));

create policy warehouses_select_member on public.warehouses
for select to authenticated
using (app.is_org_member(organization_id));

create policy warehouses_write_manager on public.warehouses
for all to authenticated
using (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]))
with check (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]));

create policy storage_locations_select_member on public.storage_locations
for select to authenticated
using (app.is_org_member(organization_id));

create policy storage_locations_write_manager on public.storage_locations
for all to authenticated
using (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]))
with check (app.has_org_role(organization_id, array['owner', 'admin', 'manager']::app.member_role[]));

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.brands to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.warehouses to authenticated;
grant select, insert, update, delete on public.storage_locations to authenticated;
