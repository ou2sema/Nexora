-- Barcode workflows: GTIN validation, internal label numbering, and persisted
-- inventory-count sessions that post adjustments through the stock ledger.
-- Count tables are read-only to application roles; every write goes through a
-- SECURITY DEFINER function with role checks and row locks.

-- EAN-8/UPC-A/EAN-13/GTIN-14 check digit. A barcode only reaches a label or a
-- scan result when this validates, so a typo cannot masquerade as a product.
create or replace function app.gtin_check_digit(p_payload text)
returns integer
language plpgsql
immutable
as $$
declare
  v_sum integer := 0;
  v_weight integer := 3;
  v_index integer;
begin
  if p_payload is null or p_payload !~ '^[0-9]+$' then
    raise exception 'invalid_gtin_payload' using errcode = '22023';
  end if;

  for v_index in reverse char_length(p_payload)..1 loop
    v_sum := v_sum + substr(p_payload, v_index, 1)::integer * v_weight;
    v_weight := case when v_weight = 3 then 1 else 3 end;
  end loop;

  return (10 - (v_sum % 10)) % 10;
end
$$;

create or replace function app.is_valid_gtin(p_digits text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_length integer;
begin
  if p_digits is null then
    return false;
  end if;

  v_length := char_length(p_digits);

  if v_length not in (8, 12, 13, 14) or p_digits !~ '^[0-9]+$' then
    return false;
  end if;

  return app.gtin_check_digit(left(p_digits, v_length - 1)) = right(p_digits, 1)::integer;
end
$$;

alter table public.products
  add constraint products_barcode_gtin_check
  check (barcode is null or app.is_valid_gtin(barcode));

-- The `2` prefix is reserved by GS1 for in-store numbering, so generated
-- barcodes can never collide with a manufacturer's printed code.
create sequence app.internal_barcode_seq as bigint start with 10000000001;

create or replace function app.assign_product_barcode(
  p_organization uuid,
  p_product uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
  v_candidate text;
  v_payload text;
  v_attempt integer := 0;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select p.barcode
  into v_existing
  from public.products p
  where p.id = p_product
    and p.organization_id = p_organization
  for update;

  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if v_existing is not null then
    return v_existing;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_payload := '2' || lpad(nextval('app.internal_barcode_seq')::text, 11, '0');
    v_candidate := v_payload || app.gtin_check_digit(v_payload)::text;

    exit when not exists (
      select 1
      from public.products p
      where p.organization_id = p_organization
        and p.barcode = v_candidate
    );

    if v_attempt >= 20 then
      raise exception 'barcode_generation_failed' using errcode = '55000';
    end if;
  end loop;

  update public.products
  set barcode = v_candidate
  where id = p_product;

  return v_candidate;
end
$$;

create type app.stock_count_status as enum ('open', 'posted', 'cancelled');

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null,
  location_id uuid not null,
  status app.stock_count_status not null default 'open',
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  posted_by uuid references auth.users (id) on delete set null,
  constraint stock_counts_organization_id_key unique (organization_id, id),
  constraint stock_counts_warehouse_org_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint stock_counts_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict,
  constraint stock_counts_posted_check check ((status = 'posted') = (posted_at is not null))
);

-- Only one open count per stock location: a second counter would otherwise post
-- adjustments from a stale snapshot.
create unique index stock_counts_open_location_key
  on public.stock_counts (organization_id, warehouse_id, location_id)
  where status = 'open';

create index stock_counts_org_created_idx
  on public.stock_counts (organization_id, created_at desc);

create table public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  count_id uuid not null,
  product_id uuid not null,
  counted_quantity numeric(18, 4) not null default 0 check (counted_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_count_lines_count_product_key unique (count_id, product_id),
  constraint stock_count_lines_count_org_fkey
    foreign key (organization_id, count_id)
    references public.stock_counts (organization_id, id)
    on delete cascade,
  constraint stock_count_lines_product_org_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict
);

create index stock_count_lines_count_idx on public.stock_count_lines (organization_id, count_id);

create trigger stock_count_lines_touch_updated_at
before update on public.stock_count_lines
for each row execute function app.touch_updated_at();

alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;

create policy stock_counts_select_member on public.stock_counts
for select to authenticated
using (app.is_org_member(organization_id));

create policy stock_count_lines_select_member on public.stock_count_lines
for select to authenticated
using (app.is_org_member(organization_id));

grant select on public.stock_counts to authenticated;
grant select on public.stock_count_lines to authenticated;

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
      'stock_count'
    )
  );

