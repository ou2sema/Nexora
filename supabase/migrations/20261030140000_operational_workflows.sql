-- Operational workflows: suppliers, purchase orders (inbound), and outgoing
-- orders (outbound). Documents are read-only to application roles; every
-- lifecycle transition is one SECURITY DEFINER transaction that claims a single
-- idempotency key and changes stock only through the ledger helpers below, so
-- the negative-stock and reservation protections of Phase 2/3 still hold.

create type app.purchase_order_status as enum (
  'draft',
  'ordered',
  'partially_received',
  'received',
  'cancelled'
);

create type app.sales_order_status as enum ('draft', 'confirmed', 'fulfilled', 'cancelled');

create type app.document_kind as enum ('purchase_order', 'sales_order');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  contact_name text,
  email text check (email is null or position('@' in email) > 1),
  phone text,
  address_line text,
  city text,
  country_code char(2),
  tax_id text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_organization_id_key unique (organization_id, id)
);

create unique index suppliers_org_name_key on public.suppliers (organization_id, lower(name));
create index suppliers_org_active_idx on public.suppliers (organization_id, is_active);

create trigger suppliers_touch_updated_at
before update on public.suppliers
for each row execute function app.touch_updated_at();

-- Per-organization, per-year counters behind document numbers. No application
-- role can read or write this table; only the definer numbering function does.
create table public.document_sequences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind app.document_kind not null,
  year integer not null check (year between 2000 and 9999),
  last_value bigint not null check (last_value > 0),
  primary key (organization_id, kind, year)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number text not null,
  supplier_id uuid not null,
  warehouse_id uuid not null,
  location_id uuid not null,
  status app.purchase_order_status not null default 'draft',
  reference text,
  notes text,
  expected_on date,
  ordered_at timestamptz,
  received_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_organization_id_key unique (organization_id, id),
  constraint purchase_orders_number_key unique (organization_id, number),
  constraint purchase_orders_supplier_fkey
    foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id)
    on delete restrict,
  constraint purchase_orders_warehouse_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint purchase_orders_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict,
  constraint purchase_orders_cancelled_check check ((status = 'cancelled') = (cancelled_at is not null))
);

create index purchase_orders_org_status_idx
  on public.purchase_orders (organization_id, status, created_at desc);
create index purchase_orders_supplier_idx on public.purchase_orders (organization_id, supplier_id);

create trigger purchase_orders_touch_updated_at
before update on public.purchase_orders
for each row execute function app.touch_updated_at();

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  purchase_order_id uuid not null,
  product_id uuid not null,
  quantity_ordered numeric(18, 4) not null check (quantity_ordered > 0),
  quantity_received numeric(18, 4) not null default 0 check (quantity_received >= 0),
  unit_cost_minor bigint check (unit_cost_minor is null or unit_cost_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_order_lines_organization_id_key unique (organization_id, id),
  constraint purchase_order_lines_order_product_key unique (purchase_order_id, product_id),
  constraint purchase_order_lines_order_fkey
    foreign key (organization_id, purchase_order_id)
    references public.purchase_orders (organization_id, id)
    on delete cascade,
  constraint purchase_order_lines_product_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict
);

create index purchase_order_lines_order_idx
  on public.purchase_order_lines (organization_id, purchase_order_id);

create trigger purchase_order_lines_touch_updated_at
before update on public.purchase_order_lines
for each row execute function app.touch_updated_at();

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number text not null,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 160),
  customer_email text check (customer_email is null or position('@' in customer_email) > 1),
  customer_phone text,
  warehouse_id uuid not null,
  location_id uuid not null,
  status app.sales_order_status not null default 'draft',
  reference text,
  notes text,
  confirmed_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_orders_organization_id_key unique (organization_id, id),
  constraint sales_orders_number_key unique (organization_id, number),
  constraint sales_orders_warehouse_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint sales_orders_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict,
  constraint sales_orders_cancelled_check check ((status = 'cancelled') = (cancelled_at is not null))
);

create index sales_orders_org_status_idx
  on public.sales_orders (organization_id, status, created_at desc);

create trigger sales_orders_touch_updated_at
before update on public.sales_orders
for each row execute function app.touch_updated_at();

create table public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sales_order_id uuid not null,
  product_id uuid not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  unit_price_minor bigint check (unit_price_minor is null or unit_price_minor >= 0),
  reservation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_order_lines_organization_id_key unique (organization_id, id),
  constraint sales_order_lines_order_product_key unique (sales_order_id, product_id),
  constraint sales_order_lines_order_fkey
    foreign key (organization_id, sales_order_id)
    references public.sales_orders (organization_id, id)
    on delete cascade,
  constraint sales_order_lines_product_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict
);

create index sales_order_lines_order_idx
  on public.sales_order_lines (organization_id, sales_order_id);

