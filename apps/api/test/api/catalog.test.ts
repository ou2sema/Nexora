import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SHARED_BARCODE, USERS } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const ORG_A = '10000000-0000-4000-8000-00000000000a';
const CATEGORY_A_ROOT = '30000000-0000-4000-8000-0000000000a0';
const CATEGORY_A_CHILD = '30000000-0000-4000-8000-0000000000a1';
const WAREHOUSE_A = '50000000-0000-4000-8000-00000000000a';
const WAREHOUSE_B = '50000000-0000-4000-8000-00000000000b';

describe('catalog api', () => {
  let ctx: TestContext;
  let alice: string;
  let bob: string;
  let dave: string;
  let createdProductId: string;

  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestContext();
    alice = await ctx.tokenFor(USERS.alice, { email: 'alice@example.com' });
    bob = await ctx.tokenFor(USERS.bob);
    dave = await ctx.tokenFor(USERS.dave);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists only the caller organizations products', async () => {
    const response = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .set('authorization', `Bearer ${alice}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.page).toBe(1);
    expect(response.body.items.map((item: { sku: string }) => item.sku)).toEqual([
      'IPHONE-15',
      'CABLE-USB-C',
    ]);
    expect(response.body.items[0]).toMatchObject({
      name: 'iPhone 15 128GB',
      categoryName: 'Smartphones',
      brandName: 'Apple',
      purchasePriceMinor: 3_150_000,
      isSerialized: true,
    });
  });

  it('denies access to an organization the caller does not belong to', async () => {
    const response = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .set('authorization', `Bearer ${bob}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('organization_not_found');
  });

  it('lets a viewer read but not write', async () => {
    const list = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .set('authorization', `Bearer ${dave}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);

    const create = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/products`)
      .set('authorization', `Bearer ${dave}`)
      .send({ sku: 'VIEWER-1', name: 'Viewer product' });
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe('forbidden');
  });

  it('validates organization identifiers in the path', async () => {
    const response = await request(server())
      .get('/api/v1/organizations/not-a-uuid/products')
      .set('authorization', `Bearer ${alice}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });

  it('creates a product with catalog defaults', async () => {
    const response = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/products`)
      .set('authorization', `Bearer ${alice}`)
      .send({
        sku: 'TV-55-4K',
        name: 'Smart TV 55 4K',
        categoryId: CATEGORY_A_ROOT,
        barcode: '2000000000015',
        purchasePriceMinor: 1_450_000,
        salePriceMinor: 1_990_000,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      sku: 'TV-55-4K',
      categoryName: 'Phones',
      unitOfMeasure: 'unit',
      status: 'active',
      isSerialized: false,
      reorderThreshold: 0,
      attributes: {},
      brandId: null,
    });
    createdProductId = response.body.id;
  });

  it('rejects duplicate SKUs case-insensitively', async () => {
    const response = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/products`)
      .set('authorization', `Bearer ${alice}`)
      .send({ sku: 'iphone-15', name: 'Duplicate' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('conflict');
  });

  it('rejects a category from another organization', async () => {
    const response = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/products`)
      .set('authorization', `Bearer ${alice}`)
      .send({
        sku: 'CROSS-1',
        name: 'Cross-tenant category',
        categoryId: '30000000-0000-4000-8000-0000000000b0',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_reference');
  });

  it('rejects negative money amounts', async () => {
    const response = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/products`)
      .set('authorization', `Bearer ${alice}`)
      .send({ sku: 'NEG-1', name: 'Negative', purchasePriceMinor: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });

  it('searches by name and barcode and filters by status', async () => {
    const byName = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .query({ search: 'iphone' })
      .set('authorization', `Bearer ${alice}`);
    expect(byName.body.total).toBe(1);
    expect(byName.body.items[0].sku).toBe('IPHONE-15');

    const byBarcode = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .query({ search: SHARED_BARCODE })
      .set('authorization', `Bearer ${alice}`);
    expect(byBarcode.body.total).toBe(1);

    const byCategory = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .query({ categoryId: CATEGORY_A_CHILD })
      .set('authorization', `Bearer ${alice}`);
    expect(byCategory.body.total).toBe(1);

    const archived = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .query({ status: 'archived' })
      .set('authorization', `Bearer ${alice}`);
    expect(archived.body.total).toBe(0);
  });

  it('paginates with a bounded page size', async () => {
    const response = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .query({ page: 1, pageSize: 2 })
      .set('authorization', `Bearer ${alice}`);

    expect(response.body.total).toBe(3);
    expect(response.body.items).toHaveLength(2);

    const outOfRange = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products`)
      .query({ pageSize: 1000 })
      .set('authorization', `Bearer ${alice}`);
    expect(outOfRange.status).toBe(400);
  });

  it('updates a product and returns its joined names', async () => {
    const response = await request(server())
      .patch(`/api/v1/organizations/${ORG_A}/products/${createdProductId}`)
      .set('authorization', `Bearer ${alice}`)
      .send({ name: 'Smart TV 55 4K (2026)', salePriceMinor: 1_890_000 });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Smart TV 55 4K (2026)');
    expect(response.body.salePriceMinor).toBe(1_890_000);

    const read = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/products/${createdProductId}`)
      .set('authorization', `Bearer ${alice}`);
    expect(read.status).toBe(200);
    expect(read.body.name).toBe('Smart TV 55 4K (2026)');
  });

  it('blocks viewer updates and reports missing products', async () => {
    const viewer = await request(server())
      .patch(`/api/v1/organizations/${ORG_A}/products/${createdProductId}`)
      .set('authorization', `Bearer ${dave}`)
      .send({ name: 'Viewer edit' });
    expect(viewer.status).toBe(403);

    const missing = await request(server())
      .patch(
        '/api/v1/organizations/10000000-0000-4000-8000-00000000000a/products/99999999-0000-4000-8000-000000000000',
      )
      .set('authorization', `Bearer ${alice}`)
      .send({ name: 'Missing' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('product_not_found');
  });

  it('creates categories with derived slugs and rejects duplicates', async () => {
    const created = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/categories`)
      .set('authorization', `Bearer ${alice}`)
      .send({ name: 'Televisions & Displays' });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe('televisions-displays');

    const duplicate = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/categories`)
      .set('authorization', `Bearer ${alice}`)
      .send({ name: 'Other', slug: 'televisions-displays' });
    expect(duplicate.status).toBe(409);

    const list = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/categories`)
      .set('authorization', `Bearer ${alice}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(3);
  });

  it('creates brands and keeps names unique per organization', async () => {
    const created = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/brands`)
      .set('authorization', `Bearer ${alice}`)
      .send({ name: 'Samsung' });
    expect(created.status).toBe(201);

    const duplicate = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/brands`)
      .set('authorization', `Bearer ${alice}`)
      .send({ name: 'samsung' });
    expect(duplicate.status).toBe(409);
  });

  it('returns warehouses with their storage locations', async () => {
    const response = await request(server())
      .get(`/api/v1/organizations/${ORG_A}/warehouses`)
      .set('authorization', `Bearer ${alice}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ code: 'MAIN', city: null });
    expect(response.body[0].locations).toHaveLength(1);
    expect(response.body[0].locations[0]).toMatchObject({ code: 'A-01', name: 'Aisle A shelf 01' });
  });

  it('creates warehouses and storage locations with tenant scoping', async () => {
    const created = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/warehouses`)
      .set('authorization', `Bearer ${alice}`)
      .send({ code: 'shop', name: 'Shop Tunis', city: 'Tunis', countryCode: 'tn' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      code: 'SHOP',
      city: 'Tunis',
      countryCode: 'TN',
      locations: [],
    });

    const duplicate = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/warehouses`)
      .set('authorization', `Bearer ${alice}`)
      .send({ code: 'main', name: 'Duplicate' });
    expect(duplicate.status).toBe(409);

    const location = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/warehouses/${WAREHOUSE_A}/locations`)
      .set('authorization', `Bearer ${alice}`)
      .send({ code: 'b-02', name: 'Aisle B shelf 02' });
    expect(location.status).toBe(201);
    expect(location.body.code).toBe('B-02');

    const crossTenant = await request(server())
      .post(`/api/v1/organizations/${ORG_A}/warehouses/${WAREHOUSE_B}/locations`)
      .set('authorization', `Bearer ${alice}`)
      .send({ code: 'X-01', name: 'Foreign warehouse' });
    expect(crossTenant.status).toBe(404);
    expect(crossTenant.body.error.code).toBe('warehouse_not_found');
  });
});
