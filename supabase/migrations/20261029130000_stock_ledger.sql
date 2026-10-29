-- Immutable stock ledger, balance projections, reservations, and idempotent
-- posting functions. The ledger is the source of truth; stock_balances is a
-- projection that can be rebuilt from it. Application roles can read but never
-- write these tables directly: every stock change goes through a SECURITY
-- DEFINER function that authorizes the caller and runs atomically.

create type app.stock_movement_type as enum (
  'receipt',
  'issue',
  'adjustment',
  'transfer_out',
  'transfer_in'
);

create type app.reservation_status as enum ('active', 'released', 'fulfilled', 'expired');

create type app.stock_reference_type as enum (
  'manual',
  'purchase_order',
  'outgoing_order',
  'transfer',
  'reservation',
  'adjustment',
  'inventory_count'
);

-- A stock line is identified by product + warehouse + location. Locations were
-- only unique per organization; the ledger needs the warehouse in the key so a
-- location can never be paired with the wrong warehouse.
alter table public.storage_locations
  add constraint storage_locations_org_warehouse_id_key
  unique (organization_id, warehouse_id, id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  product_id uuid not null,
  warehouse_id uuid not null,
  location_id uuid not null,
  movement_type app.stock_movement_type not null,
  quantity_delta numeric(18, 4) not null check (quantity_delta <> 0),
  on_hand_after numeric(18, 4) not null check (on_hand_after >= 0),
  reason text,
  reference_type app.stock_reference_type not null default 'manual',
  reference_id uuid,
  transfer_id uuid,
  reservation_id uuid,
  actor_id uuid references auth.users (id) on delete set null,
  correlation_id text,
  created_at timestamptz not null default now(),
  constraint stock_movements_product_org_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict,
  constraint stock_movements_warehouse_org_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint stock_movements_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict,
  constraint stock_movements_sign_check check (
    (movement_type in ('receipt', 'transfer_in') and quantity_delta > 0)
    or (movement_type in ('issue', 'transfer_out') and quantity_delta < 0)
    or (movement_type = 'adjustment' and quantity_delta <> 0)
  ),
  constraint stock_movements_transfer_check check (
    (movement_type in ('transfer_out', 'transfer_in') and transfer_id is not null)
    or (movement_type not in ('transfer_out', 'transfer_in') and transfer_id is null)
  ),
  constraint stock_movements_adjustment_reason_check check (
    movement_type <> 'adjustment'
    or (reason is not null and char_length(btrim(reason)) >= 3)
  )
);

create index stock_movements_org_created_idx
  on public.stock_movements (organization_id, created_at desc);
create index stock_movements_org_product_created_idx
  on public.stock_movements (organization_id, product_id, created_at desc);
create index stock_movements_transfer_idx
  on public.stock_movements (transfer_id)
  where transfer_id is not null;
create index stock_movements_reference_idx
  on public.stock_movements (organization_id, reference_type, reference_id)
  where reference_id is not null;

create table public.stock_balances (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null,
  warehouse_id uuid not null,
  location_id uuid not null,
  on_hand numeric(18, 4) not null default 0 check (on_hand >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, product_id, warehouse_id, location_id),
  constraint stock_balances_product_org_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete cascade,
  constraint stock_balances_warehouse_org_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete cascade,
  constraint stock_balances_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete cascade
);

create index stock_balances_org_product_idx on public.stock_balances (organization_id, product_id);
create index stock_balances_org_warehouse_idx
  on public.stock_balances (organization_id, warehouse_id);

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null,
  warehouse_id uuid not null,
  location_id uuid not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  status app.reservation_status not null default 'active',
  reference_type app.stock_reference_type not null default 'manual',
  reference_id uuid,
  note text,
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users (id) on delete set null,
  constraint stock_reservations_organization_id_key unique (organization_id, id),
  constraint stock_reservations_product_org_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete cascade,
  constraint stock_reservations_warehouse_org_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete cascade,
  constraint stock_reservations_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete cascade,
  constraint stock_reservations_release_check check (
    (status = 'active' and released_at is null)
    or (status = 'released' and released_at is not null)
    or (status = 'fulfilled' and released_at is not null)
    or (status = 'expired' and released_at is not null)
  )
);

create index stock_reservations_active_idx
  on public.stock_reservations (organization_id, product_id, warehouse_id, location_id)
  where status = 'active';
create index stock_reservations_reference_idx
  on public.stock_reservations (organization_id, reference_type, reference_id)
  where reference_id is not null;

