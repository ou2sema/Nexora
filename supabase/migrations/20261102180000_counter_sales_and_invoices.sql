-- Counter sales: a customer directory and commercial invoices. A posted sale is one
-- transaction that reuses the Phase 6 outbound workflow rather than duplicating it: the bulk
-- lines of the sale become a `sales_orders` document that is reserved and issued through the
-- same helpers a manually fulfilled order uses, and serialized units leave through the device
-- lifecycle, which owns their identity. Quantity still changes in exactly one place, and the
-- whole transition still claims exactly one idempotency key. See ADR-0017.

create type app.payment_status as enum ('unpaid', 'partial', 'paid');

create type app.payment_method as enum ('cash', 'bank_transfer', 'card_manual', 'credit');

alter type app.document_kind add value if not exists 'sales_invoice';

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  email text check (email is null or position('@' in email) > 1),
  phone text,
  address_line text,
  city text,
  country_code char(2),
  tax_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_organization_id_key unique (organization_id, id)
);

-- Customer names are not unique: two walk-in receipts for the same person typed twice are a
-- normal counter situation, and the picker searches rather than assumes.
create index customers_org_name_idx on public.customers (organization_id, lower(name));
create index customers_org_active_idx on public.customers (organization_id, is_active);

create trigger customers_touch_updated_at
before update on public.customers
for each row execute function app.touch_updated_at();

-- One invoice per sale. `sales_order_id` is the outbound document of record and is null for a
-- sale of serialized stock only, which posts no ledger movement at all.
create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number text not null,
  sales_order_id uuid,
  warehouse_id uuid not null,
  location_id uuid not null,
  customer_id uuid,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 160),
  customer_email text check (customer_email is null or position('@' in customer_email) > 1),
  customer_phone text,
  net_amount_minor bigint not null check (net_amount_minor >= 0),
  tax_amount_minor bigint not null check (tax_amount_minor >= 0),
  total_amount_minor bigint not null check (total_amount_minor >= 0),
  paid_amount_minor bigint not null default 0 check (paid_amount_minor >= 0),
  payment_status app.payment_status not null default 'unpaid',
  payment_method app.payment_method,
  reference text,
  notes text,
  issued_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_invoices_organization_id_key unique (organization_id, id),
  constraint sales_invoices_number_key unique (organization_id, number),
  constraint sales_invoices_sales_order_key unique (sales_order_id),
  constraint sales_invoices_total_check
    check (total_amount_minor = net_amount_minor + tax_amount_minor),
  constraint sales_invoices_paid_within_total_check
    check (paid_amount_minor <= total_amount_minor),
  constraint sales_invoices_payment_status_check check (
    payment_status = case
      when total_amount_minor = 0 then 'paid'::app.payment_status
      when paid_amount_minor = 0 then 'unpaid'::app.payment_status
      when paid_amount_minor = total_amount_minor then 'paid'::app.payment_status
      else 'partial'::app.payment_status
    end
  ),
  constraint sales_invoices_customer_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete restrict,
  constraint sales_invoices_order_fkey
    foreign key (organization_id, sales_order_id)
    references public.sales_orders (organization_id, id)
    on delete restrict,
  constraint sales_invoices_warehouse_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint sales_invoices_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict
);

create index sales_invoices_org_issued_idx
  on public.sales_invoices (organization_id, issued_at desc);
create index sales_invoices_customer_idx
  on public.sales_invoices (organization_id, customer_id);

create trigger sales_invoices_touch_updated_at
before update on public.sales_invoices
for each row execute function app.touch_updated_at();

