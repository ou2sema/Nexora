-- Individually tracked units: one row per physical unit with an opaque internal
-- code, for products that need unit-level identity without electronics-specific
-- device statuses or a manufacturer serial number.
--
-- The stock ledger stays the only quantity authority. Receiving a tracked line
-- posts one aggregate receipt and then registers that many unit rows in the same
-- transaction, so a unit is never counted twice.
--
-- Serialized products already get one device per unit and keep using devices;
-- the two tracking modes are mutually exclusive.

create type app.tracked_item_status as enum ('in_stock', 'sold', 'returned', 'lost');

create type app.tracked_item_event_type as enum (
  'received',
  'moved',
  'sold',
  'returned',
  'marked_lost',
  'status_changed'
);

alter table public.products
  add column is_individually_tracked boolean not null default false;

alter table public.products
  add constraint products_single_tracking_mode check (
    not (is_serialized and is_individually_tracked)
  );

create table public.tracked_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  product_id uuid not null,
  -- Server-generated, opaque and Code 128 friendly: 80 random bits as uppercase hex.
  unit_code text not null check (unit_code ~ '^NX[A-F0-9]{20}$'),
  serial_number text check (
    serial_number is null or char_length(btrim(serial_number)) between 1 and 120
  ),
  imei text check (imei is null or imei ~ '^[0-9]{14,17}$'),
  status app.tracked_item_status not null default 'in_stock',
  warehouse_id uuid not null,
  location_id uuid not null,
  purchase_order_id uuid,
  purchase_order_line_id uuid,
  supplier_reference text,
  note text,
  received_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracked_items_organization_id_key unique (organization_id, id),
  constraint tracked_items_org_unit_code_key unique (organization_id, unit_code),
  constraint tracked_items_product_org_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict,
  constraint tracked_items_warehouse_org_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint tracked_items_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict,
  constraint tracked_items_order_fkey
    foreign key (organization_id, purchase_order_id)
    references public.purchase_orders (organization_id, id)
    on delete restrict,
  constraint tracked_items_order_line_fkey
    foreign key (organization_id, purchase_order_line_id)
    references public.purchase_order_lines (organization_id, id)
    on delete restrict
);

create index tracked_items_org_product_idx
  on public.tracked_items (organization_id, product_id);
create index tracked_items_org_status_idx
  on public.tracked_items (organization_id, status);
create index tracked_items_org_location_idx
  on public.tracked_items (organization_id, warehouse_id, location_id);
create index tracked_items_order_idx
  on public.tracked_items (organization_id, purchase_order_id);

create trigger tracked_items_touch_updated_at
before update on public.tracked_items
for each row execute function app.touch_updated_at();

-- A unit can only exist for a product that opted into individual tracking.
create or replace function app.require_individually_tracked_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tracked boolean;
begin
  select p.is_individually_tracked
  into v_tracked
  from public.products p
  where p.id = new.product_id
    and p.organization_id = new.organization_id;

  if v_tracked is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if not v_tracked then
    raise exception 'product_not_individually_tracked' using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger tracked_items_require_tracked_product
before insert or update of product_id on public.tracked_items
for each row execute function app.require_individually_tracked_product();

create table public.tracked_item_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  tracked_item_id uuid not null,
  event_type app.tracked_item_event_type not null,
  status_from app.tracked_item_status,
  status_to app.tracked_item_status,
  warehouse_from uuid,
  location_from uuid,
  warehouse_to uuid,
  location_to uuid,
  note text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tracked_item_events_item_fkey
    foreign key (organization_id, tracked_item_id)
    references public.tracked_items (organization_id, id)
    on delete restrict,
  constraint tracked_item_events_status_check check (
    event_type <> 'status_changed' or (status_from is not null and status_to is not null)
  )
);

create index tracked_item_events_item_idx
  on public.tracked_item_events (organization_id, tracked_item_id, created_at desc);

create or replace function app.prevent_tracked_item_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'tracked_item_history_is_immutable' using errcode = '55000';
end
$$;

