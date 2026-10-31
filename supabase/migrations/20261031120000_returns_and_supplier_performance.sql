-- Returns: goods going back to a supplier after receipt, and customer goods
-- coming back into stock after fulfilment. Both are documents whose posting
-- writes ledger movements through app.operations_apply_stock, so the
-- negative-stock and reservation protections of Phase 3 still hold. Supplier
-- performance is derived from these tables at query time; nothing is cached.

alter type app.stock_reference_type add value if not exists 'purchase_return';
alter type app.stock_reference_type add value if not exists 'sales_return';
alter type app.document_kind add value if not exists 'purchase_return';
alter type app.document_kind add value if not exists 'sales_return';

create type app.return_status as enum ('draft', 'posted', 'cancelled');

create table public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number text not null,
  purchase_order_id uuid not null,
  supplier_id uuid not null,
  warehouse_id uuid not null,
  location_id uuid not null,
  status app.return_status not null default 'draft',
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  reference text,
  posted_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_returns_organization_id_key unique (organization_id, id),
  constraint purchase_returns_number_key unique (organization_id, number),
  constraint purchase_returns_order_fkey
    foreign key (organization_id, purchase_order_id)
    references public.purchase_orders (organization_id, id)
    on delete restrict,
  constraint purchase_returns_supplier_fkey
    foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id)
    on delete restrict,
  constraint purchase_returns_warehouse_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint purchase_returns_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict,
  constraint purchase_returns_status_check check (
    (status = 'posted') = (posted_at is not null)
    and (status = 'cancelled') = (cancelled_at is not null)
  )
);

create index purchase_returns_org_created_idx
  on public.purchase_returns (organization_id, created_at desc);
create index purchase_returns_order_idx
  on public.purchase_returns (organization_id, purchase_order_id);

create trigger purchase_returns_touch_updated_at
before update on public.purchase_returns
for each row execute function app.touch_updated_at();

create table public.purchase_return_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  purchase_return_id uuid not null,
  purchase_order_line_id uuid not null,
  product_id uuid not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_return_lines_organization_id_key unique (organization_id, id),
  constraint purchase_return_lines_line_key unique (purchase_return_id, purchase_order_line_id),
  constraint purchase_return_lines_return_fkey
    foreign key (organization_id, purchase_return_id)
    references public.purchase_returns (organization_id, id)
    on delete cascade,
  constraint purchase_return_lines_order_line_fkey
    foreign key (organization_id, purchase_order_line_id)
    references public.purchase_order_lines (organization_id, id)
    on delete restrict,
  constraint purchase_return_lines_product_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict
);

create index purchase_return_lines_return_idx
  on public.purchase_return_lines (organization_id, purchase_return_id);
create index purchase_return_lines_order_line_idx
  on public.purchase_return_lines (organization_id, purchase_order_line_id);

create trigger purchase_return_lines_touch_updated_at
before update on public.purchase_return_lines
for each row execute function app.touch_updated_at();

-- Serialized returns select specific devices. Rows are deleted when a draft is
-- cancelled, so the unique index only blocks two live returns claiming the same
-- unit.
create table public.purchase_return_devices (
  organization_id uuid not null,
  purchase_return_line_id uuid not null,
  device_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (purchase_return_line_id, device_id),
  constraint purchase_return_devices_line_fkey
    foreign key (organization_id, purchase_return_line_id)
    references public.purchase_return_lines (organization_id, id)
    on delete cascade,
  constraint purchase_return_devices_device_fkey
    foreign key (organization_id, device_id)
    references public.devices (organization_id, id)
    on delete restrict
);

create unique index purchase_return_devices_device_key
  on public.purchase_return_devices (organization_id, device_id);