-- The commercial snapshot. Prices, tax rate, and the rounded amounts are the values the invoice
-- was issued with and are never re-derived from the catalog afterwards, so renaming a product or
-- changing its price cannot rewrite an invoice that has already left the counter. A line carries
-- exactly one source: the order line it bills for a quantity-tracked product, or the device it
-- sold for a serialized unit.
create table public.sales_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sales_invoice_id uuid not null,
  sales_order_line_id uuid,
  device_id uuid,
  product_id uuid not null,
  kind text not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  tax_rate_percent numeric(7, 4) not null default 0
    check (tax_rate_percent >= 0 and tax_rate_percent <= 100),
  net_amount_minor bigint not null check (net_amount_minor >= 0),
  tax_amount_minor bigint not null check (tax_amount_minor >= 0),
  created_at timestamptz not null default now(),
  constraint sales_invoice_lines_organization_id_key unique (organization_id, id),
  constraint sales_invoice_lines_kind_check check (kind in ('product', 'device')),
  constraint sales_invoice_lines_source_check check (
    (sales_order_line_id is not null) = (kind = 'product')
    and (device_id is not null) = (kind = 'device')
  ),
  constraint sales_invoice_lines_invoice_fkey
    foreign key (organization_id, sales_invoice_id)
    references public.sales_invoices (organization_id, id)
    on delete cascade,
  constraint sales_invoice_lines_order_line_fkey
    foreign key (organization_id, sales_order_line_id)
    references public.sales_order_lines (organization_id, id)
    on delete restrict,
  constraint sales_invoice_lines_device_fkey
    foreign key (organization_id, device_id)
    references public.devices (organization_id, id)
    on delete restrict,
  constraint sales_invoice_lines_product_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict
);

create unique index sales_invoice_lines_invoice_product_key
  on public.sales_invoice_lines (sales_invoice_id, product_id)
  where device_id is null;
create unique index sales_invoice_lines_device_key
  on public.sales_invoice_lines (sales_invoice_id, device_id)
  where device_id is not null;
create index sales_invoice_lines_invoice_idx
  on public.sales_invoice_lines (organization_id, sales_invoice_id);

-- Payment rows are the trail; the invoice's paid amount and status are the projection the same
-- transactions maintain. Nothing about the instrument is stored beyond the operator's note.
create table public.sales_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sales_invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  method app.payment_method not null,
  note text,
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint sales_invoice_payments_organization_id_key unique (organization_id, id),
  constraint sales_invoice_payments_invoice_fkey
    foreign key (organization_id, sales_invoice_id)
    references public.sales_invoices (organization_id, id)
    on delete cascade
);

create index sales_invoice_payments_invoice_idx
  on public.sales_invoice_payments (organization_id, sales_invoice_id, recorded_at);

-- Sales and payments extend the idempotency vocabulary.
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
      'sales_order_cancel',
      'purchase_return_create',
      'purchase_return_post',
      'purchase_return_cancel',
      'sales_return_create',
      'sales_return_post',
      'sales_return_cancel',
      'sales_invoice_create',
      'sales_invoice_payment'
    )
  );

alter table public.customers enable row level security;
alter table public.sales_invoices enable row level security;
alter table public.sales_invoice_lines enable row level security;
alter table public.sales_invoice_payments enable row level security;

create policy customers_select_member on public.customers
for select to authenticated
using (app.is_org_member(organization_id));

create policy sales_invoices_select_member on public.sales_invoices
for select to authenticated
using (app.is_org_member(organization_id));

create policy sales_invoice_lines_select_member on public.sales_invoice_lines
for select to authenticated
using (app.is_org_member(organization_id));

create policy sales_invoice_payments_select_member on public.sales_invoice_payments
for select to authenticated
using (app.is_org_member(organization_id));

grant select on public.customers to authenticated;
grant select on public.sales_invoices to authenticated;
grant select on public.sales_invoice_lines to authenticated;
grant select on public.sales_invoice_payments to authenticated;

-- Numbering now covers five document kinds. An invoice keeps the shape of the other four:
-- two-letter prefix, year, and a four-digit counter, so FI-2026-0001 rather than a wider pad.
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

  v_prefix := case p_kind
    when 'purchase_order' then 'PO'
    when 'sales_order' then 'SO'
    when 'purchase_return' then 'PR'
    when 'sales_return' then 'SR'
    when 'sales_invoice' then 'FI'
  end;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_value::text, 4, '0');
end
$$;

