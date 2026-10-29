import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCATIONS, ORGS, PRODUCTS, USERS, WAREHOUSES } from '../db/fixtures';
import { createTestContext, type TestContext } from './test-app';

const SECOND_LOCATION = '60000000-0000-4000-8000-0000000000a2';

describe('stock API', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let daveToken: string;
  let bobToken: string;

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
  const base = `/api/v1/organizations/${ORGS.a}`;

  it('requires an idempotency key for stock changes', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .send({
        productId: PRODUCTS.a1,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'receipt',
        quantity: 10,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('idempotency_key_required');
  });

  it('posts a receipt and replays it for the same key', async () => {
    const body = {
      productId: PRODUCTS.a1,
      warehouseId: WAREHOUSES.a,
      locationId: LOCATIONS.a,
      type: 'receipt',
      quantity: 10,
      reason: 'Opening stock',
    };

    const first = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-receipt-0001')
      .send(body);

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ onHand: 10, available: 10, duplicate: false });

    const replay = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-receipt-0001')
      .send(body);

    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      movementId: first.body.movementId,
      onHand: 10,
      duplicate: true,
    });

    const conflict = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-receipt-0001')
      .send({ ...body, quantity: 12 });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('idempotency_conflict');
  });

  it('lists stock levels and movements for members', async () => {
    const levels = await request(ctx.app.getHttpServer())
      .get(`${base}/stock-levels`)
      .set('authorization', auth(aliceToken));

    expect(levels.status).toBe(200);
    expect(levels.body.total).toBe(1);
    expect(levels.body.items[0]).toMatchObject({
      productId: PRODUCTS.a1,
      sku: 'IPHONE-15',
      warehouseCode: 'MAIN',
      locationCode: 'A-01',
      onHand: 10,
      reserved: 0,
      available: 10,
    });

    const summary = await request(ctx.app.getHttpServer())
      .get(`${base}/stock-levels/summary`)
      .set('authorization', auth(aliceToken));

    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({
      onHand: 10,
      reserved: 0,
      available: 10,
      locationCount: 1,
      productCount: 1,
    });

    const movements = await request(ctx.app.getHttpServer())
      .get(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken));

    expect(movements.status).toBe(200);
    expect(movements.body.total).toBe(1);
    expect(movements.body.items[0]).toMatchObject({
      productSku: 'IPHONE-15',
      movementType: 'receipt',
      quantityDelta: 10,
      onHandAfter: 10,
      actorId: USERS.alice,
      reason: 'Opening stock',
    });
  });

  it('rejects adjustments without a reason', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-adjust-no-reason')
      .send({
        productId: PRODUCTS.a1,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'adjustment',
        quantity: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });

  it('enforces roles and tenant boundaries', async () => {
    const payload = {
      productId: PRODUCTS.a1,
      warehouseId: WAREHOUSES.a,
      locationId: LOCATIONS.a,
      type: 'receipt',
      quantity: 1,
    };

    const viewer = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(daveToken))
      .set('idempotency-key', 'api-viewer-receipt')
      .send(payload);
    expect(viewer.status).toBe(403);

    const outsider = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(bobToken))
      .set('idempotency-key', 'api-outsider-receipt')
      .send(payload);
    expect(outsider.status).toBe(404);

    const otherOrg = await request(ctx.app.getHttpServer())
      .get(`/api/v1/organizations/${ORGS.b}/stock-levels`)
      .set('authorization', auth(aliceToken));
    expect(otherOrg.status).toBe(404);
  });

  it('transfers stock between locations', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-transfers`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-transfer-0001')
      .send({
        productId: PRODUCTS.a1,
        sourceWarehouseId: WAREHOUSES.a,
        sourceLocationId: LOCATIONS.a,
        targetWarehouseId: WAREHOUSES.a,
        targetLocationId: SECOND_LOCATION,
        quantity: 4,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      quantity: 4,
      sourceOnHand: 6,
      targetOnHand: 4,
      duplicate: false,
    });

    const levels = await request(ctx.app.getHttpServer())
      .get(`${base}/stock-levels`)
      .set('authorization', auth(aliceToken));

    expect(levels.body.total).toBe(2);
    expect(
      levels.body.items.map((item: { locationCode: string; onHand: number }) => [
        item.locationCode,
        item.onHand,
      ]),
    ).toEqual([
      ['A-01', 6],
      ['A-02', 4],
    ]);
  });

  it('reserves, blocks reserved stock, then releases and issues', async () => {
    const reservation = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-reservations`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-reserve-0001')
      .send({
        productId: PRODUCTS.a1,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        quantity: 3,
        referenceType: 'outgoing_order',
        note: 'Order SO-1001',
      });

    expect(reservation.status).toBe(200);
    expect(reservation.body).toMatchObject({ quantity: 3, reserved: 3, available: 3 });

    const blocked = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-issue-blocked')
      .send({
        productId: PRODUCTS.a1,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'issue',
        quantity: 6,
      });

    expect(blocked.status).toBe(400);
    expect(blocked.body.error.code).toBe('constraint_violation');
    expect(blocked.body.error.message).toMatch(/reserved/i);

    const listed = await request(ctx.app.getHttpServer())
      .get(`${base}/stock-reservations?status=active`)
      .set('authorization', auth(aliceToken));

    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0]).toMatchObject({
      productSku: 'IPHONE-15',
      quantity: 3,
      status: 'active',
      note: 'Order SO-1001',
    });

    const release = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-reservations/${reservation.body.reservationId}/release`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-release-0001');

    expect(release.status).toBe(200);
    expect(release.body.status).toBe('released');

    const issue = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-movements`)
      .set('authorization', auth(aliceToken))
      .set('idempotency-key', 'api-issue-0001')
      .send({
        productId: PRODUCTS.a1,
        warehouseId: WAREHOUSES.a,
        locationId: LOCATIONS.a,
        type: 'issue',
        quantity: 3,
      });

    expect(issue.status).toBe(200);
    expect(issue.body).toMatchObject({ onHand: 3, available: 3 });
  });

  it('reports reconciliation and restricts it to managers', async () => {
    const reconciliation = await request(ctx.app.getHttpServer())
      .get(`${base}/stock-reconciliation`)
      .set('authorization', auth(aliceToken));

    expect(reconciliation.status).toBe(200);
    expect(reconciliation.body).toHaveLength(2);
    for (const row of reconciliation.body) {
      expect(row.difference).toBe(0);
      expect(row.productSku).toBe('IPHONE-15');
      expect(row.warehouseCode).toBe('MAIN');
    }

    const forbidden = await request(ctx.app.getHttpServer())
      .get(`${base}/stock-reconciliation`)
      .set('authorization', auth(daveToken));

    expect(forbidden.status).toBe(403);

    const repair = await request(ctx.app.getHttpServer())
      .post(`${base}/stock-reconciliation/repair`)
      .set('authorization', auth(aliceToken))
      .send({ dryRun: true });

    expect(repair.status).toBe(200);
    expect(repair.body).toEqual([]);
  });
});
