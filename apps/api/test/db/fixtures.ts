import type { PGlite } from '@electric-sql/pglite';

export const USERS = {
  alice: '00000000-0000-4000-8000-00000000000a',
  bob: '00000000-0000-4000-8000-00000000000b',
  carol: '00000000-0000-4000-8000-00000000000c',
  dave: '00000000-0000-4000-8000-00000000000d',
} as const;

export const ORGS = {
  a: '10000000-0000-4000-8000-00000000000a',
  b: '10000000-0000-4000-8000-00000000000b',
} as const;

export const PRODUCTS = {
  a1: '20000000-0000-4000-8000-0000000000a1',
  a2: '20000000-0000-4000-8000-0000000000a2',
  b1: '20000000-0000-4000-8000-0000000000b1',
} as const;

export const CATEGORIES = {
  aRoot: '30000000-0000-4000-8000-0000000000a0',
  aChild: '30000000-0000-4000-8000-0000000000a1',
  bRoot: '30000000-0000-4000-8000-0000000000b0',
} as const;

export const BRANDS = {
  a: '40000000-0000-4000-8000-00000000000a',
  b: '40000000-0000-4000-8000-00000000000b',
} as const;

export const WAREHOUSES = {
  a: '50000000-0000-4000-8000-00000000000a',
  b: '50000000-0000-4000-8000-00000000000b',
} as const;

export const LOCATIONS = {
  a: '60000000-0000-4000-8000-00000000000a',
  b: '60000000-0000-4000-8000-00000000000b',
} as const;

export const SHARED_BARCODE = '4006381333931';

/**
 * Two organizations with overlapping identifiers (same SKU, same barcode, same
 * warehouse code) to prove uniqueness is scoped per tenant. Alice owns A, Bob
 * owns B, Dave is a viewer in A, Carol has no membership.
 */
export async function seedFixtures(client: PGlite): Promise<void> {
  await client.exec(`
    insert into auth.users (id, email) values
      ('${USERS.alice}', 'alice@example.com'),
      ('${USERS.bob}', 'bob@example.com'),
      ('${USERS.carol}', 'carol@example.com'),
      ('${USERS.dave}', 'dave@example.com');

    insert into public.organizations (id, name, slug) values
      ('${ORGS.a}', 'Org A', 'org-a'),
      ('${ORGS.b}', 'Org B', 'org-b');

    insert into public.memberships (organization_id, user_id, role) values
      ('${ORGS.a}', '${USERS.alice}', 'owner'),
      ('${ORGS.b}', '${USERS.bob}', 'owner'),
      ('${ORGS.a}', '${USERS.dave}', 'viewer');

    insert into public.categories (id, organization_id, parent_id, name, slug) values
      ('${CATEGORIES.aRoot}', '${ORGS.a}', null, 'Phones', 'phones'),
      ('${CATEGORIES.aChild}', '${ORGS.a}', '${CATEGORIES.aRoot}', 'Smartphones', 'smartphones'),
      ('${CATEGORIES.bRoot}', '${ORGS.b}', null, 'Phones', 'phones');

    insert into public.brands (id, organization_id, name) values
      ('${BRANDS.a}', '${ORGS.a}', 'Apple'),
      ('${BRANDS.b}', '${ORGS.b}', 'Apple');

    insert into public.products (
      id, organization_id, sku, name, category_id, brand_id, barcode,
      internal_code, purchase_price_minor, sale_price_minor, is_serialized
    ) values
      ('${PRODUCTS.a1}', '${ORGS.a}', 'IPHONE-15', 'iPhone 15 128GB', '${CATEGORIES.aChild}', '${BRANDS.a}',
       '${SHARED_BARCODE}', 'MS-A-0001', 3150000, 3690000, true),
      ('${PRODUCTS.a2}', '${ORGS.a}', 'CABLE-USB-C', 'USB-C cable 2m', '${CATEGORIES.aRoot}', null,
       null, 'MS-A-0002', 4500, 8900, false),
      ('${PRODUCTS.b1}', '${ORGS.b}', 'IPHONE-15', 'iPhone 15 128GB', '${CATEGORIES.bRoot}', '${BRANDS.b}',
       '${SHARED_BARCODE}', 'MS-B-0001', 3100000, 3650000, true);

    insert into public.warehouses (id, organization_id, code, name) values
      ('${WAREHOUSES.a}', '${ORGS.a}', 'MAIN', 'Main warehouse'),
      ('${WAREHOUSES.b}', '${ORGS.b}', 'MAIN', 'Main warehouse');

    insert into public.storage_locations (id, organization_id, warehouse_id, code, name) values
      ('${LOCATIONS.a}', '${ORGS.a}', '${WAREHOUSES.a}', 'A-01', 'Aisle A shelf 01'),
      ('${LOCATIONS.b}', '${ORGS.b}', '${WAREHOUSES.b}', 'A-01', 'Aisle A shelf 01');
  `);
}