create trigger sales_order_lines_touch_updated_at
before update on public.sales_order_lines
for each row execute function app.touch_updated_at();

-- Stock operations vocabulary for the order workflows.
alter table public.stock_operations
  drop constraint stock_operations_operation_check;

alter table public.stock_operations
  add constraint stock_operations_operation_check check (
    operation in (
      'receipt',
      'issue',
      'adjustment',
      'transfer',
      'reservation',
      'reservation_release',
      'device_registration',
      'device_status',
      'device_move',
      'stock_count',
      'purchase_order_create',
      'purchase_order_order',
      'purchase_order_receive',
      'purchase_order_cancel',
      'sales_order_create',
      'sales_order_confirm',
      'sales_order_fulfil',
      'sales_order_cancel'
    )
  );

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_lines enable row level security;
alter table public.document_sequences enable row level security;

create policy suppliers_select_member on public.suppliers
for select to authenticated
using (app.is_org_member(organization_id));

create policy purchase_orders_select_member on public.purchase_orders
for select to authenticated
using (app.is_org_member(organization_id));

create policy purchase_order_lines_select_member on public.purchase_order_lines
for select to authenticated
using (app.is_org_member(organization_id));

create policy sales_orders_select_member on public.sales_orders
for select to authenticated
using (app.is_org_member(organization_id));

create policy sales_order_lines_select_member on public.sales_order_lines
for select to authenticated
using (app.is_org_member(organization_id));

grant select on public.suppliers to authenticated;
grant select on public.purchase_orders to authenticated;
grant select on public.purchase_order_lines to authenticated;
grant select on public.sales_orders to authenticated;
grant select on public.sales_order_lines to authenticated;

