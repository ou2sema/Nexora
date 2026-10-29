-- Serialized devices: one row per physical unit with a unique identity, plus an
-- append-only event history. Devices belong to serialized products; the ledger
-- still owns quantities, while this table owns identity and lifecycle.

create type app.device_status as enum (
  'in_stock',
  'reserved',
  'sold',
  'returned',
  'in_repair',
  'lost',
  'disposed'
);

create type app.device_condition as enum ('new', 'used', 'refurbished', 'damaged', 'defective');

create type app.device_event_type as enum (
  'registered',
  'moved',
  'reserved',
  'released',
  'issued',
  'returned',
  'repair_started',
  'repair_completed',
  'marked_lost',
  'disposed',
  'status_changed'
);

-- Device lifecycle operations reuse the idempotency store; widen its operation
-- vocabulary to include the device workflows.
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
      'device_move'
    )
  );

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  product_id uuid not null,
  serial_number text not null check (char_length(btrim(serial_number)) between 1 and 120),
  imei text check (imei is null or imei ~ '^[0-9]{14,17}$'),
  condition app.device_condition not null default 'new',
  status app.device_status not null default 'in_stock',
  warehouse_id uuid not null,
  location_id uuid not null,
  warranty_start_on date,
  warranty_end_on date,
  supplier_reference text,
  note text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  received_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_organization_id_key unique (organization_id, id),
  constraint devices_product_org_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict,
  constraint devices_warehouse_org_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint devices_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict,
  constraint devices_warranty_check check (
    warranty_start_on is null
    or warranty_end_on is null
    or warranty_end_on >= warranty_start_on
  )
);

create unique index devices_org_serial_key on public.devices (organization_id, lower(serial_number));
create unique index devices_org_imei_key on public.devices (organization_id, imei)
  where imei is not null;
create index devices_org_status_idx on public.devices (organization_id, status);
create index devices_org_product_idx on public.devices (organization_id, product_id);
create index devices_org_warehouse_idx on public.devices (organization_id, warehouse_id, location_id);

create trigger devices_touch_updated_at
before update on public.devices
for each row execute function app.touch_updated_at();

-- A device can only exist for a product flagged as serialized.
create or replace function app.require_serialized_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_serialized boolean;
begin
  select p.is_serialized
  into v_serialized
  from public.products p
  where p.id = new.product_id
    and p.organization_id = new.organization_id;

  if v_serialized is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if not v_serialized then
    raise exception 'product_not_serialized' using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger devices_require_serialized_product
before insert or update of product_id on public.devices
for each row execute function app.require_serialized_product();

create table public.device_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  device_id uuid not null,
  event_type app.device_event_type not null,
  status_from app.device_status,
  status_to app.device_status,
  warehouse_from uuid,
  location_from uuid,
  warehouse_to uuid,
  location_to uuid,
  note text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint device_events_device_fkey
    foreign key (organization_id, device_id)
    references public.devices (organization_id, id)
    on delete restrict,
  constraint device_events_status_check check (
    event_type <> 'status_changed' or (status_from is not null and status_to is not null)
  )
);

create index device_events_device_idx on public.device_events (organization_id, device_id, created_at desc);

create or replace function app.prevent_device_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'device_history_is_immutable' using errcode = '55000';
end
$$;

create trigger device_events_immutable
before update or delete on public.device_events
for each row execute function app.prevent_device_history_mutation();

alter table public.devices enable row level security;
alter table public.device_events enable row level security;

create policy devices_select_member on public.devices
for select to authenticated
using (app.is_org_member(organization_id));

create policy device_events_select_member on public.device_events
for select to authenticated
using (app.is_org_member(organization_id));

grant select on public.devices to authenticated;
grant select on public.device_events to authenticated;

create or replace function app.device_transition_allowed(
  p_from app.device_status,
  p_to app.device_status
)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'in_stock' then p_to in ('reserved', 'sold', 'in_repair', 'lost', 'disposed')
    when 'reserved' then p_to in ('in_stock', 'sold', 'lost')
    when 'in_repair' then p_to in ('in_stock', 'disposed', 'lost')
    when 'sold' then p_to = 'returned'
    when 'returned' then p_to in ('in_stock', 'in_repair', 'disposed')
    when 'lost' then p_to in ('in_stock', 'disposed')
    else false
  end
$$;

create or replace function app.device_event_for_transition(
  p_from app.device_status,
  p_to app.device_status
)
returns app.device_event_type
language sql
immutable
as $$
  select case
    when p_to = 'reserved' then 'reserved'::app.device_event_type
    when p_to = 'in_stock' and p_from = 'reserved' then 'released'
    when p_to = 'sold' then 'issued'
    when p_to = 'returned' then 'returned'
    when p_to = 'in_repair' then 'repair_started'
    when p_to = 'in_stock' and p_from = 'in_repair' then 'repair_completed'
    when p_to = 'lost' then 'marked_lost'
    when p_to = 'disposed' then 'disposed'
    else 'status_changed'
  end::app.device_event_type
