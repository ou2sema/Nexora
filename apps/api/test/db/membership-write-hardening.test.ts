import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, USERS, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);
});

afterAll(async () => {
  await database.client.close();
});

describe('membership write hardening', () => {
  it('preserves authenticated SELECT but routes all membership writes through RPCs', async () => {
    const readable = await database.asUser(USERS.alice, (client) =>
      client.query<{ user_id: string }>(
        'select user_id from public.memberships where organization_id = $1 order by user_id',
        [ORGS.a],
      ),
    );
    expect(readable.rows.map((row) => row.user_id)).toEqual([USERS.alice, USERS.dave]);

    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query(
          "insert into public.memberships (organization_id, user_id, role) values ($1, $2, 'viewer')",
          [ORGS.a, USERS.carol],
        ),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);

    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query(
          "update public.memberships set role = 'manager' where organization_id = $1 and user_id = $2",
          [ORGS.a, USERS.dave],
        ),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);

    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query('delete from public.memberships where organization_id = $1 and user_id = $2', [
          ORGS.a,
          USERS.dave,
        ]),
      ),
    ).rejects.toThrow(/permission denied for table memberships/i);

    await database.asUser(
      USERS.alice,
      (client) =>
        client.query("select app.change_member_role($1, $2, 'manager')", [ORGS.a, USERS.dave]),
      { commit: true },
    );
    const changed = await database.asUser(USERS.alice, (client) =>
      client.query<{ role: string }>(
        'select role from public.memberships where organization_id = $1 and user_id = $2',
        [ORGS.a, USERS.dave],
      ),
    );
    expect(changed.rows).toEqual([{ role: 'manager' }]);

    await database.asUser(
      USERS.alice,
      (client) =>
        client.query('select app.remove_organization_member($1, $2)', [ORGS.a, USERS.dave]),
      { commit: true },
    );
    const removed = await database.asUser(USERS.alice, (client) =>
      client.query('select 1 from public.memberships where organization_id = $1 and user_id = $2', [
        ORGS.a,
        USERS.dave,
      ]),
    );
    expect(removed.rows).toHaveLength(0);
  });
});