-- Saves a customer. Existing customers are deactivated instead of deleted so issued invoices
-- keep their reference. Unlike suppliers, customer names are not unique per organization.
create or replace function app.save_customer(
  p_organization uuid,
  p_customer uuid,
  p_name text,
  p_email text default null,
  p_phone text default null,
  p_address_line text default null,
  p_city text default null,
  p_country_code text default null,
  p_tax_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 160 then
    raise exception 'invalid_customer_name' using errcode = '22023';
  end if;

  if p_country_code is not null and btrim(p_country_code) <> ''
    and char_length(btrim(p_country_code)) <> 2 then
    raise exception 'invalid_country_code' using errcode = '22023';
  end if;

  if p_customer is null then
    insert into public.customers (
      organization_id,
      name,
      email,
      phone,
      address_line,
      city,
      country_code,
      tax_id
    )
    values (
      p_organization,
      btrim(p_name),
      nullif(btrim(coalesce(p_email, '')), ''),
      nullif(btrim(coalesce(p_phone, '')), ''),
      nullif(btrim(coalesce(p_address_line, '')), ''),
      nullif(btrim(coalesce(p_city, '')), ''),
      nullif(upper(btrim(coalesce(p_country_code, ''))), ''),
      nullif(btrim(coalesce(p_tax_id, '')), '')
    )
    returning * into v_customer;
  else
    update public.customers
    set name = btrim(p_name),
        email = nullif(btrim(coalesce(p_email, '')), ''),
        phone = nullif(btrim(coalesce(p_phone, '')), ''),
        address_line = nullif(btrim(coalesce(p_address_line, '')), ''),
        city = nullif(btrim(coalesce(p_city, '')), ''),
        country_code = nullif(upper(btrim(coalesce(p_country_code, ''))), ''),
        tax_id = nullif(btrim(coalesce(p_tax_id, '')), '')
    where id = p_customer
      and organization_id = p_organization
    returning * into v_customer;

    if not found then
      raise exception 'customer_not_found' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object(
    'customerId', v_customer.id,
    'name', v_customer.name,
    'isActive', v_customer.is_active
  );
end
$$;

create or replace function app.set_customer_active(
  p_organization uuid,
  p_customer uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.customers
  set is_active = p_active
  where id = p_customer
    and organization_id = p_organization
  returning * into v_customer;

  if not found then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'customerId', v_customer.id,
    'name', v_customer.name,
    'isActive', v_customer.is_active
  );
end
$$;

-- Posts a counter sale. This is the whole workflow in one transaction and one idempotency key:
-- the basket becomes an outgoing order that is reserved and issued through the same helpers a
-- manually fulfilled order uses, serialized units leave through the device lifecycle, and the
-- commercial snapshot is written from amounts the database computed.
--
-- The amounts are derived here and nowhere else: every line's net and tax is calculated once,
-- accumulated into the header totals, and stored on both rows, so HT + taxes is exactly TTC.
-- Prices come from the request only as a negotiated override; otherwise they are read from the
-- catalog. Client-sent totals are never a parameter of this function.
--
-- Lock order is fixed so concurrent sales queue instead of deadlocking: the idempotency claim,
-- then devices by id, then balances by product id.
create or replace function app.create_sales_invoice(
  p_organization uuid,
  p_warehouse uuid,
  p_location uuid,
  p_lines jsonb,
  p_idempotency_key text,
  p_fingerprint text,
  p_customer uuid default null,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_phone text default null,
  p_paid_amount_minor bigint default 0,
  p_payment_method text default 'cash',
  p_payment_note text default null,
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
  v_resolved jsonb := '[]'::jsonb;
  v_order public.sales_orders%rowtype;
  v_invoice public.sales_invoices%rowtype;
  v_product public.products%rowtype;
  v_device public.devices%rowtype;
  v_customer public.customers%rowtype;
  v_customer_id uuid;
  v_line record;
  v_bulk_count integer := 0;
  v_line_count integer := 0;
  v_total_quantity numeric := 0;
  v_net_total bigint := 0;
  v_tax_total bigint := 0;
  v_reservation_id uuid;
  v_product_id uuid;
  v_device_id uuid;
  v_quantity numeric;
  v_price bigint;
  v_rate numeric;
  v_net bigint;
  v_tax bigint;
  v_paid bigint;
  v_invoice_number text;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_invoice_create',
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
      or coalesce(item->>'kind', '') not in ('product', 'device')
      or (
        item->>'kind' = 'product'
        and (
          (item->>'productId') is null
          or (item->>'productId') !~ '^[0-9a-fA-F-]{36}$'
          or (item->>'quantity') is null
          or (item->>'quantity') !~ '^[0-9]+(\.[0-9]{1,4})?$'
          or case
               when (item->>'quantity') ~ '^[0-9]+(\.[0-9]{1,4})?$' then (item->>'quantity')::numeric
               else null
             end <= 0
          or (item->>'deviceId') is not null
        )
      )
      or (
        item->>'kind' = 'device'
        and (
          (item->>'deviceId') is null
          or (item->>'deviceId') !~ '^[0-9a-fA-F-]{36}$'
          or (item->>'quantity') is not null
        )
      )
      or (
        item ? 'unitPriceMinor'
        and item->>'unitPriceMinor' is not null
        and (item->>'unitPriceMinor') !~ '^[0-9]{1,15}$'
      )
      or (
        item ? 'taxRatePercent'
        and item->>'taxRatePercent' is not null
        and (
          (item->>'taxRatePercent') !~ '^[0-9]{1,3}(\.[0-9]{1,4})?$'
          or case
               when (item->>'taxRatePercent') ~ '^[0-9]{1,3}(\.[0-9]{1,4})?$'
                 then (item->>'taxRatePercent')::numeric
               else null
             end > 100
        )
      )
  ) then
    raise exception 'order_line_invalid' using errcode = '22023';
  end if;

  if (
    select count(distinct item->>'productId')
    from jsonb_array_elements(p_lines) item
    where item->>'kind' = 'product'
  ) <> (
    select count(*) from jsonb_array_elements(p_lines) item where item->>'kind' = 'product'
  ) then
    raise exception 'duplicate_order_line' using errcode = '22023';
  end if;

  if (
    select count(distinct item->>'deviceId')
    from jsonb_array_elements(p_lines) item
    where item->>'kind' = 'device'
  ) <> (
    select count(*) from jsonb_array_elements(p_lines) item where item->>'kind' = 'device'
  ) then
    raise exception 'duplicate_device' using errcode = '22023';
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

  if p_paid_amount_minor is null or p_paid_amount_minor < 0 then
    raise exception 'invalid_paid_amount' using errcode = '22023';
  end if;

  if p_payment_method is null
    or p_payment_method not in ('cash', 'bank_transfer', 'card_manual', 'credit') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  if p_customer is not null then
    select c.*
    into v_customer
    from public.customers c
    where c.id = p_customer
      and c.organization_id = p_organization;

    if not found then
      raise exception 'customer_not_found' using errcode = 'P0002';
    end if;

    -- Deactivating a customer keeps its invoices readable but stops new sales to it, the same
    -- rule purchase orders apply to suppliers.
    if not v_customer.is_active then
      raise exception 'customer_not_active' using errcode = '23514';
    end if;

    v_customer_name := v_customer.name;
    v_customer_email := v_customer.email;
    v_customer_phone := v_customer.phone;
    v_customer_id := v_customer.id;
  else
    if p_customer_name is null or char_length(btrim(p_customer_name)) not between 1 and 160 then
      raise exception 'customer_name_required' using errcode = '22023';
    end if;

    v_customer_name := btrim(p_customer_name);
    v_customer_email := nullif(btrim(coalesce(p_customer_email, '')), '');
    v_customer_phone := nullif(btrim(coalesce(p_customer_phone, '')), '');
  end if;

  v_invoice_number := app.next_document_number(p_organization, 'sales_invoice');

  -- Serialized units first: each device row is locked before any stock balance is touched.
  for v_line in
    select (item->>'deviceId')::uuid as device_id, item as raw
    from jsonb_array_elements(p_lines) item
    where item->>'kind' = 'device'
    order by 1
  loop
    v_device_id := v_line.device_id;

    select d.*
    into v_device
    from public.devices d
    where d.id = v_device_id
      and d.organization_id = p_organization
    for update;

    if not found then
      raise exception 'device_not_found' using errcode = 'P0002';
    end if;

    if v_device.warehouse_id <> p_warehouse or v_device.location_id <> p_location then
      raise exception 'device_wrong_location' using errcode = '23514';
    end if;

    -- The row lock plus this check is what keeps two sellers from selling the same physical
    -- unit: the loser waits, then finds the device no longer in stock.
    if v_device.status <> 'in_stock' then
      raise exception 'device_not_in_stock' using errcode = '23514';
    end if;

    select p.*
    into v_product
    from public.products p
    where p.id = v_device.product_id
      and p.organization_id = p_organization;

    if not found then
      raise exception 'product_not_found' using errcode = 'P0002';
    end if;

    if v_line.raw->>'unitPriceMinor' is not null then
      v_price := (v_line.raw->>'unitPriceMinor')::bigint;
    else
      v_price := v_product.sale_price_minor;
    end if;

    if v_price is null then
      raise exception 'product_price_undefined' using errcode = '22023';
    end if;

    v_rate := coalesce(nullif(v_line.raw->>'taxRatePercent', ''), '0')::numeric;
    v_quantity := 1;
    v_net := round(v_quantity * v_price, 0)::bigint;
    v_tax := round(v_net * v_rate / 100, 0)::bigint;

    v_resolved := v_resolved || jsonb_build_object(
      'kind', 'device',
      'productId', v_device.product_id,
      'deviceId', v_device_id,
      'quantity', '1',
      'unitPriceMinor', v_price,
      'taxRatePercent', v_rate,
      'netAmountMinor', v_net,
      'taxAmountMinor', v_tax
    );

    v_net_total := v_net_total + v_net;
    v_tax_total := v_tax_total + v_tax;

    update public.devices
    set status = 'sold',
        updated_at = now()
    where id = v_device_id;

    insert into public.device_events (
      organization_id,
      device_id,
      event_type,
      status_from,
      status_to,
      warehouse_from,
      location_from,
      note,
      actor_id
    )
    values (
      p_organization,
      v_device_id,
      'issued',
      v_device.status,
      'sold',
      v_device.warehouse_id,
      v_device.location_id,
      'Sold on ' || v_invoice_number,
      v_actor
    );
  end loop;

  for v_line in
    select
      (item->>'productId')::uuid as product_id,
      (item->>'quantity')::numeric as quantity,
      item->>'unitPriceMinor' as unit_price,
      coalesce(nullif(item->>'taxRatePercent', ''), '0')::numeric as tax_rate
    from jsonb_array_elements(p_lines) item
    where item->>'kind' = 'product'
    order by 1
  loop
    v_product_id := v_line.product_id;
    v_quantity := v_line.quantity;

    select p.*
    into v_product
    from public.products p
    where p.id = v_product_id
      and p.organization_id = p_organization;

    if not found then
      raise exception 'product_not_found' using errcode = 'P0002';
    end if;

    -- Kept deliberately: a serialized product has no ledger quantity, so it cannot be sold as a
    -- number of units. ADR-0008 decision 4 stands; the counter allocates devices instead.
    if v_product.is_serialized then
      raise exception 'serialized_line_requires_device' using errcode = '22023';
    end if;

    if v_line.unit_price is not null then
      v_price := v_line.unit_price::bigint;
    else
      v_price := v_product.sale_price_minor;
    end if;

    if v_price is null then
      raise exception 'product_price_undefined' using errcode = '22023';
    end if;

    v_rate := v_line.tax_rate;
    v_net := round(v_quantity * v_price, 0)::bigint;
    v_tax := round(v_net * v_rate / 100, 0)::bigint;

    v_resolved := v_resolved || jsonb_build_object(
      'kind', 'product',
      'productId', v_product_id,
      'deviceId', null,
      'quantity', v_quantity,
      'unitPriceMinor', v_price,
      'taxRatePercent', v_rate,
      'netAmountMinor', v_net,
      'taxAmountMinor', v_tax
    );

    v_net_total := v_net_total + v_net;
    v_tax_total := v_tax_total + v_tax;
    v_bulk_count := v_bulk_count + 1;
  end loop;

  v_paid := p_paid_amount_minor;

  if v_paid > v_net_total + v_tax_total then
    raise exception 'payment_exceeds_total' using errcode = '23514';
  end if;

  if v_bulk_count > 0 then
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
      v_customer_name,
      v_customer_email,
      v_customer_phone,
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
    from jsonb_array_elements(v_resolved) item
    where item->>'kind' = 'product';

    for v_line in
      select l.id, l.product_id, l.quantity
      from public.sales_order_lines l
      where l.organization_id = p_organization
        and l.sales_order_id = v_order.id
      order by l.product_id
    loop
      v_reservation_id := app.operations_apply_reservation(
        p_organization,
        v_line.product_id,
        p_warehouse,
        p_location,
        v_line.quantity,
        v_order.id
      );

      update public.sales_order_lines
      set reservation_id = v_reservation_id
      where id = v_line.id;
    end loop;

    update public.sales_orders
    set status = 'confirmed',
        confirmed_at = now()
    where id = v_order.id;

    for v_line in
      select l.id, l.product_id, l.quantity, l.reservation_id
      from public.sales_order_lines l
      where l.organization_id = p_organization
        and l.sales_order_id = v_order.id
      order by l.product_id
    loop
      if v_line.reservation_id is null then
        raise exception 'sales_order_reservation_missing' using errcode = '23514';
      end if;

      perform app.operations_apply_stock(
        p_organization,
        v_line.product_id,
        p_warehouse,
        p_location,
        'issue',
        v_line.quantity,
        'outgoing_order',
        v_order.id,
        v_line.reservation_id,
        'Counter sale ' || v_invoice_number,
        null
      );
    end loop;

    update public.sales_orders
    set status = 'fulfilled',
        fulfilled_at = now()
    where id = v_order.id;
  end if;

  insert into public.sales_invoices (
    organization_id,
    number,
    sales_order_id,
    warehouse_id,
    location_id,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    net_amount_minor,
    tax_amount_minor,
    total_amount_minor,
    paid_amount_minor,
    payment_status,
    payment_method,
    reference,
    notes,
    issued_at,
    created_by
  )
  values (
    p_organization,
    v_invoice_number,
    v_order.id,
    p_warehouse,
    p_location,
    v_customer_id,
    v_customer_name,
    v_customer_email,
    v_customer_phone,
    v_net_total,
    v_tax_total,
    v_net_total + v_tax_total,
    v_paid,
    case
      when v_net_total + v_tax_total = 0 then 'paid'::app.payment_status
      when v_paid = 0 then 'unpaid'::app.payment_status
      when v_paid = v_net_total + v_tax_total then 'paid'::app.payment_status
      else 'partial'::app.payment_status
    end,
    case
      when v_paid > 0 then p_payment_method::app.payment_method
      else null
    end,
    nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    now(),
    v_actor
  )
  returning * into v_invoice;

  insert into public.sales_invoice_lines (
    organization_id,
    sales_invoice_id,
    sales_order_line_id,
    device_id,
    product_id,
    kind,
    quantity,
    unit_price_minor,
    tax_rate_percent,
    net_amount_minor,
    tax_amount_minor
  )
  select
    p_organization,
    v_invoice.id,
    ol.id,
    (item->>'deviceId')::uuid,
    (item->>'productId')::uuid,
    item->>'kind',
    (item->>'quantity')::numeric,
    (item->>'unitPriceMinor')::bigint,
    (item->>'taxRatePercent')::numeric,
    (item->>'netAmountMinor')::bigint,
    (item->>'taxAmountMinor')::bigint
  from jsonb_array_elements(v_resolved) item
  left join public.sales_order_lines ol
    on ol.organization_id = p_organization
   and ol.sales_order_id = v_invoice.sales_order_id
   and ol.product_id = (item->>'productId')::uuid
   and item->>'kind' = 'product';

  select count(*), sum(l.quantity)
  into v_line_count, v_total_quantity
  from public.sales_invoice_lines l
  where l.organization_id = p_organization
    and l.sales_invoice_id = v_invoice.id;

  if v_paid > 0 then
    insert into public.sales_invoice_payments (
      organization_id,
      sales_invoice_id,
      amount_minor,
      method,
      note,
      recorded_by
    )
    values (
      p_organization,
      v_invoice.id,
      v_paid,
      p_payment_method::app.payment_method,
      nullif(btrim(coalesce(p_payment_note, '')), ''),
      v_actor
    );
  end if;

  v_existing := jsonb_build_object(
    'invoiceId', v_invoice.id,
    'number', v_invoice.number,
    'orderId', v_invoice.sales_order_id,
    'lineCount', v_line_count,
    'totalQuantity', v_total_quantity,
    'netAmountMinor', v_invoice.net_amount_minor,
    'taxAmountMinor', v_invoice.tax_amount_minor,
    'totalAmountMinor', v_invoice.total_amount_minor,
    'paidAmountMinor', v_invoice.paid_amount_minor,
    'remainingAmountMinor', v_invoice.total_amount_minor - v_invoice.paid_amount_minor,
    'paymentStatus', v_invoice.payment_status,
    'paymentMethod', v_invoice.payment_method,
    'issuedAt', v_invoice.issued_at,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

-- Records a payment against an issued invoice. An invoice with an outstanding balance stays
-- readable and collectable; over-collecting is rejected rather than redistributed.
create or replace function app.record_sales_invoice_payment(
  p_organization uuid,
  p_invoice uuid,
  p_amount_minor bigint,
  p_method text,
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
  v_invoice public.sales_invoices%rowtype;
  v_paid bigint;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_invoice_payment',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_paid_amount' using errcode = '22023';
  end if;

  if p_method is null
    or p_method not in ('cash', 'bank_transfer', 'card_manual', 'credit') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  select i.*
  into v_invoice
  from public.sales_invoices i
  where i.id = p_invoice
    and i.organization_id = p_organization
  for update;

  if not found then
    raise exception 'sales_invoice_not_found' using errcode = 'P0002';
  end if;

  v_paid := v_invoice.paid_amount_minor + p_amount_minor;

  if v_paid > v_invoice.total_amount_minor then
    raise exception 'payment_exceeds_total' using errcode = '23514';
  end if;

  insert into public.sales_invoice_payments (
    organization_id,
    sales_invoice_id,
    amount_minor,
    method,
    note,
    recorded_by
  )
  values (
    p_organization,
    v_invoice.id,
    p_amount_minor,
    p_method::app.payment_method,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor
  );

  update public.sales_invoices
  set paid_amount_minor = v_paid,
      payment_status = case
        when v_paid = total_amount_minor then 'paid'::app.payment_status
        else 'partial'::app.payment_status
      end,
      payment_method = p_method::app.payment_method
  where id = v_invoice.id
  returning * into v_invoice;

  v_existing := jsonb_build_object(
    'invoiceId', v_invoice.id,
    'number', v_invoice.number,
    'paidAmountMinor', v_invoice.paid_amount_minor,
    'remainingAmountMinor', v_invoice.total_amount_minor - v_invoice.paid_amount_minor,
    'paymentStatus', v_invoice.payment_status,
    'paymentMethod', v_invoice.payment_method,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

revoke execute on function app.next_document_number(uuid, app.document_kind) from public;
revoke execute on function app.save_customer(
  uuid, uuid, text, text, text, text, text, text, text
) from public;
revoke execute on function app.set_customer_active(uuid, uuid, boolean) from public;
revoke execute on function app.create_sales_invoice(
  uuid, uuid, uuid, jsonb, text, text, uuid, text, text, text, bigint, text, text, text, text
) from public;
revoke execute on function app.record_sales_invoice_payment(
  uuid, uuid, bigint, text, text, text, text
) from public;

grant execute on function app.save_customer(
  uuid, uuid, text, text, text, text, text, text, text
) to authenticated;
grant execute on function app.set_customer_active(uuid, uuid, boolean) to authenticated;
grant execute on function app.create_sales_invoice(
  uuid, uuid, uuid, jsonb, text, text, uuid, text, text, text, bigint, text, text, text, text
) to authenticated;
grant execute on function app.record_sales_invoice_payment(
  uuid, uuid, bigint, text, text, text, text
) to authenticated;
