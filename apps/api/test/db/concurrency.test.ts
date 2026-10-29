import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';
import { Pool, type Client, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * PGlite accepts a single connection, so it cannot demonstrate row-lock
 * behaviour. This suite boots a real PostgreSQL cluster and drives parallel
 * transactions over separate pool connections, exactly like production.
 */
const AUTH_SHIM = `
create schema auth;
create table auth.users (
  id uuid primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);
create role authenticated nologin;
`;

const ORGANIZATION_ID = randomUUID();
const OWNER_ID = randomUUID();
const WAREHOUSE_ID = randomUUID();
const LOCATION_A = randomUUID();
const LOCATION_B = randomUUID();

interface RpcSuccess {
  ok: true;
  result: Record<string, unknown>;
}

interface RpcFailure {
  ok: false;
  code: string | undefined;
  message: string;
}

type RpcOutcome = RpcSuccess | RpcFailure;

interface MovementInput {
  productId: string;
  locationId: string;
  type: 'receipt' | 'issue' | 'adjustment';
  quantity: number;
  key: string;
  reason?: string | null;
  fingerprint?: string;
}

interface TransferInput {
  productId: string;
  sourceLocationId: string;
  targetLocationId: string;
  quantity: number;
  key: string;
  fingerprint?: string;
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 5432;
      server.close(() => resolvePort(port));
    });
  });
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function failure(error: unknown): RpcFailure {
  const candidate = error as { code?: string; message?: string };
  return {
    ok: false,
    code: candidate.code,
    message: candidate.message ?? String(error),
  };
}