create trigger stock_reservations_touch_updated_at
before update on public.stock_reservations
for each row execute function app.touch_updated_at();

-- Idempotency: a retried request returns the original outcome instead of
-- posting a second movement. The row is written in the same transaction as the
-- stock change, so a rollback also forgets the claim.
create table public.stock_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  operation text not null check (
    operation in ('receipt', 'issue', 'adjustment', 'transfer', 'reservation', 'reservation_release')
  ),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response jsonb not null default '{}'::jsonb check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  constraint stock_operations_org_key_key unique (organization_id, idempotency_key)
);

create index stock_operations_created_idx on public.stock_operations (organization_id, created_at desc);

-- Ledger rows are append-only. The owner of the table can still disable this
-- trigger during a documented maintenance operation, but no application role
-- has UPDATE or DELETE privileges at all.
create or replace function app.prevent_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_ledger_is_immutable' using errcode = '55000';
end
$$;

create trigger stock_movements_immutable
before update or delete on public.stock_movements
for each row execute function app.prevent_ledger_mutation();

alter table public.stock_movements enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.stock_operations enable row level security;

create policy stock_movements_select_member on public.stock_movements
for select to authenticated
using (app.is_org_member(organization_id));

create policy stock_balances_select_member on public.stock_balances
for select to authenticated
using (app.is_org_member(organization_id));

create policy stock_reservations_select_member on public.stock_reservations
for select to authenticated
using (app.is_org_member(organization_id));

create policy stock_operations_select_member on public.stock_operations
for select to authenticated
using (app.is_org_member(organization_id));

grant select on public.stock_movements to authenticated;
grant select on public.stock_balances to authenticated;
grant select on public.stock_reservations to authenticated;
grant select on public.stock_operations to authenticated;