-- Saves a supplier. Existing suppliers are deactivated instead of deleted so
-- purchase history keeps its reference.
create or replace function app.save_supplier(
  p_organization uuid,
  p_supplier uuid,
  p_name text,
  p_contact_name text default null,
  p_email text default null,
  p_phone text default null,
  p_address_line text default null,
  p_city text default null,
  p_country_code text default null,
  p_tax_id text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier public.suppliers%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 160 then
    raise exception 'invalid_supplier_name' using errcode = '22023';
  end if;

  if p_country_code is not null and btrim(p_country_code) <> ''
    and char_length(btrim(p_country_code)) <> 2 then
    raise exception 'invalid_country_code' using errcode = '22023';
  end if;

  if p_supplier is null then
    insert into public.suppliers (
      organization_id,
      name,
      contact_name,
      email,
      phone,
      address_line,
      city,
      country_code,
      tax_id,
      notes
    )
    values (
      p_organization,
      btrim(p_name),
      nullif(btrim(coalesce(p_contact_name, '')), ''),
      nullif(btrim(coalesce(p_email, '')), ''),
      nullif(btrim(coalesce(p_phone, '')), ''),
      nullif(btrim(coalesce(p_address_line, '')), ''),
      nullif(btrim(coalesce(p_city, '')), ''),
      nullif(upper(btrim(coalesce(p_country_code, ''))), ''),
      nullif(btrim(coalesce(p_tax_id, '')), ''),
      nullif(btrim(coalesce(p_notes, '')), '')
    )
    returning * into v_supplier;
  else
    update public.suppliers
    set name = btrim(p_name),
        contact_name = nullif(btrim(coalesce(p_contact_name, '')), ''),
        email = nullif(btrim(coalesce(p_email, '')), ''),
        phone = nullif(btrim(coalesce(p_phone, '')), ''),
        address_line = nullif(btrim(coalesce(p_address_line, '')), ''),
        city = nullif(btrim(coalesce(p_city, '')), ''),
        country_code = nullif(upper(btrim(coalesce(p_country_code, ''))), ''),
        tax_id = nullif(btrim(coalesce(p_tax_id, '')), ''),
        notes = nullif(btrim(coalesce(p_notes, '')), '')
    where id = p_supplier
      and organization_id = p_organization
    returning * into v_supplier;

    if not found then
      raise exception 'supplier_not_found' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object(
    'supplierId', v_supplier.id,
    'name', v_supplier.name,
    'isActive', v_supplier.is_active
  );
exception
  when unique_violation then
    raise exception 'supplier_name_conflict' using errcode = '23505';
end
$$;

create or replace function app.set_supplier_active(
  p_organization uuid,
  p_supplier uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier public.suppliers%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.suppliers
  set is_active = p_active
  where id = p_supplier
    and organization_id = p_organization
  returning * into v_supplier;

  if not found then
    raise exception 'supplier_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'supplierId', v_supplier.id,
    'name', v_supplier.name,
    'isActive', v_supplier.is_active
  );
end
$$;

-- Reserves the next document number for the current year. The upsert locks the
-- counter row, so concurrent creates are serialized and cannot share a number.
create or replace function app.next_document_number(
  p_organization uuid,
  p_kind app.document_kind
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_value bigint;
  v_prefix text;
begin
  insert into public.document_sequences (organization_id, kind, year, last_value)
  values (p_organization, p_kind, v_year, 1)
  on conflict (organization_id, kind, year) do update
    set last_value = public.document_sequences.last_value + 1
  returning last_value into v_value;

  v_prefix := case p_kind when 'purchase_order' then 'PO' else 'SO' end;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_value::text, 4, '0');
end
$$;

-- Ledger primitives for order transitions. They mirror app.post_stock_movement
-- and app.reserve_stock, but claim no idempotency key: the calling document
-- transition claims exactly one key for the whole document. Execute is revoked
-- from application roles, so they cannot be used to bypass the public postings.
create or replace function app.operations_apply_stock(
  p_organization uuid,
  p_product uuid,
  p_warehouse uuid,
  p_location uuid,
  p_type app.stock_movement_type,
  p_quantity numeric,
  p_reference_type app.stock_reference_type,
  p_reference_id uuid,
  p_reservation_id uuid,
  p_reason text default null,
  p_correlation_id text default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_delta numeric;
  v_on_hand numeric;
  v_reserved numeric;
  v_available numeric;
  v_new_on_hand numeric;
  v_reservation public.stock_reservations%rowtype;
begin
  if p_type not in ('receipt', 'issue') then
    raise exception 'use_public_posting_function' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 4) then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  if p_reservation_id is not null and p_type <> 'issue' then
    raise exception 'reservation_requires_issue' using errcode = '22023';
  end if;

  v_delta := case p_type when 'receipt' then p_quantity else -p_quantity end;

  v_on_hand := app.lock_stock_balance(p_organization, p_product, p_warehouse, p_location);

  if p_reservation_id is not null then
    select r.*
    into v_reservation
    from public.stock_reservations r
    where r.id = p_reservation_id
      and r.organization_id = p_organization
    for update;

    if not found then
      raise exception 'reservation_not_found' using errcode = 'P0002';
    end if;

    if v_reservation.status <> 'active' then
      raise exception 'reservation_not_active' using errcode = '23514';
    end if;

    if v_reservation.product_id <> p_product
      or v_reservation.warehouse_id <> p_warehouse
      or v_reservation.location_id <> p_location
      or v_reservation.quantity <> p_quantity then
      raise exception 'reservation_mismatch' using errcode = '23514';
    end if;
  end if;

  v_reserved := app.active_reserved(
    p_organization,
    p_product,
    p_warehouse,
    p_location,
    p_reservation_id
  );
  v_available := v_on_hand - v_reserved;

  if v_on_hand + v_delta < 0 then
    raise exception 'insufficient_stock' using errcode = '23514';
  end if;

  if v_available + v_delta < 0 then
    raise exception 'stock_reserved' using errcode = '23514';
  end if;

  if p_reservation_id is not null then
    update public.stock_reservations
    set status = 'fulfilled',
        released_at = now(),
        released_by = v_actor
    where id = p_reservation_id;
  end if;

  update public.stock_balances
  set on_hand = on_hand + v_delta,
      updated_at = now()
  where organization_id = p_organization
    and product_id = p_product
    and warehouse_id = p_warehouse
    and location_id = p_location
  returning on_hand into v_new_on_hand;

  insert into public.stock_movements (
    organization_id,
    product_id,
    warehouse_id,
    location_id,
    movement_type,
    quantity_delta,
    on_hand_after,
    reason,
    reference_type,
    reference_id,
    reservation_id,
    actor_id,
    correlation_id
  )
  values (
    p_organization,
    p_product,
    p_warehouse,
    p_location,
    p_type,
    v_delta,
    v_new_on_hand,
    nullif(btrim(coalesce(p_reason, '')), ''),
    p_reference_type,
    p_reference_id,
    p_reservation_id,
    v_actor,
    p_correlation_id
  );

  return v_new_on_hand;
end
$$;

create or replace function app.operations_apply_reservation(
  p_organization uuid,
  p_product uuid,
  p_warehouse uuid,
  p_location uuid,
  p_quantity numeric,
  p_reference_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_on_hand numeric;
  v_reserved numeric;
  v_reservation_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 4) then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  v_on_hand := app.lock_stock_balance(p_organization, p_product, p_warehouse, p_location);
  v_reserved := app.active_reserved(p_organization, p_product, p_warehouse, p_location);

  if v_on_hand - v_reserved < p_quantity then
    raise exception 'insufficient_stock' using errcode = '23514';
  end if;

  insert into public.stock_reservations (
    organization_id,
    product_id,
    warehouse_id,
    location_id,
    quantity,
    reference_type,
    reference_id,
    created_by
  )
  values (
    p_organization,
    p_product,
    p_warehouse,
    p_location,
    p_quantity,
    'outgoing_order',
    p_reference_id,
    v_actor
  )
  returning id into v_reservation_id;

  return v_reservation_id;
end
$$;

create or replace function app.create_purchase_order(
  p_organization uuid,
  p_supplier uuid,
  p_warehouse uuid,
  p_location uuid,
  p_lines jsonb,
  p_idempotency_key text,
  p_fingerprint text,
  p_expected_on date default null,
  p_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_operation_id uuid;
  v_existing jsonb;
  v_duplicate boolean;
  v_order public.purchase_orders%rowtype;
  v_line_count integer;
  v_total_quantity numeric;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'purchase_order_create',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'order_requires_lines' using errcode = '22023';
  end if;

  if jsonb_array_length(p_lines) > 100 then
    raise exception 'order_too_many_lines' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) item
    where jsonb_typeof(item) <> 'object'
      or (item->>'productId') is null
      or (item->>'productId') !~ '^[0-9a-fA-F-]{36}$'
      or (item->>'quantity') is null
      or (item->>'quantity') !~ '^[0-9]+(\.[0-9]{1,4})?$'
      or case
           when (item->>'quantity') ~ '^[0-9]+(\.[0-9]{1,4})?$' then (item->>'quantity')::numeric
           else null
         end <= 0
      or (
        item ? 'unitCostMinor'
        and item->>'unitCostMinor' is not null
        and (item->>'unitCostMinor') !~ '^[0-9]{1,15}$'
      )
  ) then
    raise exception 'order_line_invalid' using errcode = '22023';
  end if;

  if (
    select count(distinct item->>'productId')
    from jsonb_array_elements(p_lines) item
  ) <> jsonb_array_length(p_lines) then
    raise exception 'duplicate_order_line' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.suppliers s
    where s.id = p_supplier
      and s.organization_id = p_organization
  ) then
    raise exception 'supplier_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.suppliers s
    where s.id = p_supplier
      and s.organization_id = p_organization
      and s.is_active
  ) then
    raise exception 'supplier_inactive' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.warehouses w
    where w.id = p_warehouse
      and w.organization_id = p_organization
  ) then
    raise exception 'warehouse_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.storage_locations l
    where l.id = p_location
      and l.organization_id = p_organization
      and l.warehouse_id = p_warehouse
  ) then
    raise exception 'location_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) item
    where not exists (
      select 1
      from public.products p
      where p.id = (item->>'productId')::uuid
        and p.organization_id = p_organization
    )
  ) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  insert into public.purchase_orders (
    organization_id,
    number,
    supplier_id,
    warehouse_id,
    location_id,
    status,
    reference,
    notes,
    expected_on,
    created_by
  )
  values (
    p_organization,
    app.next_document_number(p_organization, 'purchase_order'),
    p_supplier,
    p_warehouse,
    p_location,
    'draft',
    nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_expected_on,
    v_actor
  )
  returning * into v_order;

  insert into public.purchase_order_lines (
    organization_id,
    purchase_order_id,
    product_id,
    quantity_ordered,
    unit_cost_minor
  )
  select
    p_organization,
    v_order.id,
    (item->>'productId')::uuid,
    (item->>'quantity')::numeric,
    (item->>'unitCostMinor')::bigint
  from jsonb_array_elements(p_lines) item;

  select count(*), sum(l.quantity_ordered)
  into v_line_count, v_total_quantity
  from public.purchase_order_lines l
  where l.organization_id = p_organization
    and l.purchase_order_id = v_order.id;

  v_existing := jsonb_build_object(
    'orderId', v_order.id,
    'number', v_order.number,
    'status', v_order.status,
    'lineCount', v_line_count,
    'totalQuantity', v_total_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.order_purchase_order(
  p_organization uuid,
  p_order uuid,
  p_idempotency_key text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation_id uuid;
  v_existing jsonb;
  v_duplicate boolean;
  v_order public.purchase_orders%rowtype;
  v_line_count integer;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'purchase_order_order',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select o.*
  into v_order
  from public.purchase_orders o
  where o.id = p_order
    and o.organization_id = p_organization
  for update;

  if not found then
    raise exception 'purchase_order_not_found' using errcode = 'P0002';
  end if;

  if v_order.status <> 'draft' then
    raise exception 'purchase_order_not_draft' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.suppliers s
    where s.id = v_order.supplier_id
      and s.organization_id = p_organization
      and s.is_active
  ) then
    raise exception 'supplier_inactive' using errcode = '23514';
  end if;

  select count(*)
  into v_line_count
  from public.purchase_order_lines l
  where l.organization_id = p_organization
    and l.purchase_order_id = p_order;

  if v_line_count = 0 then
    raise exception 'order_requires_lines' using errcode = '23514';
  end if;

  update public.purchase_orders
  set status = 'ordered',
      ordered_at = now()
  where id = p_order;

  v_existing := jsonb_build_object(
    'orderId', p_order,
    'number', v_order.number,
    'status', 'ordered',
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

-- Receives units against a purchase order. Non-serialized lines post a ledger
-- receipt; serialized lines register one device per received unit at the
-- order's destination and post no quantity movement.
create or replace function app.receive_purchase_order(
  p_organization uuid,
  p_order uuid,
  p_lines jsonb,
  p_idempotency_key text,
  p_fingerprint text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_operation_id uuid;
  v_existing jsonb;
  v_duplicate boolean;
  v_order public.purchase_orders%rowtype;
  v_item record;
  v_serial record;
  v_device_id uuid;
  v_status app.purchase_order_status;
  v_all_received boolean;
  v_received_lines integer := 0;
  v_received_quantity numeric := 0;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'purchase_order_receive',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select o.*
  into v_order
  from public.purchase_orders o
  where o.id = p_order
    and o.organization_id = p_organization
  for update;

  if not found then
    raise exception 'purchase_order_not_found' using errcode = 'P0002';
  end if;

  if v_order.status not in ('ordered', 'partially_received') then
    raise exception 'purchase_order_not_receivable' using errcode = '23514';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'order_requires_lines' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) item
    where jsonb_typeof(item) <> 'object'
      or (item->>'lineId') is null
      or (item->>'lineId') !~ '^[0-9a-fA-F-]{36}$'
      or (item->>'quantity') is null
      or (item->>'quantity') !~ '^[0-9]+(\.[0-9]{1,4})?$'
      or case
           when (item->>'quantity') ~ '^[0-9]+(\.[0-9]{1,4})?$' then (item->>'quantity')::numeric
           else null
         end <= 0
  ) then
    raise exception 'order_line_invalid' using errcode = '22023';
  end if;

  if (
    select count(distinct item->>'lineId')
    from jsonb_array_elements(p_lines) item
  ) <> jsonb_array_length(p_lines) then
    raise exception 'duplicate_order_line' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) item
    where not exists (
      select 1
      from public.purchase_order_lines l
      where l.id = (item->>'lineId')::uuid
        and l.organization_id = p_organization
        and l.purchase_order_id = p_order
    )
  ) then
    raise exception 'purchase_order_line_not_found' using errcode = 'P0002';
  end if;

  -- Lines are processed in product order so two receipts touching the same
  -- stock lines in different document orders cannot deadlock.
  for v_item in
    select
      l.id as line_id,
      l.product_id,
      l.quantity_ordered,
      l.quantity_received,
      p.is_serialized,
      (item->>'quantity')::numeric as receive_quantity,
      item->'serials' as serials
    from jsonb_array_elements(p_lines) as item
    join public.purchase_order_lines l
      on l.id = (item->>'lineId')::uuid
      and l.organization_id = p_organization
      and l.purchase_order_id = p_order
    join public.products p
      on p.id = l.product_id
      and p.organization_id = p_organization
    order by l.product_id
  loop
    if v_item.quantity_received + v_item.receive_quantity > v_item.quantity_ordered then
      raise exception 'purchase_order_over_receipt' using errcode = '23514';
    end if;

    if v_item.is_serialized then
      if v_item.receive_quantity <> round(v_item.receive_quantity)
        or v_item.serials is null
        or jsonb_typeof(v_item.serials) <> 'array'
        or jsonb_array_length(v_item.serials) <> v_item.receive_quantity then
        raise exception 'serial_count_mismatch' using errcode = '23514';
      end if;

      for v_serial in
        select s
        from jsonb_array_elements(v_item.serials) as s
      loop
        if jsonb_typeof(v_serial.s) <> 'object'
          or (v_serial.s->>'serialNumber') is null
          or char_length(btrim(v_serial.s->>'serialNumber')) not between 1 and 120 then
          raise exception 'invalid_serial_number' using errcode = '22023';
        end if;

        if (v_serial.s->>'imei') is not null
          and (v_serial.s->>'imei') !~ '^[0-9]{14,17}$' then
          raise exception 'invalid_imei' using errcode = '22023';
        end if;

        insert into public.devices (
          organization_id,
          product_id,
          serial_number,
          imei,
          condition,
          status,
          warehouse_id,
          location_id,
          supplier_reference,
          note,
          created_by
        )
        values (
          p_organization,
          v_item.product_id,
          btrim(v_serial.s->>'serialNumber'),
          nullif(btrim(coalesce(v_serial.s->>'imei', '')), ''),
          'new',
          'in_stock',
          v_order.warehouse_id,
          v_order.location_id,
          v_order.number,
          nullif(btrim(coalesce(p_note, '')), ''),
          v_actor
        )
        returning id into v_device_id;

        insert into public.device_events (
          organization_id,
          device_id,
          event_type,
          status_to,
          warehouse_to,
          location_to,
          note,
          actor_id
        )
        values (
          p_organization,
          v_device_id,
          'registered',
          'in_stock',
          v_order.warehouse_id,
          v_order.location_id,
          'Received on ' || v_order.number,
          v_actor
        );
      end loop;
    else
      if v_item.serials is not null
        and jsonb_typeof(v_item.serials) = 'array'
        and jsonb_array_length(v_item.serials) > 0 then
        raise exception 'serial_numbers_not_supported' using errcode = '23514';
      end if;

      perform app.operations_apply_stock(
        p_organization,
        v_item.product_id,
        v_order.warehouse_id,
        v_order.location_id,
        'receipt',
        v_item.receive_quantity,
        'purchase_order',
        v_order.id,
        null,
        'Purchase order ' || v_order.number,
        null
      );
    end if;

    update public.purchase_order_lines
    set quantity_received = quantity_received + v_item.receive_quantity
    where id = v_item.line_id;

    v_received_lines := v_received_lines + 1;
    v_received_quantity := v_received_quantity + v_item.receive_quantity;
  end loop;

  select bool_and(l.quantity_received >= l.quantity_ordered)
  into v_all_received
  from public.purchase_order_lines l
  where l.organization_id = p_organization
    and l.purchase_order_id = p_order;

  v_status := case
    when v_all_received then 'received'::app.purchase_order_status
    else 'partially_received'::app.purchase_order_status
  end;

  update public.purchase_orders
  set status = v_status,
      received_at = case when v_status = 'received' then now() else received_at end
  where id = p_order;

  v_existing := jsonb_build_object(
    'orderId', p_order,
    'number', v_order.number,
    'status', v_status,
    'receivedLines', v_received_lines,
    'receivedQuantity', v_received_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.cancel_purchase_order(
  p_organization uuid,
  p_order uuid,
  p_idempotency_key text,
  p_fingerprint text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation_id uuid;
  v_existing jsonb;
  v_duplicate boolean;
  v_order public.purchase_orders%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'purchase_order_cancel',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select o.*
  into v_order
  from public.purchase_orders o
  where o.id = p_order
    and o.organization_id = p_organization
  for update;

  if not found then
    raise exception 'purchase_order_not_found' using errcode = 'P0002';
  end if;

  if v_order.status not in ('draft', 'ordered') then
    raise exception 'purchase_order_not_cancellable' using errcode = '23514';
  end if;

  update public.purchase_orders
  set status = 'cancelled',
      cancelled_at = now(),
      notes = case
        when nullif(btrim(coalesce(p_reason, '')), '') is null then notes
        else concat_ws(E'\n', notes, 'Cancelled: ' || btrim(p_reason))
      end
  where id = p_order;

  v_existing := jsonb_build_object(
    'orderId', p_order,
    'number', v_order.number,
    'status', 'cancelled',
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.create_sales_order(
  p_organization uuid,
  p_customer_name text,
  p_warehouse uuid,
  p_location uuid,
  p_lines jsonb,
  p_idempotency_key text,
  p_fingerprint text,
  p_customer_email text default null,
  p_customer_phone text default null,
  p_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_operation_id uuid;
  v_existing jsonb;
  v_duplicate boolean;
  v_order public.sales_orders%rowtype;
  v_line_count integer;
  v_total_quantity numeric;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_order_create',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 1 and 160 then
    raise exception 'customer_name_required' using errcode = '22023';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'order_requires_lines' using errcode = '22023';
  end if;

  if jsonb_array_length(p_lines) > 100 then
    raise exception 'order_too_many_lines' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) item
    where jsonb_typeof(item) <> 'object'
      or (item->>'productId') is null
      or (item->>'productId') !~ '^[0-9a-fA-F-]{36}$'
      or (item->>'quantity') is null
      or (item->>'quantity') !~ '^[0-9]+(\.[0-9]{1,4})?$'
      or case
           when (item->>'quantity') ~ '^[0-9]+(\.[0-9]{1,4})?$' then (item->>'quantity')::numeric
           else null
         end <= 0
      or (
        item ? 'unitPriceMinor'
        and item->>'unitPriceMinor' is not null
        and (item->>'unitPriceMinor') !~ '^[0-9]{1,15}$'
      )
  ) then
    raise exception 'order_line_invalid' using errcode = '22023';
  end if;

  if (
    select count(distinct item->>'productId')
    from jsonb_array_elements(p_lines) item
  ) <> jsonb_array_length(p_lines) then
    raise exception 'duplicate_order_line' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.warehouses w
    where w.id = p_warehouse
      and w.organization_id = p_organization
  ) then
    raise exception 'warehouse_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.storage_locations l
    where l.id = p_location
      and l.organization_id = p_organization
      and l.warehouse_id = p_warehouse
  ) then
    raise exception 'location_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) item
    where not exists (
      select 1
      from public.products p
      where p.id = (item->>'productId')::uuid
        and p.organization_id = p_organization
    )
  ) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) item
    join public.products p
      on p.id = (item->>'productId')::uuid
      and p.organization_id = p_organization
    where p.is_serialized
  ) then
    raise exception 'product_serialized_order_unsupported' using errcode = '23514';
  end if;

  insert into public.sales_orders (
    organization_id,
    number,
    customer_name,
    customer_email,
    customer_phone,
    warehouse_id,
    location_id,
    status,
    reference,
    notes,
    created_by
  )
  values (
    p_organization,
    app.next_document_number(p_organization, 'sales_order'),
    btrim(p_customer_name),
    nullif(btrim(coalesce(p_customer_email, '')), ''),
    nullif(btrim(coalesce(p_customer_phone, '')), ''),
    p_warehouse,
    p_location,
    'draft',
    nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_actor
  )
  returning * into v_order;

  insert into public.sales_order_lines (
    organization_id,
    sales_order_id,
    product_id,
    quantity,
    unit_price_minor
  )
  select
    p_organization,
    v_order.id,
    (item->>'productId')::uuid,
    (item->>'quantity')::numeric,
    (item->>'unitPriceMinor')::bigint
  from jsonb_array_elements(p_lines) item;

  select count(*), sum(l.quantity)
  into v_line_count, v_total_quantity
  from public.sales_order_lines l
  where l.organization_id = p_organization
    and l.sales_order_id = v_order.id;

  v_existing := jsonb_build_object(
    'orderId', v_order.id,
    'number', v_order.number,
    'status', v_order.status,
    'lineCount', v_line_count,
    'totalQuantity', v_total_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

-- Confirms an outgoing order by reserving every line. If any line cannot be
-- fully reserved the transaction rolls back and the order stays draft.
create or replace function app.confirm_sales_order(
  p_organization uuid,
  p_order uuid,
  p_idempotency_key text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation_id uuid;
  v_existing jsonb;
  v_duplicate boolean;
  v_order public.sales_orders%rowtype;
  v_line record;
  v_reservation_id uuid;
  v_line_count integer;
  v_reserved_quantity numeric := 0;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_order_confirm',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select o.*
  into v_order
  from public.sales_orders o
  where o.id = p_order
    and o.organization_id = p_organization
  for update;

  if not found then
    raise exception 'sales_order_not_found' using errcode = 'P0002';
  end if;

  if v_order.status <> 'draft' then
    raise exception 'sales_order_not_draft' using errcode = '23514';
  end if;

  select count(*)
  into v_line_count
  from public.sales_order_lines l
  where l.organization_id = p_organization
    and l.sales_order_id = p_order;

  if v_line_count = 0 then
    raise exception 'order_requires_lines' using errcode = '23514';
  end if;

  for v_line in
    select l.id, l.product_id, l.quantity
    from public.sales_order_lines l
    where l.organization_id = p_organization
      and l.sales_order_id = p_order
    order by l.product_id
  loop
    v_reservation_id := app.operations_apply_reservation(
      p_organization,
      v_line.product_id,
      v_order.warehouse_id,
      v_order.location_id,
      v_line.quantity,
      p_order
    );

    update public.sales_order_lines
    set reservation_id = v_reservation_id
    where id = v_line.id;

    v_reserved_quantity := v_reserved_quantity + v_line.quantity;
  end loop;

  update public.sales_orders
  set status = 'confirmed',
      confirmed_at = now()
  where id = p_order;

  v_existing := jsonb_build_object(
    'orderId', p_order,
    'number', v_order.number,
    'status', 'confirmed',
    'reservedQuantity', v_reserved_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.fulfil_sales_order(
  p_organization uuid,
  p_order uuid,
  p_idempotency_key text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation_id uuid;
  v_existing jsonb;
  v_duplicate boolean;
  v_order public.sales_orders%rowtype;
  v_line record;
  v_issued_quantity numeric := 0;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_order_fulfil',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select o.*
  into v_order
  from public.sales_orders o
  where o.id = p_order
    and o.organization_id = p_organization
  for update;

  if not found then
    raise exception 'sales_order_not_found' using errcode = 'P0002';
  end if;

  if v_order.status <> 'confirmed' then
    raise exception 'sales_order_not_fulfillable' using errcode = '23514';
  end if;

  for v_line in
    select l.id, l.product_id, l.quantity, l.reservation_id
    from public.sales_order_lines l
    where l.organization_id = p_organization
      and l.sales_order_id = p_order
    order by l.product_id
  loop
    if v_line.reservation_id is null then
      raise exception 'sales_order_reservation_missing' using errcode = '23514';
    end if;

    perform app.operations_apply_stock(
      p_organization,
      v_line.product_id,
      v_order.warehouse_id,
      v_order.location_id,
      'issue',
      v_line.quantity,
      'outgoing_order',
      v_order.id,
      v_line.reservation_id,
      'Outgoing order ' || v_order.number,
      null
    );

    v_issued_quantity := v_issued_quantity + v_line.quantity;
  end loop;

  update public.sales_orders
  set status = 'fulfilled',
      fulfilled_at = now()
  where id = p_order;

  v_existing := jsonb_build_object(
    'orderId', p_order,
    'number', v_order.number,
    'status', 'fulfilled',
    'issuedQuantity', v_issued_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.cancel_sales_order(
  p_organization uuid,
  p_order uuid,
  p_idempotency_key text,
  p_fingerprint text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_operation_id uuid;
  v_existing jsonb;
  v_duplicate boolean;
  v_order public.sales_orders%rowtype;
  v_released integer := 0;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_order_cancel',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select o.*
  into v_order
  from public.sales_orders o
  where o.id = p_order
    and o.organization_id = p_organization
  for update;

  if not found then
    raise exception 'sales_order_not_found' using errcode = 'P0002';
  end if;

  if v_order.status not in ('draft', 'confirmed') then
    raise exception 'sales_order_not_cancellable' using errcode = '23514';
  end if;

  if v_order.status = 'confirmed' then
    update public.stock_reservations r
    set status = 'released',
        released_at = now(),
        released_by = v_actor
    where r.organization_id = p_organization
      and r.status = 'active'
      and r.id in (
        select l.reservation_id
        from public.sales_order_lines l
        where l.organization_id = p_organization
          and l.sales_order_id = p_order
          and l.reservation_id is not null
      );

    get diagnostics v_released = row_count;
  end if;

  update public.sales_orders
  set status = 'cancelled',
      cancelled_at = now(),
      notes = case
        when nullif(btrim(coalesce(p_reason, '')), '') is null then notes
        else concat_ws(E'\n', notes, 'Cancelled: ' || btrim(p_reason))
      end
  where id = p_order;

  v_existing := jsonb_build_object(
    'orderId', p_order,
    'number', v_order.number,
    'status', 'cancelled',
    'releasedReservations', v_released,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

revoke execute on function app.save_supplier(uuid, uuid, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function app.set_supplier_active(uuid, uuid, boolean) from public;
revoke execute on function app.next_document_number(uuid, app.document_kind) from public;
revoke execute on function app.operations_apply_stock(
  uuid, uuid, uuid, uuid, app.stock_movement_type, numeric,
  app.stock_reference_type, uuid, uuid, text, text
) from public;
revoke execute on function app.operations_apply_reservation(uuid, uuid, uuid, uuid, numeric, uuid) from public;
revoke execute on function app.create_purchase_order(
  uuid, uuid, uuid, uuid, jsonb, text, text, date, text, text
) from public;
revoke execute on function app.order_purchase_order(uuid, uuid, text, text) from public;
revoke execute on function app.receive_purchase_order(uuid, uuid, jsonb, text, text, text) from public;
revoke execute on function app.cancel_purchase_order(uuid, uuid, text, text, text) from public;
revoke execute on function app.create_sales_order(
  uuid, text, uuid, uuid, jsonb, text, text, text, text, text, text
) from public;
revoke execute on function app.confirm_sales_order(uuid, uuid, text, text) from public;
revoke execute on function app.fulfil_sales_order(uuid, uuid, text, text) from public;
revoke execute on function app.cancel_sales_order(uuid, uuid, text, text, text) from public;

grant execute on function app.save_supplier(uuid, uuid, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function app.set_supplier_active(uuid, uuid, boolean) to authenticated;
grant execute on function app.create_purchase_order(
  uuid, uuid, uuid, uuid, jsonb, text, text, date, text, text
) to authenticated;
grant execute on function app.order_purchase_order(uuid, uuid, text, text) to authenticated;
grant execute on function app.receive_purchase_order(uuid, uuid, jsonb, text, text, text) to authenticated;
grant execute on function app.cancel_purchase_order(uuid, uuid, text, text, text) to authenticated;
grant execute on function app.create_sales_order(
  uuid, text, uuid, uuid, jsonb, text, text, text, text, text, text
) to authenticated;
grant execute on function app.confirm_sales_order(uuid, uuid, text, text) to authenticated;
grant execute on function app.fulfil_sales_order(uuid, uuid, text, text) to authenticated;
grant execute on function app.cancel_sales_order(uuid, uuid, text, text, text) to authenticated;