create or replace function app.start_stock_count(
  p_organization uuid,
  p_warehouse uuid,
  p_location uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_count public.stock_counts%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.warehouses w
    where w.id = p_warehouse and w.organization_id = p_organization
  ) then
    raise exception 'warehouse_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.storage_locations l
    where l.id = p_location
      and l.organization_id = p_organization
      and l.warehouse_id = p_warehouse
  ) then
    raise exception 'location_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.stock_counts c
    where c.organization_id = p_organization
      and c.warehouse_id = p_warehouse
      and c.location_id = p_location
      and c.status = 'open'
  ) then
    raise exception 'stock_count_already_open' using errcode = '23514';
  end if;

  insert into public.stock_counts (organization_id, warehouse_id, location_id, note, created_by)
  values (p_organization, p_warehouse, p_location, nullif(btrim(coalesce(p_note, '')), ''), v_actor)
  returning * into v_count;

  return jsonb_build_object(
    'countId', v_count.id,
    'warehouseId', v_count.warehouse_id,
    'locationId', v_count.location_id,
    'status', v_count.status,
    'createdAt', v_count.created_at
  );
exception
  when unique_violation then
    raise exception 'stock_count_already_open' using errcode = '23514';
end
$$;

create or replace function app.record_stock_count(
  p_organization uuid,
  p_count uuid,
  p_product uuid,
  p_quantity numeric,
  p_mode text default 'increment'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.stock_counts%rowtype;
  v_line public.stock_count_lines%rowtype;
  v_serialized boolean;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_mode not in ('increment', 'set') then
    raise exception 'invalid_count_mode' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity < 0 or p_quantity > 1000000000 then
    raise exception 'invalid_count_quantity' using errcode = '22023';
  end if;

  select c.*
  into v_count
  from public.stock_counts c
  where c.id = p_count
    and c.organization_id = p_organization
  for update;

  if not found then
    raise exception 'stock_count_not_found' using errcode = 'P0002';
  end if;

  if v_count.status <> 'open' then
    raise exception 'stock_count_not_open' using errcode = '23514';
  end if;

  select p.is_serialized
  into v_serialized
  from public.products p
  where p.id = p_product
    and p.organization_id = p_organization;

  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if v_serialized then
    raise exception 'product_not_countable' using errcode = '23514';
  end if;

  if p_mode = 'increment' then
    insert into public.stock_count_lines (organization_id, count_id, product_id, counted_quantity)
    values (p_organization, p_count, p_product, p_quantity)
    on conflict on constraint stock_count_lines_count_product_key do update
      set counted_quantity = stock_count_lines.counted_quantity + excluded.counted_quantity,
          updated_at = now()
    returning * into v_line;
  else
    insert into public.stock_count_lines (organization_id, count_id, product_id, counted_quantity)
    values (p_organization, p_count, p_product, p_quantity)
    on conflict on constraint stock_count_lines_count_product_key do update
      set counted_quantity = excluded.counted_quantity,
          updated_at = now()
    returning * into v_line;
  end if;

  return jsonb_build_object(
    'lineId', v_line.id,
    'productId', v_line.product_id,
    'countedQuantity', v_line.counted_quantity
  );
end
$$;

create or replace function app.discard_stock_count(
  p_organization uuid,
  p_count uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.stock_counts%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.*
  into v_count
  from public.stock_counts c
  where c.id = p_count
    and c.organization_id = p_organization
  for update;

  if not found then
    raise exception 'stock_count_not_found' using errcode = 'P0002';
  end if;

  if v_count.status <> 'open' then
    raise exception 'stock_count_not_open' using errcode = '23514';
  end if;

  update public.stock_counts
  set status = 'cancelled'
  where id = p_count;

  return jsonb_build_object('countId', p_count, 'status', 'cancelled');
end
$$;

-- Posts one adjustment per non-zero variance. Lines are locked in product order,
-- so two counters posting against the same location cannot deadlock. A count
-- never pushes on-hand below an active reservation.
create or replace function app.post_stock_count(
  p_organization uuid,
  p_count uuid,
  p_idempotency_key text,
  p_fingerprint text
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
  v_count public.stock_counts%rowtype;
  v_line record;
  v_on_hand numeric;
  v_reserved numeric;
  v_delta numeric;
  v_line_count integer := 0;
  v_adjusted integer := 0;
  v_adjustments jsonb := '[]'::jsonb;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'stock_count',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select c.*
  into v_count
  from public.stock_counts c
  where c.id = p_count
    and c.organization_id = p_organization
  for update;

  if not found then
    raise exception 'stock_count_not_found' using errcode = 'P0002';
  end if;

  if v_count.status <> 'open' then
    raise exception 'stock_count_not_open' using errcode = '23514';
  end if;

  select count(*)
  into v_line_count
  from public.stock_count_lines l
  where l.organization_id = p_organization
    and l.count_id = p_count;

  if v_line_count = 0 then
    raise exception 'stock_count_empty' using errcode = '23514';
  end if;

  for v_line in
    select l.product_id, l.counted_quantity
    from public.stock_count_lines l
    where l.organization_id = p_organization
      and l.count_id = p_count
    order by l.product_id
  loop
    v_on_hand := app.lock_stock_balance(
      p_organization,
      v_line.product_id,
      v_count.warehouse_id,
      v_count.location_id
    );
    v_reserved := app.active_reserved(
      p_organization,
      v_line.product_id,
      v_count.warehouse_id,
      v_count.location_id
    );

    if v_line.counted_quantity < v_reserved then
      raise exception 'stock_count_below_reserved' using errcode = '23514';
    end if;

    v_delta := v_line.counted_quantity - v_on_hand;

    if v_delta <> 0 then
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
        actor_id
      )
      values (
        p_organization,
        v_line.product_id,
        v_count.warehouse_id,
        v_count.location_id,
        'adjustment',
        v_delta,
        v_line.counted_quantity,
        'Inventory count',
        'inventory_count',
        p_count,
        v_actor
      );

      update public.stock_balances
      set on_hand = v_line.counted_quantity,
          updated_at = now()
      where organization_id = p_organization
        and product_id = v_line.product_id
        and warehouse_id = v_count.warehouse_id
        and location_id = v_count.location_id;

      v_adjusted := v_adjusted + 1;
      v_adjustments := v_adjustments || jsonb_build_array(
        jsonb_build_object(
          'productId', v_line.product_id,
          'previousOnHand', v_on_hand,
          'countedQuantity', v_line.counted_quantity,
          'delta', v_delta
        )
      );
    end if;
  end loop;

  update public.stock_counts
  set status = 'posted',
      posted_at = now(),
      posted_by = v_actor
  where id = p_count;

  v_existing := jsonb_build_object(
    'countId', p_count,
    'status', 'posted',
    'lineCount', v_line_count,
    'adjustedLines', v_adjusted,
    'adjustments', v_adjustments,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

revoke execute on function app.assign_product_barcode(uuid, uuid) from public;
revoke execute on function app.start_stock_count(uuid, uuid, uuid, text) from public;
revoke execute on function app.record_stock_count(uuid, uuid, uuid, numeric, text) from public;
revoke execute on function app.discard_stock_count(uuid, uuid) from public;
revoke execute on function app.post_stock_count(uuid, uuid, text, text) from public;

grant execute on function app.assign_product_barcode(uuid, uuid) to authenticated;
grant execute on function app.start_stock_count(uuid, uuid, uuid, text) to authenticated;
grant execute on function app.record_stock_count(uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function app.discard_stock_count(uuid, uuid) to authenticated;
grant execute on function app.post_stock_count(uuid, uuid, text, text) to authenticated;