create trigger tracked_item_events_immutable
before update or delete on public.tracked_item_events
for each row execute function app.prevent_tracked_item_history_mutation();

alter table public.tracked_items enable row level security;
alter table public.tracked_item_events enable row level security;

create policy tracked_items_select_member on public.tracked_items
for select to authenticated
using (app.is_org_member(organization_id));

create policy tracked_item_events_select_member on public.tracked_item_events
for select to authenticated
using (app.is_org_member(organization_id));

grant select on public.tracked_items to authenticated;
grant select on public.tracked_item_events to authenticated;

-- Receives units against a purchase order. Non-serialized lines post a ledger
-- receipt; serialized lines register one device per received unit at the
-- order's destination and post no quantity movement; individually tracked lines
-- post one aggregate receipt and register one tracked item per unit.
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
  v_tracked_item_id uuid;
  v_unit_code text;
  v_serial_json jsonb;
  v_tracked_items jsonb := '[]'::jsonb;
  v_index integer;
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
      p.is_individually_tracked,
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
    elsif v_item.is_individually_tracked then
      if v_item.receive_quantity <> round(v_item.receive_quantity) then
        raise exception 'tracked_item_quantity_must_be_whole' using errcode = '23514';
      end if;

      if v_item.serials is not null then
        if jsonb_typeof(v_item.serials) <> 'array'
          or jsonb_array_length(v_item.serials) <> v_item.receive_quantity then
          raise exception 'serial_count_mismatch' using errcode = '23514';
        end if;

        if exists (
          select 1
          from jsonb_array_elements(v_item.serials) s
          where jsonb_typeof(s) <> 'object'
            or (s->>'serialNumber') is null
            or char_length(btrim(s->>'serialNumber')) not between 1 and 120
            or ((s->>'imei') is not null and (s->>'imei') !~ '^[0-9]{14,17}$')
        ) then
          raise exception 'invalid_serial_number' using errcode = '22023';
        end if;
      end if;

      for v_index in 1..v_item.receive_quantity::integer loop
        v_serial_json := case
          when v_item.serials is null then null
          else v_item.serials->(v_index - 1)
        end;

        loop
          v_unit_code := 'NX' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

          begin
            insert into public.tracked_items (
              organization_id,
              product_id,
              unit_code,
              serial_number,
              imei,
              status,
              warehouse_id,
              location_id,
              purchase_order_id,
              purchase_order_line_id,
              supplier_reference,
              note,
              created_by
            )
            values (
              p_organization,
              v_item.product_id,
              v_unit_code,
              nullif(btrim(coalesce(v_serial_json->>'serialNumber', '')), ''),
              nullif(btrim(coalesce(v_serial_json->>'imei', '')), ''),
              'in_stock',
              v_order.warehouse_id,
              v_order.location_id,
              v_order.id,
              v_item.line_id,
              v_order.number,
              nullif(btrim(coalesce(p_note, '')), ''),
              v_actor
            )
            returning id into v_tracked_item_id;

            exit;
          exception when unique_violation then
            -- An 80-bit unit code collided; draw another before giving up.
          end;
        end loop;

        insert into public.tracked_item_events (
          organization_id,
          tracked_item_id,
          event_type,
          status_to,
          warehouse_to,
          location_to,
          note,
          actor_id
        )
        values (
          p_organization,
          v_tracked_item_id,
          'received',
          'in_stock',
          v_order.warehouse_id,
          v_order.location_id,
          'Received on ' || v_order.number,
          v_actor
        );

        v_tracked_items := v_tracked_items || jsonb_build_array(jsonb_build_object(
          'id', v_tracked_item_id,
          'productId', v_item.product_id,
          'lineId', v_item.line_id,
          'unitCode', v_unit_code,
          'serialNumber', v_serial_json->>'serialNumber',
          'imei', v_serial_json->>'imei'
        ));
      end loop;

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
    'trackedItems', v_tracked_items,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;