$$;

create or replace function app.register_device(
  p_organization uuid,
  p_product uuid,
  p_serial_number text,
  p_idempotency_key text,
  p_fingerprint text,
  p_imei text default null,
  p_condition app.device_condition default 'new',
  p_warehouse uuid default null,
  p_location uuid default null,
  p_warranty_start date default null,
  p_warranty_end date default null,
  p_supplier_reference text default null,
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
  v_device_id uuid;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_serial_number is null
    or char_length(btrim(p_serial_number)) < 1
    or char_length(btrim(p_serial_number)) > 120 then
    raise exception 'invalid_serial_number' using errcode = '22023';
  end if;

  if p_warehouse is null or p_location is null then
    raise exception 'device_location_required' using errcode = '22023';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'device_registration',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
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
    warranty_start_on,
    warranty_end_on,
    supplier_reference,
    note,
    created_by
  )
  values (
    p_organization,
    p_product,
    btrim(p_serial_number),
    nullif(btrim(coalesce(p_imei, '')), ''),
    p_condition,
    'in_stock',
    p_warehouse,
    p_location,
    p_warranty_start,
    p_warranty_end,
    nullif(btrim(coalesce(p_supplier_reference, '')), ''),
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
    p_warehouse,
    p_location,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor
  );

  v_existing := jsonb_build_object(
    'deviceId', v_device_id,
    'serialNumber', btrim(p_serial_number),
    'status', 'in_stock',
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.change_device_status(
  p_organization uuid,
  p_device uuid,
  p_status app.device_status,
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
  v_from app.device_status;
  v_event app.device_event_type;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'device_status',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select d.status
  into v_from
  from public.devices d
  where d.id = p_device
    and d.organization_id = p_organization
  for update;

  if not found then
    raise exception 'device_not_found' using errcode = 'P0002';
  end if;

  if v_from = p_status then
    raise exception 'device_status_unchanged' using errcode = '23514';
  end if;

  if not app.device_transition_allowed(v_from, p_status) then
    raise exception 'device_transition_not_allowed' using errcode = '23514';
  end if;

  v_event := app.device_event_for_transition(v_from, p_status);

  update public.devices
  set status = p_status
  where id = p_device;

  insert into public.device_events (
    organization_id,
    device_id,
    event_type,
    status_from,
    status_to,
    note,
    actor_id
  )
  values (
    p_organization,
    p_device,
    v_event,
    v_from,
    p_status,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor
  );

  v_existing := jsonb_build_object(
    'deviceId', p_device,
    'status', p_status,
    'previousStatus', v_from,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.move_device(
  p_organization uuid,
  p_device uuid,
  p_warehouse uuid,
  p_location uuid,
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
  v_status app.device_status;
  v_warehouse uuid;
  v_location uuid;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'device_move',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select d.status, d.warehouse_id, d.location_id
  into v_status, v_warehouse, v_location
  from public.devices d
  where d.id = p_device
    and d.organization_id = p_organization
  for update;

  if not found then
    raise exception 'device_not_found' using errcode = 'P0002';
  end if;

  if v_status = 'disposed' then
    raise exception 'device_disposed' using errcode = '23514';
  end if;

  if v_status = 'sold' then
    raise exception 'device_already_sold' using errcode = '23514';
  end if;

  if v_warehouse = p_warehouse and v_location = p_location then
    raise exception 'device_location_unchanged' using errcode = '23514';
  end if;

  update public.devices
  set warehouse_id = p_warehouse,
      location_id = p_location
  where id = p_device;

  insert into public.device_events (
    organization_id,
    device_id,
    event_type,
    warehouse_from,
    location_from,
    warehouse_to,
    location_to,
    note,
    actor_id
  )
  values (
    p_organization,
    p_device,
    'moved',
    v_warehouse,
    v_location,
    p_warehouse,
    p_location,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor
  );

  v_existing := jsonb_build_object(
    'deviceId', p_device,
    'warehouseId', p_warehouse,
    'locationId', p_location,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

revoke execute on function app.require_serialized_product() from public;
revoke execute on function app.device_transition_allowed(app.device_status, app.device_status) from public;
revoke execute on function app.device_event_for_transition(app.device_status, app.device_status) from public;
revoke execute on function app.register_device(
  uuid, uuid, text, text, text, text, app.device_condition, uuid, uuid, date, date, text, text
) from public;
revoke execute on function app.change_device_status(uuid, uuid, app.device_status, text, text, text) from public;
revoke execute on function app.move_device(uuid, uuid, uuid, uuid, text, text, text) from public;

grant execute on function app.register_device(
  uuid, uuid, text, text, text, text, app.device_condition, uuid, uuid, date, date, text, text
) to authenticated;
grant execute on function app.change_device_status(uuid, uuid, app.device_status, text, text, text) to authenticated;
grant execute on function app.move_device(uuid, uuid, uuid, uuid, text, text, text) to authenticated;
