-- Development seed. Run after migrations against a database that already has at
-- least one signed-up user; the earliest user becomes owner of the demo organization.
-- Safe to re-run: every insert is keyed by a fixed id and ignored on conflict.

do $$
declare
  v_user uuid;
  v_org constant uuid := '0a000000-0000-4000-8000-000000000001';
begin
  select id into v_user from auth.users order by created_at limit 1;

  if v_user is null then
    raise exception 'seed_requires_auth_user: sign up through Supabase Auth first';
  end if;

  insert into public.organizations (id, name, slug)
  values (v_org, 'SBS VISION', 'sbs-vision')
  on conflict (id) do nothing;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org, v_user, 'owner')
  on conflict (organization_id, user_id) do nothing;

  insert into public.categories (id, organization_id, parent_id, name, slug) values
    ('0c000000-0000-4000-8000-000000000001', v_org, null, 'Cameras', 'cameras'),
    ('0c000000-0000-4000-8000-000000000002', v_org, null, 'Computers', 'computers'),
    ('0c000000-0000-4000-8000-000000000003', v_org, '0c000000-0000-4000-8000-000000000002', 'Laptops', 'laptops'),
    ('0c000000-0000-4000-8000-000000000004', v_org, null, 'Phones & Tablets', 'phones-tablets'),
    ('0c000000-0000-4000-8000-000000000005', v_org, null, 'Televisions', 'televisions'),
    ('0c000000-0000-4000-8000-000000000006', v_org, null, 'Networking', 'networking'),
    ('0c000000-0000-4000-8000-000000000007', v_org, null, 'Accessories', 'accessories')
  on conflict (id) do nothing;

  insert into public.brands (id, organization_id, name) values
    ('0b000000-0000-4000-8000-000000000001', v_org, 'Apple'),
    ('0b000000-0000-4000-8000-000000000002', v_org, 'Samsung'),
    ('0b000000-0000-4000-8000-000000000003', v_org, 'Lenovo'),
    ('0b000000-0000-4000-8000-000000000004', v_org, 'TP-Link'),
    ('0b000000-0000-4000-8000-000000000005', v_org, 'Anker'),
    ('0b000000-0000-4000-8000-000000000006', v_org, 'Canon'),
    ('0b000000-0000-4000-8000-000000000007', v_org, 'JBL')
  on conflict (id) do nothing;

  insert into public.warehouses (id, organization_id, code, name, address_line, city, country_code) values
    ('0d000000-0000-4000-8000-000000000001', v_org, 'MAIN', 'Main warehouse', 'Zone Industrielle', 'Tunis', 'TN'),
    ('0d000000-0000-4000-8000-000000000002', v_org, 'SHOP', 'Retail shop', 'Avenue Habib Bourguiba', 'Tunis', 'TN')
  on conflict (id) do nothing;

  insert into public.storage_locations (id, organization_id, warehouse_id, code, name) values
    ('0e000000-0000-4000-8000-000000000001', v_org, '0d000000-0000-4000-8000-000000000001', 'A-01', 'Aisle A shelf 01'),
    ('0e000000-0000-4000-8000-000000000002', v_org, '0d000000-0000-4000-8000-000000000001', 'B-02', 'Aisle B shelf 02'),
    ('0e000000-0000-4000-8000-000000000003', v_org, '0d000000-0000-4000-8000-000000000002', 'S-01', 'Shop counter')
  on conflict (id) do nothing;

  -- Prices are integer millimes: 3150000 = 3 150,000 TND.
  insert into public.products (
    id, organization_id, sku, name, category_id, brand_id, manufacturer_model,
    barcode, internal_code, unit_of_measure, purchase_price_minor, sale_price_minor,
    reorder_threshold, is_serialized, attributes
  ) values
    ('0f000000-0000-4000-8000-000000000001', v_org, 'IPHONE-15-128', 'iPhone 15 128GB',
     '0c000000-0000-4000-8000-000000000004', '0b000000-0000-4000-8000-000000000001', 'A3090',
     '2000000000015', 'MS-0001', 'unit', 3150000, 3690000, 5, true, '{"color": "black"}'),
    ('0f000000-0000-4000-8000-000000000002', v_org, 'TV-SAM-55-CU', 'Samsung 55" Crystal UHD',
     '0c000000-0000-4000-8000-000000000005', '0b000000-0000-4000-8000-000000000002', 'CU7000',
     '2000000000022', 'MS-0002', 'unit', 1680000, 1990000, 2, true, '{"sizeInches": 55}'),
    ('0f000000-0000-4000-8000-000000000003', v_org, 'LAP-LEN-T14', 'Lenovo ThinkPad T14',
     '0c000000-0000-4000-8000-000000000003', '0b000000-0000-4000-8000-000000000003', '21AH',
     '2000000000039', 'MS-0003', 'unit', 2450000, 2890000, 3, true, '{"ramGb": 16, "storageGb": 512}'),
    ('0f000000-0000-4000-8000-000000000004', v_org, 'RTR-TPL-AX55', 'TP-Link Archer AX55',
     '0c000000-0000-4000-8000-000000000006', '0b000000-0000-4000-8000-000000000004', 'AX55',
     '2000000000046', 'MS-0004', 'unit', 210000, 289000, 10, true, '{"wifi": "Wi-Fi 6"}'),
    ('0f000000-0000-4000-8000-000000000005', v_org, 'CBL-USBC-2M', 'USB-C cable 2m',
     '0c000000-0000-4000-8000-000000000007', '0b000000-0000-4000-8000-000000000005', 'A8753',
     '2000000000053', 'MS-0005', 'unit', 4500, 8900, 25, false, '{"lengthMeters": 2}'),
    ('0f000000-0000-4000-8000-000000000006', v_org, 'CAM-CAN-R50', 'Canon EOS R50 body',
     '0c000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000006', 'R50',
     '2000000000060', 'MS-0006', 'unit', 2100000, 2490000, 2, true, '{"mount": "RF"}'),
    ('0f000000-0000-4000-8000-000000000007', v_org, 'AUD-JBL-520', 'JBL Tune 520BT',
     '0c000000-0000-4000-8000-000000000007', '0b000000-0000-4000-8000-000000000007', 'T520BT',
     '2000000000077', 'MS-0007', 'unit', 89000, 129000, 15, false, '{"color": "blue"}')
  on conflict (id) do nothing;
end
$$;