-- Creates the balance row if needed, then locks it. Every function that
-- changes a stock line calls this first, which serializes concurrent writers on
-- the same line without relying on application-level locks.
create or replace function app.lock_stock_balance(
  p_organization uuid,
  p_product uuid,
  p_warehouse uuid,
  p_location uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on_hand numeric;
begin
  insert into public.stock_balances (organization_id, product_id, warehouse_id, location_id, on_hand)
  values (p_organization, p_product, p_warehouse, p_location, 0)
  on conflict (organization_id, product_id, warehouse_id, location_id) do nothing;

  select b.on_hand
  into v_on_hand
  from public.stock_balances b
  where b.organization_id = p_organization
    and b.product_id = p_product
    and b.warehouse_id = p_warehouse
    and b.location_id = p_location
  for update;

  return v_on_hand;
end
$$;

create or replace function app.active_reserved(
  p_organization uuid,
  p_product uuid,
  p_warehouse uuid,
  p_location uuid,
  p_exclude_reservation uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(r.quantity), 0)
  from public.stock_reservations r
  where r.organization_id = p_organization
    and r.product_id = p_product
    and r.warehouse_id = p_warehouse
    and r.location_id = p_location
    and r.status = 'active'
    and (p_exclude_reservation is null or r.id <> p_exclude_reservation)
$$;

-- Claims an idempotency key or reports the original result. A concurrent
-- duplicate blocks on the unique index until the first transaction commits, so
-- it always sees either the final response or no row at all.
create or replace function app.claim_stock_operation(
  p_organization uuid,
  p_key text,
  p_operation text,
  p_fingerprint text
)
returns table (operation_id uuid, existing_response jsonb, is_duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stock_operations%rowtype;
begin
  if p_key is null or char_length(p_key) < 8 or char_length(p_key) > 120 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_request_fingerprint' using errcode = '22023';
  end if;

  insert into public.stock_operations as o (organization_id, idempotency_key, operation, request_fingerprint)
  values (p_organization, p_key, p_operation, p_fingerprint)
  on conflict on constraint stock_operations_org_key_key do nothing
  returning o.* into v_row;

  if v_row.id is not null then
    return query select v_row.id, null::jsonb, false;
    return;
  end if;

  select o.*
  into v_row
  from public.stock_operations o
  where o.organization_id = p_organization
    and o.idempotency_key = p_key;

  if v_row.operation <> p_operation or v_row.request_fingerprint <> p_fingerprint then
    raise exception 'idempotency_key_conflict' using errcode = '23505';
  end if;

  return query select v_row.id, v_row.response, true;
end
$$;

-- Single-line receipt, issue (optionally fulfilling a reservation), and
-- adjustment. Transfers must use app.post_stock_transfer so both legs share one
-- atomic transaction.
create or replace function app.post_stock_movement(
  p_organization uuid,
  p_product uuid,
  p_warehouse uuid,
  p_location uuid,
  p_type app.stock_movement_type,
  p_quantity numeric,
  p_idempotency_key text,
  p_fingerprint text,
  p_reason text default null,
  p_reference_type app.stock_reference_type default 'manual',
  p_reference_id uuid default null,
  p_reservation_id uuid default null,
  p_correlation_id text default null
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
  v_delta numeric;
  v_on_hand numeric;
  v_reserved numeric;
  v_available numeric;
  v_new_on_hand numeric;
  v_movement_id uuid;
  v_reservation public.stock_reservations%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_type not in ('receipt', 'issue', 'adjustment') then
    raise exception 'use_transfer_function' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <> round(p_quantity, 4) then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  if p_type = 'adjustment' then
    if p_quantity = 0 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;

    if p_reason is null or char_length(btrim(p_reason)) < 3 then
      raise exception 'adjustment_requires_reason' using errcode = '22023';
    end if;

    v_delta := p_quantity;
  else
    if p_quantity <= 0 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;

    v_delta := case p_type when 'receipt' then p_quantity else -p_quantity end;
  end if;

  if p_reservation_id is not null and p_type <> 'issue' then
    raise exception 'reservation_requires_issue' using errcode = '22023';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    p_type::text,
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

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
  )
  returning id into v_movement_id;

  v_existing := jsonb_build_object(
    'movementId', v_movement_id,
    'onHand', v_new_on_hand,
    'available', v_new_on_hand - v_reserved,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

-- Moves stock between two locations atomically. Both balance rows are locked in
-- a deterministic order so concurrent transfers in opposite directions cannot
-- deadlock.
create or replace function app.post_stock_transfer(
  p_organization uuid,
  p_product uuid,
  p_source_warehouse uuid,
  p_source_location uuid,
  p_target_warehouse uuid,
  p_target_location uuid,
  p_quantity numeric,
  p_reason text,
  p_idempotency_key text,
  p_fingerprint text,
  p_correlation_id text default null
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
  v_transfer_id uuid := gen_random_uuid();
  v_source_on_hand numeric;
  v_target_on_hand numeric;
  v_source_new numeric;
  v_target_new numeric;
  v_reserved numeric;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 4) then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  if p_source_warehouse = p_target_warehouse and p_source_location = p_target_location then
    raise exception 'transfer_requires_distinct_locations' using errcode = '22023';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(p_organization, p_idempotency_key, 'transfer', p_fingerprint) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  if (p_source_warehouse::text, p_source_location::text)
    < (p_target_warehouse::text, p_target_location::text) then
    v_source_on_hand := app.lock_stock_balance(p_organization, p_product, p_source_warehouse, p_source_location);
    v_target_on_hand := app.lock_stock_balance(p_organization, p_product, p_target_warehouse, p_target_location);
  else
    v_target_on_hand := app.lock_stock_balance(p_organization, p_product, p_target_warehouse, p_target_location);
    v_source_on_hand := app.lock_stock_balance(p_organization, p_product, p_source_warehouse, p_source_location);
  end if;

  v_reserved := app.active_reserved(p_organization, p_product, p_source_warehouse, p_source_location);

  if v_source_on_hand - p_quantity < 0 then
    raise exception 'insufficient_stock' using errcode = '23514';
  end if;

  if v_source_on_hand - v_reserved - p_quantity < 0 then
    raise exception 'stock_reserved' using errcode = '23514';
  end if;

  update public.stock_balances
  set on_hand = on_hand - p_quantity,
      updated_at = now()
  where organization_id = p_organization
    and product_id = p_product
    and warehouse_id = p_source_warehouse
    and location_id = p_source_location
  returning on_hand into v_source_new;

  update public.stock_balances
  set on_hand = on_hand + p_quantity,
      updated_at = now()
  where organization_id = p_organization
    and product_id = p_product
    and warehouse_id = p_target_warehouse
    and location_id = p_target_location
  returning on_hand into v_target_new;

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
    transfer_id,
    actor_id,
    correlation_id
  )
  values
    (
      p_organization,
      p_product,
      p_source_warehouse,
      p_source_location,
      'transfer_out',
      -p_quantity,
      v_source_new,
      nullif(btrim(coalesce(p_reason, '')), ''),
      'transfer',
      v_transfer_id,
      v_actor,
      p_correlation_id
    ),
    (
      p_organization,
      p_product,
      p_target_warehouse,
      p_target_location,
      'transfer_in',
      p_quantity,
      v_target_new,
      nullif(btrim(coalesce(p_reason, '')), ''),
      'transfer',
      v_transfer_id,
      v_actor,
      p_correlation_id
    );

  v_existing := jsonb_build_object(
    'transferId', v_transfer_id,
    'quantity', p_quantity,
    'sourceOnHand', v_source_new,
    'targetOnHand', v_target_new,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

-- Reserves physical stock without moving it. Available = on_hand - active
-- reservations; a reservation can never exceed available stock.
create or replace function app.reserve_stock(
  p_organization uuid,
  p_product uuid,
  p_warehouse uuid,
  p_location uuid,
  p_quantity numeric,
  p_idempotency_key text,
  p_fingerprint text,
  p_expires_at timestamptz default null,
  p_reference_type app.stock_reference_type default 'manual',
  p_reference_id uuid default null,
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
  v_on_hand numeric;
  v_reserved numeric;
  v_available numeric;
  v_reservation_id uuid;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 4) then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(p_organization, p_idempotency_key, 'reservation', p_fingerprint) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  v_on_hand := app.lock_stock_balance(p_organization, p_product, p_warehouse, p_location);
  v_reserved := app.active_reserved(p_organization, p_product, p_warehouse, p_location);
  v_available := v_on_hand - v_reserved;

  if v_available < p_quantity then
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
    note,
    expires_at,
    created_by
  )
  values (
    p_organization,
    p_product,
    p_warehouse,
    p_location,
    p_quantity,
    p_reference_type,
    p_reference_id,
    nullif(btrim(coalesce(p_note, '')), ''),
    p_expires_at,
    v_actor
  )
  returning id into v_reservation_id;

  v_existing := jsonb_build_object(
    'reservationId', v_reservation_id,
    'quantity', p_quantity,
    'reserved', v_reserved + p_quantity,
    'available', v_available - p_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.release_stock_reservation(
  p_organization uuid,
  p_reservation_id uuid,
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
  v_status app.reservation_status;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'reservation_release',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select r.status
  into v_status
  from public.stock_reservations r
  where r.id = p_reservation_id
    and r.organization_id = p_organization
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if v_status = 'fulfilled' then
    raise exception 'reservation_already_fulfilled' using errcode = '23514';
  end if;

  if v_status = 'active' then
    update public.stock_reservations
    set status = 'released',
        released_at = now(),
        released_by = v_actor
    where id = p_reservation_id;

    v_status := 'released';
  end if;

  v_existing := jsonb_build_object(
    'reservationId', p_reservation_id,
    'status', v_status,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.expire_stock_reservations(p_organization uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_user_id();
  v_count integer;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.stock_reservations
  set status = 'expired',
      released_at = now(),
      released_by = v_actor
  where organization_id = p_organization
    and status = 'active'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Read model used by the dashboards: physical, reserved, and available units
-- per stock line. security_invoker keeps the caller's RLS in force.
create view public.stock_levels
with (security_invoker = true)
as
select
  b.organization_id,
  b.product_id,
  p.sku,
  p.name as product_name,
  p.status as product_status,
  b.warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,
  b.location_id,
  l.code as location_code,
  b.on_hand,
  coalesce(r.reserved, 0)::numeric(18, 4) as reserved,
  (b.on_hand - coalesce(r.reserved, 0))::numeric(18, 4) as available,
  b.updated_at
from public.stock_balances b
join public.products p
  on p.id = b.product_id and p.organization_id = b.organization_id
join public.warehouses w
  on w.id = b.warehouse_id and w.organization_id = b.organization_id
join public.storage_locations l
  on l.id = b.location_id
  and l.organization_id = b.organization_id
  and l.warehouse_id = b.warehouse_id
left join (
  select
    r.organization_id,
    r.product_id,
    r.warehouse_id,
    r.location_id,
    sum(r.quantity) as reserved
  from public.stock_reservations r
  where r.status = 'active'
  group by r.organization_id, r.product_id, r.warehouse_id, r.location_id
) r
  on r.organization_id = b.organization_id
  and r.product_id = b.product_id
  and r.warehouse_id = b.warehouse_id
  and r.location_id = b.location_id;

grant select on public.stock_levels to authenticated;

-- Compares the projection with the ledger. Any row here means the projection is
-- wrong; historical movements are never changed to hide the difference.
create or replace function app.stock_reconciliation(p_organization uuid)
returns table (
  product_id uuid,
  warehouse_id uuid,
  location_id uuid,
  balance_on_hand numeric,
  ledger_on_hand numeric,
  difference numeric,
  movement_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    coalesce(b.product_id, l.product_id),
    coalesce(b.warehouse_id, l.warehouse_id),
    coalesce(b.location_id, l.location_id),
    coalesce(b.on_hand, 0),
    coalesce(l.on_hand, 0),
    coalesce(b.on_hand, 0) - coalesce(l.on_hand, 0),
    coalesce(l.movement_count, 0)
  from (
    select *
    from public.stock_balances
    where organization_id = p_organization
  ) b
  full join (
    select
      m.product_id,
      m.warehouse_id,
      m.location_id,
      sum(m.quantity_delta)::numeric(18, 4) as on_hand,
      count(*) as movement_count
    from public.stock_movements m
    where m.organization_id = p_organization
    group by m.product_id, m.warehouse_id, m.location_id
  ) l
    on l.product_id = b.product_id
    and l.warehouse_id = b.warehouse_id
    and l.location_id = b.location_id
  order by coalesce(b.product_id, l.product_id), coalesce(b.warehouse_id, l.warehouse_id);
end
$$;

-- Rebuilds the projection from the ledger. Movements stay untouched; only
-- stock_balances is corrected. Dry runs report what would change.
create or replace function app.repair_stock_balances(
  p_organization uuid,
  p_dry_run boolean default true
)
returns table (
  product_id uuid,
  warehouse_id uuid,
  location_id uuid,
  previous_on_hand numeric,
  ledger_on_hand numeric,
  repaired boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row record;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_row in
    select r.product_id, r.warehouse_id, r.location_id, r.balance_on_hand, r.ledger_on_hand
    from app.stock_reconciliation(p_organization) r
    where r.difference <> 0
  loop
    if not p_dry_run then
      insert into public.stock_balances (
        organization_id,
        product_id,
        warehouse_id,
        location_id,
        on_hand,
        updated_at
      )
      values (
        p_organization,
        v_row.product_id,
        v_row.warehouse_id,
        v_row.location_id,
        v_row.ledger_on_hand,
        now()
      )
      on conflict (organization_id, product_id, warehouse_id, location_id)
      do update set on_hand = excluded.on_hand, updated_at = excluded.updated_at;
    end if;

    product_id := v_row.product_id;
    warehouse_id := v_row.warehouse_id;
    location_id := v_row.location_id;
    previous_on_hand := v_row.balance_on_hand;
    ledger_on_hand := v_row.ledger_on_hand;
    repaired := not p_dry_run;
    return next;
  end loop;
end
$$;

revoke execute on function app.lock_stock_balance(uuid, uuid, uuid, uuid) from public;
revoke execute on function app.active_reserved(uuid, uuid, uuid, uuid, uuid) from public;
revoke execute on function app.claim_stock_operation(uuid, text, text, text) from public;
revoke execute on function app.post_stock_movement(
  uuid, uuid, uuid, uuid, app.stock_movement_type, numeric, text, text, text,
  app.stock_reference_type, uuid, uuid, text
) from public;
revoke execute on function app.post_stock_transfer(
  uuid, uuid, uuid, uuid, uuid, uuid, numeric, text, text, text, text
) from public;
revoke execute on function app.reserve_stock(
  uuid, uuid, uuid, uuid, numeric, text, text, timestamptz,
  app.stock_reference_type, uuid, text
) from public;
revoke execute on function app.release_stock_reservation(uuid, uuid, text, text) from public;
revoke execute on function app.expire_stock_reservations(uuid) from public;
revoke execute on function app.stock_reconciliation(uuid) from public;
revoke execute on function app.repair_stock_balances(uuid, boolean) from public;

grant execute on function app.post_stock_movement(
  uuid, uuid, uuid, uuid, app.stock_movement_type, numeric, text, text, text,
  app.stock_reference_type, uuid, uuid, text
) to authenticated;
grant execute on function app.post_stock_transfer(
  uuid, uuid, uuid, uuid, uuid, uuid, numeric, text, text, text, text
) to authenticated;
grant execute on function app.reserve_stock(
  uuid, uuid, uuid, uuid, numeric, text, text, timestamptz,
  app.stock_reference_type, uuid, text
) to authenticated;
grant execute on function app.release_stock_reservation(uuid, uuid, text, text) to authenticated;
grant execute on function app.expire_stock_reservations(uuid) to authenticated;
grant execute on function app.stock_reconciliation(uuid) to authenticated;
grant execute on function app.repair_stock_balances(uuid, boolean) to authenticated;