create table public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number text not null,
  sales_order_id uuid not null,
  warehouse_id uuid not null,
  location_id uuid not null,
  status app.return_status not null default 'draft',
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  reference text,
  posted_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_returns_organization_id_key unique (organization_id, id),
  constraint sales_returns_number_key unique (organization_id, number),
  constraint sales_returns_order_fkey
    foreign key (organization_id, sales_order_id)
    references public.sales_orders (organization_id, id)
    on delete restrict,
  constraint sales_returns_warehouse_fkey
    foreign key (organization_id, warehouse_id)
    references public.warehouses (organization_id, id)
    on delete restrict,
  constraint sales_returns_location_fkey
    foreign key (organization_id, warehouse_id, location_id)
    references public.storage_locations (organization_id, warehouse_id, id)
    on delete restrict,
  constraint sales_returns_status_check check (
    (status = 'posted') = (posted_at is not null)
    and (status = 'cancelled') = (cancelled_at is not null)
  )
);

create index sales_returns_org_created_idx
  on public.sales_returns (organization_id, created_at desc);
create index sales_returns_order_idx
  on public.sales_returns (organization_id, sales_order_id);

create trigger sales_returns_touch_updated_at
before update on public.sales_returns
for each row execute function app.touch_updated_at();

create table public.sales_return_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sales_return_id uuid not null,
  sales_order_line_id uuid not null,
  product_id uuid not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_return_lines_organization_id_key unique (organization_id, id),
  constraint sales_return_lines_line_key unique (sales_return_id, sales_order_line_id),
  constraint sales_return_lines_return_fkey
    foreign key (organization_id, sales_return_id)
    references public.sales_returns (organization_id, id)
    on delete cascade,
  constraint sales_return_lines_order_line_fkey
    foreign key (organization_id, sales_order_line_id)
    references public.sales_order_lines (organization_id, id)
    on delete restrict,
  constraint sales_return_lines_product_fkey
    foreign key (organization_id, product_id)
    references public.products (organization_id, id)
    on delete restrict
);

create index sales_return_lines_return_idx
  on public.sales_return_lines (organization_id, sales_return_id);
create index sales_return_lines_order_line_idx
  on public.sales_return_lines (organization_id, sales_order_line_id);

create trigger sales_return_lines_touch_updated_at
before update on public.sales_return_lines
for each row execute function app.touch_updated_at();

-- Return workflows extend the idempotency vocabulary.
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
      'sales_return_cancel'
    )
  );

alter table public.purchase_returns enable row level security;
alter table public.purchase_return_lines enable row level security;
alter table public.purchase_return_devices enable row level security;
alter table public.sales_returns enable row level security;
alter table public.sales_return_lines enable row level security;

create policy purchase_returns_select_member on public.purchase_returns
for select to authenticated
using (app.is_org_member(organization_id));

create policy purchase_return_lines_select_member on public.purchase_return_lines
for select to authenticated
using (app.is_org_member(organization_id));

create policy purchase_return_devices_select_member on public.purchase_return_devices
for select to authenticated
using (app.is_org_member(organization_id));

create policy sales_returns_select_member on public.sales_returns
for select to authenticated
using (app.is_org_member(organization_id));

create policy sales_return_lines_select_member on public.sales_return_lines
for select to authenticated
using (app.is_org_member(organization_id));

grant select on public.purchase_returns to authenticated;
grant select on public.purchase_return_lines to authenticated;
grant select on public.purchase_return_devices to authenticated;
grant select on public.sales_returns to authenticated;
grant select on public.sales_return_lines to authenticated;

-- Numbering now covers four document kinds.
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
  end;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_value::text, 4, '0');
end
$$;

