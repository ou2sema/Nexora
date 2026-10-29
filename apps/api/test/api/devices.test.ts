import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const SECOND_LOCATION = '60000000-0000-4000-8000-0000000000a2';

describe('device API', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let daveToken: string;
  let bobToken: string;
  let deviceId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice);
    daveToken = await ctx.tokenFor(USERS.dave);
    bobToken = await ctx.tokenFor(USERS.bob);

    await ctx.database.query(
      `insert into public.storage_locations (id, organization_id, warehouse_id, code, name)
       values ($1, $2, $3, 'A-02', 'Aisle A shelf 02')`,
      [SECOND_LOCATION, ORGS.a, WAREHOUSES.a],
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => `Bearer ${token}`;
  const base = `/api/v1/organizations/${ORGS.a}/devices`;

  const registration = () => ({
    productId: PRODUCTS.a1,
    serialNumber: 'SN-API-0001',
    imei: '356789012345671',
    condition: 'new',
    warehouseId: WAREHOUSES.a,
    locationId: LOCATIONS.a,
    warrantyStartOn: '2026-10-01',
    warrantyEndOn: '2028-10-01',
    supplierReference: 'PO-2026-01',
  });

  it('requires an idempotency key and registers a device', async () => {
    const missing = await request(ctx.app.getHttpServer())
      .post(base)
      .set('authorization', auth(aliceToken))
      .send(registration());

    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('idempotency_key_required');

    const first = await request(ctx.app.getHttpServer())
      .post(base)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-register-1')
      .send(registration());

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      serialNumber: 'SN-API-0001',
      status: 'in_stock',
      duplicate: false,
    });
    deviceId = first.body.deviceId;

    const retry = await request(ctx.app.getHttpServer())
      .post(base)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-register-1')
      .send(registration());

    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ deviceId, duplicate: true });
  });

  it('rejects duplicate serials and non-serialized products', async () => {
    const duplicate = await request(ctx.app.getHttpServer())
      .post(base)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-duplicate')
      .send({ ...registration(), serialNumber: 'sn-api-0001', imei: null });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('conflict');

    const cable = await request(ctx.app.getHttpServer())
      .post(base)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-cable')
      .send({ ...registration(), productId: PRODUCTS.a2, serialNumber: 'SN-CABLE', imei: null });

    expect(cable.status).toBe(400);
    expect(cable.body.error.code).toBe('constraint_violation');
  });

  it('enforces roles and tenant isolation', async () => {
    const viewer = await request(ctx.app.getHttpServer())
      .post(base)
      .set('authorization', auth(daveToken))
      .set('idempotency-key', 'device-api-viewer')
      .send({ ...registration(), serialNumber: 'SN-VIEWER' });
    expect(viewer.status).toBe(403);

    const outsider = await request(ctx.app.getHttpServer())
      .get(base)
      .set('authorization', auth(bobToken));
    expect(outsider.status).toBe(404);

    const otherOrg = await request(ctx.app.getHttpServer())
      .get(`/api/v1/organizations/${ORGS.b}/devices`)
      .set('authorization', auth(bobToken));
    expect(otherOrg.status).toBe(200);
    expect(otherOrg.body.total).toBe(0);
  });

  it('lists and reads a device with its history', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get(`${base}?search=SN-API`)
      .set('authorization', auth(aliceToken));

    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      productSku: 'IPHONE-15',
      serialNumber: 'SN-API-0001',
      imei: '356789012345671',
      warrantyStartOn: '2026-10-01',
      supplierReference: 'PO-2026-01',
    });

    const detail = await request(ctx.app.getHttpServer())
      .get(`${base}/${deviceId}`)
      .set('authorization', auth(aliceToken));

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id: deviceId, status: 'in_stock' });

    const events = await request(ctx.app.getHttpServer())
      .get(`${base}/${deviceId}/events`)
      .set('authorization', auth(aliceToken));

    expect(events.status).toBe(200);
    expect(events.body).toHaveLength(1);
    expect(events.body[0]).toMatchObject({
      eventType: 'registered',
      statusTo: 'in_stock',
      actorId: USERS.alice,
    });
  });

  it('changes status through allowed transitions only', async () => {
    const reserved = await request(ctx.app.getHttpServer())
      .post(`${base}/${deviceId}/status`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-reserve')
      .send({ status: 'reserved' });

    expect(reserved.status).toBe(200);
    expect(reserved.body).toMatchObject({
      status: 'reserved',
      previousStatus: 'in_stock',
      duplicate: false,
    });

    const invalid = await request(ctx.app.getHttpServer())
      .post(`${base}/${deviceId}/status`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-invalid')
      .send({ status: 'returned' });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('constraint_violation');

    const sold = await request(ctx.app.getHttpServer())
      .post(`${base}/${deviceId}/status`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-sold')
      .send({ status: 'sold' });

    expect(sold.status).toBe(200);

    const events = await request(ctx.app.getHttpServer())
      .get(`${base}/${deviceId}/events`)
      .set('authorization', auth(aliceToken));

    expect(events.body.map((event: { eventType: string }) => event.eventType)).toEqual([
      'registered',
      'reserved',
      'issued',
    ]);
  });

  it('moves an in-stock device and refuses to move a sold one', async () => {
    const second = await request(ctx.app.getHttpServer())
      .post(base)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-register-2')
      .send({ ...registration(), serialNumber: 'SN-API-0002', imei: null });

    const move = await request(ctx.app.getHttpServer())
      .post(`${base}/${second.body.deviceId}/location`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-move-1')
      .send({ warehouseId: WAREHOUSES.a, locationId: SECOND_LOCATION });

    expect(move.status).toBe(200);
    expect(move.body).toMatchObject({ locationId: SECOND_LOCATION, duplicate: false });

    const detail = await request(ctx.app.getHttpServer())
      .get(`${base}/${second.body.deviceId}`)
      .set('authorization', auth(aliceToken));
    expect(detail.body.locationId).toBe(SECOND_LOCATION);

    const soldMove = await request(ctx.app.getHttpServer())
      .post(`${base}/${deviceId}/location`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'device-api-move-sold')
      .send({ warehouseId: WAREHOUSES.a, locationId: SECOND_LOCATION });

    expect(soldMove.status).toBe(400);
    expect(soldMove.body.error.code).toBe('constraint_violation');
  });
});