describe('real PostgreSQL concurrency', () => {
  let embedded: EmbeddedPostgres;
  let admin: Client;
  let pool: Pool;
  let databaseDir: string;
  let databasePort: number;
  let skuCounter = 0;

  beforeAll(async () => {
    databaseDir = mkdtempSync(join(tmpdir(), 'mystock-concurrency-'));
    databasePort = await freePort();
    embedded = new EmbeddedPostgres({
      databaseDir,
      user: 'postgres',
      password: 'postgres',
      port: databasePort,
      persistent: true,
      onLog: () => undefined,
      onError: () => undefined,
    });

    await embedded.initialise();
    await embedded.start();

    admin = embedded.getPgClient('postgres', '127.0.0.1');
    await admin.connect();
    await admin.query(AUTH_SHIM);

    const migrationsDir = resolve(process.cwd(), '../../supabase/migrations');
    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort();
    for (const file of files) {
      await admin.query(readFileSync(join(migrationsDir, file), 'utf8'));
    }

    pool = new Pool({
      host: '127.0.0.1',
      port: databasePort,
      user: 'postgres',
      password: 'postgres',
      database: 'postgres',
      max: 12,
    });

    await admin.query('insert into auth.users (id, email) values ($1, $2)', [
      OWNER_ID,
      `concurrency-${OWNER_ID}@example.test`,
    ]);
    await admin.query(
      "insert into public.organizations (id, name, slug) values ($1, 'Concurrency Lab', $2)",
      [ORGANIZATION_ID, `concurrency-${ORGANIZATION_ID.slice(0, 8)}`],
    );
    await admin.query(
      'insert into public.memberships (organization_id, user_id, role) values ($1, $2, $3)',
      [ORGANIZATION_ID, OWNER_ID, 'owner'],
    );
    await admin.query(
      "insert into public.warehouses (id, organization_id, code, name) values ($1, $2, 'CONC', 'Concurrency warehouse')",
      [WAREHOUSE_ID, ORGANIZATION_ID],
    );
    await admin.query(
      `insert into public.storage_locations (id, organization_id, warehouse_id, code, name)
       values ($1, $3, $4, 'A-01', 'Concurrency A'), ($2, $3, $4, 'A-02', 'Concurrency B')`,
      [LOCATION_A, LOCATION_B, ORGANIZATION_ID, WAREHOUSE_ID],
    );
  }, 120_000);

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await embedded?.stop().catch(() => undefined);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    try {
      rmSync(databaseDir, { recursive: true, force: true });
    } catch {
      // Windows may keep a handle briefly; the OS cleans the temp directory.
    }
  }, 60_000);

  async function asOwner<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: OWNER_ID, role: 'authenticated' }),
      ]);
      const value = await fn(client);
      await client.query('commit');
      return value;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async function capture<T>(fn: (client: PoolClient) => Promise<T>): Promise<RpcOutcome> {
    try {
      return { ok: true, result: (await asOwner(fn)) as Record<string, unknown> };
    } catch (error) {
      return failure(error);
    }
  }

  async function createProduct(): Promise<string> {
    skuCounter += 1;
    const id = randomUUID();
    await admin.query(
      `insert into public.products (id, organization_id, sku, name)
       values ($1, $2, $3, $4)`,
      [
        id,
        ORGANIZATION_ID,
        `CONC-${String(skuCounter).padStart(3, '0')}`,
        `Concurrency ${skuCounter}`,
      ],
    );
    return id;
  }

  function postMovement(client: PoolClient, input: MovementInput) {
    const payload = {
      productId: input.productId,
      locationId: input.locationId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
    };
    return client
      .query(
        `select app.post_stock_movement(
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::app.stock_movement_type,
           $6::numeric, $7, $8, $9, 'manual'::app.stock_reference_type, null, null, null
         ) as result`,
        [
          ORGANIZATION_ID,
          input.productId,
          WAREHOUSE_ID,
          input.locationId,
          input.type,
          input.quantity,
          input.key,
          input.fingerprint ?? fingerprint(payload),
          input.reason ?? null,
        ],
      )
      .then((response) => response.rows[0]?.result as Record<string, unknown>);
  }

  function postTransfer(client: PoolClient, input: TransferInput) {
    const payload = {
      productId: input.productId,
      sourceLocationId: input.sourceLocationId,
      targetLocationId: input.targetLocationId,
      quantity: input.quantity,
    };
    return client
      .query(
        `select app.post_stock_transfer(
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
           $7::numeric, null, $8, $9, null
         ) as result`,
        [
          ORGANIZATION_ID,
          input.productId,
          WAREHOUSE_ID,
          input.sourceLocationId,
          WAREHOUSE_ID,
          input.targetLocationId,
          input.quantity,
          input.key,
          input.fingerprint ?? fingerprint(payload),
        ],
      )
      .then((response) => response.rows[0]?.result as Record<string, unknown>);
  }

  async function balances(productId: string): Promise<Map<string, number>> {
    const result = await admin.query<{ location_id: string; on_hand: string }>(
      `select location_id, on_hand from public.stock_balances
       where organization_id = $1 and product_id = $2`,
      [ORGANIZATION_ID, productId],
    );
    return new Map(result.rows.map((row) => [row.location_id, Number(row.on_hand)]));
  }

  async function ledgerTotal(productId: string): Promise<number> {
    const result = await admin.query<{ total: string }>(
      `select coalesce(sum(quantity_delta), 0)::text as total
       from public.stock_movements
       where organization_id = $1 and product_id = $2`,
      [ORGANIZATION_ID, productId],
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async function movementCount(productId: string): Promise<number> {
    const result = await admin.query<{ count: string }>(
      `select count(*)::text as count from public.stock_movements
       where organization_id = $1 and product_id = $2`,
      [ORGANIZATION_ID, productId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  it('parallel issues cannot oversell the same balance', async () => {
    const productId = await createProduct();
    await asOwner((client) =>
      postMovement(client, {
        productId,
        locationId: LOCATION_A,
        type: 'receipt',
        quantity: 10,
        key: `oversell-receipt-${productId}`,
        reason: 'Opening stock',
      }),
    );

    const outcomes = await Promise.all([
      capture((client) =>
        postMovement(client, {
          productId,
          locationId: LOCATION_A,
          type: 'issue',
          quantity: 6,
          key: `oversell-a-${productId}`,
        }),
      ),
      capture((client) =>
        postMovement(client, {
          productId,
          locationId: LOCATION_A,
          type: 'issue',
          quantity: 6,
          key: `oversell-b-${productId}`,
        }),
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    const rejected = outcomes.find((outcome) => !outcome.ok);
    expect(rejected && !rejected.ok ? rejected.code : undefined).toBe('23514');
    expect(rejected && !rejected.ok ? rejected.message : '').toMatch(/insufficient_stock/);

    expect((await balances(productId)).get(LOCATION_A)).toBe(4);
    expect(await ledgerTotal(productId)).toBe(4);
    expect(await movementCount(productId)).toBe(2);
  }, 30_000);

  it('duplicate idempotency keys create exactly one movement', async () => {
    const productId = await createProduct();
    const key = `duplicate-${productId}`;

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        capture((client) =>
          postMovement(client, {
            productId,
            locationId: LOCATION_A,
            type: 'receipt',
            quantity: 10,
            key,
            reason: 'Duplicate protection',
          }),
        ),
      ),
    );

    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    const results = outcomes.map((outcome) => (outcome as RpcSuccess).result);
    expect(results.filter((result) => result.duplicate === false)).toHaveLength(1);
    expect(results.filter((result) => result.duplicate === true)).toHaveLength(4);
    expect(results.every((result) => result.onHand === 10)).toBe(true);

    expect(await movementCount(productId)).toBe(1);
    expect((await balances(productId)).get(LOCATION_A)).toBe(10);
  }, 30_000);

  it('opposite transfers serialize without deadlocks or lost stock', async () => {
    const productId = await createProduct();
    await asOwner((client) =>
      postMovement(client, {
        productId,
        locationId: LOCATION_A,
        type: 'receipt',
        quantity: 20,
        key: `transfer-receipt-${productId}`,
      }),
    );
    await asOwner((client) =>
      postTransfer(client, {
        productId,
        sourceLocationId: LOCATION_A,
        targetLocationId: LOCATION_B,
        quantity: 5,
        key: `transfer-prime-${productId}`,
      }),
    );

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        capture((client) =>
          postTransfer(client, {
            productId,
            sourceLocationId: index % 2 === 0 ? LOCATION_A : LOCATION_B,
            targetLocationId: index % 2 === 0 ? LOCATION_B : LOCATION_A,
            quantity: 1,
            key: `transfer-${index}-${productId}`,
          }),
        ),
      ),
    );

    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([]);

    const balance = await balances(productId);
    expect(balance.get(LOCATION_A)).toBe(15);
    expect(balance.get(LOCATION_B)).toBe(5);
    expect(await ledgerTotal(productId)).toBe(20);
    expect(await movementCount(productId)).toBe(23);
  }, 60_000);

  it('reservation and issue racing keep available stock non-negative', async () => {
    const productId = await createProduct();
    await asOwner((client) =>
      postMovement(client, {
        productId,
        locationId: LOCATION_A,
        type: 'receipt',
        quantity: 10,
        key: `reserve-receipt-${productId}`,
      }),
    );

    const outcomes = await Promise.all([
      capture(async (client) => {
        const response = await client.query(
          `select app.reserve_stock(
               $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::numeric, $6, $7,
               null, 'manual'::app.stock_reference_type, null, 'race'
             ) as result`,
          [
            ORGANIZATION_ID,
            productId,
            WAREHOUSE_ID,
            LOCATION_A,
            6,
            `reserve-race-${productId}`,
            fingerprint({ productId, quantity: 6, kind: 'reservation' }),
          ],
        );
        return response.rows[0]?.result as Record<string, unknown>;
      }),
      capture((client) =>
        postMovement(client, {
          productId,
          locationId: LOCATION_A,
          type: 'issue',
          quantity: 6,
          key: `issue-race-${productId}`,
        }),
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);

    const balance = await balances(productId);
    const onHand = balance.get(LOCATION_A) ?? 0;
    const reserved = await admin
      .query<{ reserved: string }>(
        `select coalesce(sum(quantity), 0)::text as reserved
           from public.stock_reservations
           where organization_id = $1 and product_id = $2 and status = 'active'`,
        [ORGANIZATION_ID, productId],
      )
      .then((response) => Number(response.rows[0]?.reserved ?? 0));

    expect(onHand).toBeGreaterThanOrEqual(0);
    expect(reserved).toBeLessThanOrEqual(onHand);
    expect(await ledgerTotal(productId)).toBe(onHand);

    const reconciliation = await asOwner((client) =>
      client.query<{
        difference: string;
        ledger_on_hand: string;
      }>(
        `select difference, ledger_on_hand
           from app.stock_reconciliation($1::uuid)
           where product_id = $2`,
        [ORGANIZATION_ID, productId],
      ),
    );
    for (const row of reconciliation.rows) {
      expect(Number(row.difference)).toBe(0);
      expect(Number(row.ledger_on_hand)).toBe(onHand);
    }
  }, 30_000);

  it('reconciliation reports no drift after concurrent postings', async () => {
    const result = await asOwner((client) =>
      client.query<{ product_id: string; difference: string }>(
        `select product_id, difference from app.stock_reconciliation($1::uuid)`,
        [ORGANIZATION_ID],
      ),
    );

    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(Number(row.difference)).toBe(0);
    }
  }, 30_000);
});