create or replace function app.create_purchase_return(
  p_organization uuid,
  p_order uuid,
  p_lines jsonb,
  p_idempotency_key text,
  p_fingerprint text,
  p_reason text,
  p_reference text default null
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
  v_return public.purchase_returns%rowtype;
  v_return_line_id uuid;
  v_item record;
  v_line record;
  v_device_id uuid;
  v_device public.devices%rowtype;
  v_remaining numeric;
  v_line_count integer := 0;
  v_total_quantity numeric := 0;
  v_device_count integer;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'purchase_return_create',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'return_reason_required' using errcode = '22023';
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
      or (item->>'purchaseOrderLineId') is null
      or (item->>'purchaseOrderLineId') !~ '^[0-9a-fA-F-]{36}$'
      or (item->>'quantity') is null
      or (item->>'quantity') !~ '^[0-9]+(\.[0-9]{1,4})?$'
      or case
           when (item->>'quantity') ~ '^[0-9]+(\.[0-9]{1,4})?$' then (item->>'quantity')::numeric
           else null
         end <= 0
      or (item ? 'deviceIds' and item->'deviceIds' is not null
        and jsonb_typeof(item->'deviceIds') <> 'array')
      or exists (
        select 1
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(item->'deviceIds') = 'array' then item->'deviceIds'
            else '[]'::jsonb
          end
        ) device
        where device !~ '^[0-9a-fA-F-]{36}$'
      )
  ) then
    raise exception 'return_line_invalid' using errcode = '22023';
  end if;

  if (
    select count(distinct item->>'purchaseOrderLineId')
    from jsonb_array_elements(p_lines) item
  ) <> jsonb_array_length(p_lines) then
    raise exception 'duplicate_order_line' using errcode = '22023';
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

  if v_order.status not in ('partially_received', 'received') then
    raise exception 'purchase_order_not_returnable' using errcode = '23514';
  end if;

  for v_item in
    select item
    from jsonb_array_elements(p_lines) item
  loop
    select l.id, l.product_id, l.quantity_received, p.is_serialized
    into v_line
    from public.purchase_order_lines l
    join public.products p
      on p.id = l.product_id
      and p.organization_id = l.organization_id
    where l.id = (v_item.item->>'purchaseOrderLineId')::uuid
      and l.organization_id = p_organization
      and l.purchase_order_id = p_order;

    if not found then
      raise exception 'purchase_order_line_not_found' using errcode = 'P0002';
    end if;

    select coalesce(sum(rl.quantity), 0)
    into v_remaining
    from public.purchase_return_lines rl
    join public.purchase_returns r
      on r.id = rl.purchase_return_id
      and r.organization_id = rl.organization_id
    where rl.organization_id = p_organization
      and rl.purchase_order_line_id = v_line.id
      and r.status = 'posted';

    v_remaining := v_line.quantity_received - v_remaining;

    if (v_item.item->>'quantity')::numeric > v_remaining then
      raise exception 'purchase_return_exceeds_received' using errcode = '23514';
    end if;

    if v_line.is_serialized then
      v_device_count := coalesce(jsonb_array_length(v_item.item->'deviceIds'), 0);

      if v_device_count <> (v_item.item->>'quantity')::numeric
        or v_device_count <> round(v_device_count) then
        raise exception 'serial_count_mismatch' using errcode = '23514';
      end if;

      if (
        select count(distinct device)
        from jsonb_array_elements_text(v_item.item->'deviceIds') device
      ) <> v_device_count then
        raise exception 'duplicate_device' using errcode = '22023';
      end if;

      for v_device_id in
        select (device)::uuid
        from jsonb_array_elements_text(v_item.item->'deviceIds') device
      loop
        select d.*
        into v_device
        from public.devices d
        where d.id = v_device_id
          and d.organization_id = p_organization
        for update;

        if not found then
          raise exception 'device_not_found' using errcode = 'P0002';
        end if;

        if v_device.product_id <> v_line.product_id then
          raise exception 'device_product_mismatch' using errcode = '23514';
        end if;

        if v_device.status <> 'in_stock' then
          raise exception 'device_not_in_stock' using errcode = '23514';
        end if;

        if exists (
          select 1
          from public.purchase_return_devices d
          where d.organization_id = p_organization
            and d.device_id = v_device_id
        ) then
          raise exception 'device_already_returned' using errcode = '23505';
        end if;
      end loop;
    elsif v_item.item->'deviceIds' is not null
      and jsonb_array_length(v_item.item->'deviceIds') > 0 then
      raise exception 'serial_numbers_not_supported' using errcode = '23514';
    end if;
  end loop;

  insert into public.purchase_returns (
    organization_id,
    number,
    purchase_order_id,
    supplier_id,
    warehouse_id,
    location_id,
    status,
    reason,
    reference,
    created_by
  )
  values (
    p_organization,
    app.next_document_number(p_organization, 'purchase_return'),
    p_order,
    v_order.supplier_id,
    v_order.warehouse_id,
    v_order.location_id,
    'draft',
    btrim(p_reason),
    nullif(btrim(coalesce(p_reference, '')), ''),
    v_actor
  )
  returning * into v_return;

  for v_item in
    select item
    from jsonb_array_elements(p_lines) item
  loop
    insert into public.purchase_return_lines (
      organization_id,
      purchase_return_id,
      purchase_order_line_id,
      product_id,
      quantity
    )
    select
      p_organization,
      v_return.id,
      l.id,
      l.product_id,
      (v_item.item->>'quantity')::numeric
    from public.purchase_order_lines l
    where l.id = (v_item.item->>'purchaseOrderLineId')::uuid
      and l.organization_id = p_organization
    returning id into v_return_line_id;

    if v_item.item->'deviceIds' is not null
      and jsonb_typeof(v_item.item->'deviceIds') = 'array' then
      insert into public.purchase_return_devices (
        organization_id,
        purchase_return_line_id,
        device_id
      )
      select
        p_organization,
        v_return_line_id,
        (device)::uuid
      from jsonb_array_elements_text(v_item.item->'deviceIds') device;
    end if;

    v_line_count := v_line_count + 1;
    v_total_quantity := v_total_quantity + (v_item.item->>'quantity')::numeric;
  end loop;

  v_existing := jsonb_build_object(
    'returnId', v_return.id,
    'number', v_return.number,
    'status', v_return.status,
    'lineCount', v_line_count,
    'quantity', v_total_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.post_purchase_return(
  p_organization uuid,
  p_return uuid,
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
  v_return public.purchase_returns%rowtype;
  v_line record;
  v_device record;
  v_device_row public.devices%rowtype;
  v_other_posted numeric;
  v_posted_quantity numeric := 0;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'purchase_return_post',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select r.*
  into v_return
  from public.purchase_returns r
  where r.id = p_return
    and r.organization_id = p_organization
  for update;

  if not found then
    raise exception 'purchase_return_not_found' using errcode = 'P0002';
  end if;

  if v_return.status <> 'draft' then
    raise exception 'purchase_return_not_postable' using errcode = '23514';
  end if;

  -- Lines are processed in product order so concurrent postings touch stock
  -- balances in a stable sequence.
  for v_line in
    select rl.id, rl.product_id, rl.purchase_order_line_id, rl.quantity,
           pol.quantity_received, p.is_serialized
    from public.purchase_return_lines rl
    join public.purchase_order_lines pol
      on pol.id = rl.purchase_order_line_id
      and pol.organization_id = rl.organization_id
    join public.products p
      on p.id = rl.product_id
      and p.organization_id = rl.organization_id
    where rl.organization_id = p_organization
      and rl.purchase_return_id = p_return
    order by rl.product_id, rl.id
  loop
    -- Drafts may overlap within the same received quantity, so the invariant is
    -- enforced again here with the source line locked: concurrent postings
    -- serialize and each sees the other's committed return.
    perform 1
    from public.purchase_order_lines pol
    where pol.id = v_line.purchase_order_line_id
      and pol.organization_id = p_organization
    for update;

    select coalesce(sum(rl.quantity), 0)
    into v_other_posted
    from public.purchase_return_lines rl
    join public.purchase_returns r
      on r.id = rl.purchase_return_id
      and r.organization_id = rl.organization_id
    where rl.organization_id = p_organization
      and rl.purchase_order_line_id = v_line.purchase_order_line_id
      and r.status = 'posted'
      and r.id <> p_return;

    if v_line.quantity > v_line.quantity_received - v_other_posted then
      raise exception 'purchase_return_exceeds_received' using errcode = '23514';
    end if;

    if v_line.is_serialized then
      for v_device in
        select d.device_id
        from public.purchase_return_devices d
        where d.organization_id = p_organization
          and d.purchase_return_line_id = v_line.id
        order by d.device_id
      loop
        select d.*
        into v_device_row
        from public.devices d
        where d.id = v_device.device_id
          and d.organization_id = p_organization
        for update;

        if not found then
          raise exception 'device_not_found' using errcode = 'P0002';
        end if;

        if v_device_row.status <> 'in_stock' then
          raise exception 'device_not_in_stock' using errcode = '23514';
        end if;

        update public.devices
        set status = 'disposed',
            updated_at = now()
        where id = v_device_row.id;

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
          v_device_row.id,
          'disposed',
          v_device_row.status,
          'disposed',
          v_device_row.warehouse_id,
          v_device_row.location_id,
          'Returned to supplier on ' || v_return.number,
          v_actor
        );
      end loop;
    else
      perform app.operations_apply_stock(
        p_organization,
        v_line.product_id,
        v_return.warehouse_id,
        v_return.location_id,
        'issue',
        v_line.quantity,
        'purchase_return',
        v_return.id,
        null,
        'Purchase return ' || v_return.number,
        null
      );
    end if;

    v_posted_quantity := v_posted_quantity + v_line.quantity;
  end loop;

  update public.purchase_returns
  set status = 'posted',
      posted_at = now()
  where id = p_return;

  v_existing := jsonb_build_object(
    'returnId', p_return,
    'number', v_return.number,
    'status', 'posted',
    'quantity', v_posted_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.cancel_purchase_return(
  p_organization uuid,
  p_return uuid,
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
  v_return public.purchase_returns%rowtype;
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
    'purchase_return_cancel',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select r.*
  into v_return
  from public.purchase_returns r
  where r.id = p_return
    and r.organization_id = p_organization
  for update;

  if not found then
    raise exception 'purchase_return_not_found' using errcode = 'P0002';
  end if;

  if v_return.status <> 'draft' then
    raise exception 'purchase_return_not_cancellable' using errcode = '23514';
  end if;

  delete from public.purchase_return_devices d
  using public.purchase_return_lines l
  where d.organization_id = p_organization
    and d.purchase_return_line_id = l.id
    and l.organization_id = p_organization
    and l.purchase_return_id = p_return;

  get diagnostics v_released = row_count;

  update public.purchase_returns
  set status = 'cancelled',
      cancelled_at = now(),
      reason = case
        when nullif(btrim(coalesce(p_reason, '')), '') is null then reason
        else left(reason || ' · Cancelled: ' || btrim(p_reason), 500)
      end
  where id = p_return;

  v_existing := jsonb_build_object(
    'returnId', p_return,
    'number', v_return.number,
    'status', 'cancelled',
    'releasedDevices', v_released,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.create_sales_return(
  p_organization uuid,
  p_order uuid,
  p_lines jsonb,
  p_idempotency_key text,
  p_fingerprint text,
  p_reason text,
  p_reference text default null
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
  v_return public.sales_returns%rowtype;
  v_item record;
  v_line record;
  v_remaining numeric;
  v_line_count integer := 0;
  v_total_quantity numeric := 0;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_return_create',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'return_reason_required' using errcode = '22023';
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
      or (item->>'salesOrderLineId') is null
      or (item->>'salesOrderLineId') !~ '^[0-9a-fA-F-]{36}$'
      or (item->>'quantity') is null
      or (item->>'quantity') !~ '^[0-9]+(\.[0-9]{1,4})?$'
      or case
           when (item->>'quantity') ~ '^[0-9]+(\.[0-9]{1,4})?$' then (item->>'quantity')::numeric
           else null
         end <= 0
  ) then
    raise exception 'return_line_invalid' using errcode = '22023';
  end if;

  if (
    select count(distinct item->>'salesOrderLineId')
    from jsonb_array_elements(p_lines) item
  ) <> jsonb_array_length(p_lines) then
    raise exception 'duplicate_order_line' using errcode = '22023';
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

  if v_order.status <> 'fulfilled' then
    raise exception 'sales_order_not_returnable' using errcode = '23514';
  end if;

  for v_item in
    select item
    from jsonb_array_elements(p_lines) item
  loop
    select l.id, l.product_id, l.quantity, p.is_serialized
    into v_line
    from public.sales_order_lines l
    join public.products p
      on p.id = l.product_id
      and p.organization_id = l.organization_id
    where l.id = (v_item.item->>'salesOrderLineId')::uuid
      and l.organization_id = p_organization
      and l.sales_order_id = p_order;

    if not found then
      raise exception 'sales_order_line_not_found' using errcode = 'P0002';
    end if;

    if v_line.is_serialized then
      raise exception 'serial_numbers_not_supported' using errcode = '23514';
    end if;

    select coalesce(sum(rl.quantity), 0)
    into v_remaining
    from public.sales_return_lines rl
    join public.sales_returns r
      on r.id = rl.sales_return_id
      and r.organization_id = rl.organization_id
    where rl.organization_id = p_organization
      and rl.sales_order_line_id = v_line.id
      and r.status = 'posted';

    v_remaining := v_line.quantity - v_remaining;

    if (v_item.item->>'quantity')::numeric > v_remaining then
      raise exception 'sales_return_exceeds_fulfilled' using errcode = '23514';
    end if;
  end loop;

  insert into public.sales_returns (
    organization_id,
    number,
    sales_order_id,
    warehouse_id,
    location_id,
    status,
    reason,
    reference,
    created_by
  )
  values (
    p_organization,
    app.next_document_number(p_organization, 'sales_return'),
    p_order,
    v_order.warehouse_id,
    v_order.location_id,
    'draft',
    btrim(p_reason),
    nullif(btrim(coalesce(p_reference, '')), ''),
    v_actor
  )
  returning * into v_return;

  for v_item in
    select item
    from jsonb_array_elements(p_lines) item
  loop
    insert into public.sales_return_lines (
      organization_id,
      sales_return_id,
      sales_order_line_id,
      product_id,
      quantity
    )
    select
      p_organization,
      v_return.id,
      l.id,
      l.product_id,
      (v_item.item->>'quantity')::numeric
    from public.sales_order_lines l
    where l.id = (v_item.item->>'salesOrderLineId')::uuid
      and l.organization_id = p_organization;

    v_line_count := v_line_count + 1;
    v_total_quantity := v_total_quantity + (v_item.item->>'quantity')::numeric;
  end loop;

  v_existing := jsonb_build_object(
    'returnId', v_return.id,
    'number', v_return.number,
    'status', v_return.status,
    'lineCount', v_line_count,
    'quantity', v_total_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.post_sales_return(
  p_organization uuid,
  p_return uuid,
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
  v_return public.sales_returns%rowtype;
  v_line record;
  v_other_posted numeric;
  v_posted_quantity numeric := 0;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_return_post',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select r.*
  into v_return
  from public.sales_returns r
  where r.id = p_return
    and r.organization_id = p_organization
  for update;

  if not found then
    raise exception 'sales_return_not_found' using errcode = 'P0002';
  end if;

  if v_return.status <> 'draft' then
    raise exception 'sales_return_not_postable' using errcode = '23514';
  end if;

  for v_line in
    select rl.id, rl.product_id, rl.sales_order_line_id, rl.quantity,
           sol.quantity as quantity_fulfilled
    from public.sales_return_lines rl
    join public.sales_order_lines sol
      on sol.id = rl.sales_order_line_id
      and sol.organization_id = rl.organization_id
    where rl.organization_id = p_organization
      and rl.sales_return_id = p_return
    order by rl.product_id, rl.id
  loop
    perform 1
    from public.sales_order_lines sol
    where sol.id = v_line.sales_order_line_id
      and sol.organization_id = p_organization
    for update;

    select coalesce(sum(rl.quantity), 0)
    into v_other_posted
    from public.sales_return_lines rl
    join public.sales_returns r
      on r.id = rl.sales_return_id
      and r.organization_id = rl.organization_id
    where rl.organization_id = p_organization
      and rl.sales_order_line_id = v_line.sales_order_line_id
      and r.status = 'posted'
      and r.id <> p_return;

    if v_line.quantity > v_line.quantity_fulfilled - v_other_posted then
      raise exception 'sales_return_exceeds_fulfilled' using errcode = '23514';
    end if;

    perform app.operations_apply_stock(
      p_organization,
      v_line.product_id,
      v_return.warehouse_id,
      v_return.location_id,
      'receipt',
      v_line.quantity,
      'sales_return',
      v_return.id,
      null,
      'Sales return ' || v_return.number,
      null
    );

    v_posted_quantity := v_posted_quantity + v_line.quantity;
  end loop;

  update public.sales_returns
  set status = 'posted',
      posted_at = now()
  where id = p_return;

  v_existing := jsonb_build_object(
    'returnId', p_return,
    'number', v_return.number,
    'status', 'posted',
    'quantity', v_posted_quantity,
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

create or replace function app.cancel_sales_return(
  p_organization uuid,
  p_return uuid,
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
  v_return public.sales_returns%rowtype;
begin
  if not app.has_org_role(p_organization, array['owner', 'admin', 'manager']::app.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select c.operation_id, c.existing_response, c.is_duplicate
  into v_operation_id, v_existing, v_duplicate
  from app.claim_stock_operation(
    p_organization,
    p_idempotency_key,
    'sales_return_cancel',
    p_fingerprint
  ) c;

  if v_duplicate then
    return coalesce(v_existing, '{}'::jsonb) || jsonb_build_object('duplicate', true);
  end if;

  select r.*
  into v_return
  from public.sales_returns r
  where r.id = p_return
    and r.organization_id = p_organization
  for update;

  if not found then
    raise exception 'sales_return_not_found' using errcode = 'P0002';
  end if;

  if v_return.status <> 'draft' then
    raise exception 'sales_return_not_cancellable' using errcode = '23514';
  end if;

  update public.sales_returns
  set status = 'cancelled',
      cancelled_at = now(),
      reason = case
        when nullif(btrim(coalesce(p_reason, '')), '') is null then reason
        else left(reason || ' · Cancelled: ' || btrim(p_reason), 500)
      end
  where id = p_return;

  v_existing := jsonb_build_object(
    'returnId', p_return,
    'number', v_return.number,
    'status', 'cancelled',
    'duplicate', false
  );

  update public.stock_operations
  set response = v_existing
  where id = v_operation_id;

  return v_existing;
end
$$;

revoke execute on function app.next_document_number(uuid, app.document_kind) from public;
revoke execute on function app.create_purchase_return(uuid, uuid, jsonb, text, text, text, text) from public;
revoke execute on function app.post_purchase_return(uuid, uuid, text, text) from public;
revoke execute on function app.cancel_purchase_return(uuid, uuid, text, text, text) from public;
revoke execute on function app.create_sales_return(uuid, uuid, jsonb, text, text, text, text) from public;
revoke execute on function app.post_sales_return(uuid, uuid, text, text) from public;
revoke execute on function app.cancel_sales_return(uuid, uuid, text, text, text) from public;

grant execute on function app.create_purchase_return(uuid, uuid, jsonb, text, text, text, text) to authenticated;
grant execute on function app.post_purchase_return(uuid, uuid, text, text) to authenticated;
grant execute on function app.cancel_purchase_return(uuid, uuid, text, text, text) to authenticated;
grant execute on function app.create_sales_return(uuid, uuid, jsonb, text, text, text, text) to authenticated;
grant execute on function app.post_sales_return(uuid, uuid, text, text) to authenticated;
grant execute on function app.cancel_sales_return(uuid, uuid, text, text, text) to authenticated;
