import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, USERS, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

let database: TestDatabase;

const PNG_HEADER = "decode('89504e470d0a1a0a0000000d', 'hex')";
const JPEG_HEADER = "decode('ffd8ffe000104a46', 'hex')";
const SHORTEST = "decode('0001020304050607', 'hex')";

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);
});

afterAll(async () => {
  await database.client.close();
});

function setLogo(userId: string, organizationId: string, mime: string, bytes: string) {
  return database.asUser(
    userId,
    (client) =>
      client.query<{ logo: { byteLength: number; mime: string } }>(
        `select app.set_organization_logo($1::uuid, $2::text, ${bytes}) as logo`,
        [organizationId, mime],
      ),
    { commit: true },
  );
}

function clearLogo(userId: string, organizationId: string) {
  return database.asUser(
    userId,
    (client) =>
      client.query<{ removed: boolean }>(
        'select app.clear_organization_logo($1::uuid) as removed',
        [organizationId],
      ),
    { commit: true },
  );
}

/** Reads the tenant's rows as they really are, without the row policies in the way. */
function storedLogo(organizationId: string) {
  return database.asPostgres((client) =>
    client.query<{ mime: string; byte_length: number }>(
      `select mime, octet_length(bytes) as byte_length
         from public.organization_logos
        where organization_id = $1`,
      [organizationId],
    ),
  );
}

/** Reads the tenant's rows through the caller's row security. */
function visibleLogo(userId: string | null, organizationId: string) {
  return database.asUser(userId, (client) =>
    client.query<{ mime: string }>(
      'select mime from public.organization_logos where organization_id = $1',
      [organizationId],
    ),
  );
}

describe('organization logo storage', () => {
  it('lets the catalog-writing roles replace one row and refuses everyone else', async () => {
    const uploaded = await setLogo(USERS.alice, ORGS.a, 'image/png', PNG_HEADER);
    expect(uploaded.rows[0]?.logo).toMatchObject({ mime: 'image/png', byteLength: 12 });

    // One mark per organization: the second upload replaces the first.
    await setLogo(USERS.alice, ORGS.a, 'image/jpeg', JPEG_HEADER);
    const stored = await storedLogo(ORGS.a);
    expect(stored.rows).toEqual([{ mime: 'image/jpeg', byte_length: 8 }]);

    await expect(setLogo(USERS.dave, ORGS.a, 'image/png', PNG_HEADER)).rejects.toThrow(/forbidden/);
    await expect(setLogo(USERS.carol, ORGS.a, 'image/png', PNG_HEADER)).rejects.toThrow(
      /forbidden/,
    );
    await expect(setLogo(USERS.bob, ORGS.a, 'image/png', PNG_HEADER)).rejects.toThrow(/forbidden/);

    await expect(clearLogo(USERS.dave, ORGS.a)).rejects.toThrow(/forbidden/);
    await expect(clearLogo(USERS.bob, ORGS.a)).rejects.toThrow(/forbidden/);
  });

  it('records who set the mark and clears it once', async () => {
    await setLogo(USERS.alice, ORGS.a, 'image/png', SHORTEST);
    const author = await database.asPostgres((client) =>
      client.query<{ updated_by: string }>(
        'select updated_by from public.organization_logos where organization_id = $1',
        [ORGS.a],
      ),
    );
    expect(author.rows[0]?.updated_by).toBe(USERS.alice);

    const cleared = await clearLogo(USERS.alice, ORGS.a);
    expect(cleared.rows[0]?.removed).toBe(true);
    expect((await storedLogo(ORGS.a)).rows).toHaveLength(0);

    const again = await clearLogo(USERS.alice, ORGS.a);
    expect(again.rows[0]?.removed).toBe(false);
  });

  it('is readable by every member of the tenant and by nobody outside it', async () => {
    await setLogo(USERS.alice, ORGS.a, 'image/png', PNG_HEADER);

    for (const userId of [USERS.alice, USERS.dave]) {
      expect((await visibleLogo(userId, ORGS.a)).rows).toHaveLength(1);
    }

    expect((await visibleLogo(USERS.carol, ORGS.a)).rows).toHaveLength(0);
    expect((await visibleLogo(USERS.bob, ORGS.a)).rows).toHaveLength(0);
    expect((await visibleLogo(USERS.alice, ORGS.b)).rows).toHaveLength(0);
    expect((await visibleLogo(null, ORGS.a)).rows).toHaveLength(0);
  });

  it('refuses a client write and any image shape pdf-lib cannot embed', async () => {
    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query(
          `insert into public.organization_logos (organization_id, mime, bytes)
           values ($1, 'image/png', ${PNG_HEADER})`,
          [ORGS.a],
        ),
      ),
    ).rejects.toThrow(/permission denied for table organization_logos/);

    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query('delete from public.organization_logos where organization_id = $1', [ORGS.a]),
      ),
    ).rejects.toThrow(/permission denied for table organization_logos/);

    await expect(setLogo(USERS.alice, ORGS.a, 'image/svg+xml', PNG_HEADER)).rejects.toThrow(
      /invalid_logo_mime/,
    );
    await expect(setLogo(USERS.alice, ORGS.a, 'image/webp', PNG_HEADER)).rejects.toThrow(
      /invalid_logo_mime/,
    );
    await expect(
      setLogo(USERS.alice, ORGS.a, 'image/png', "decode('89504e47', 'hex')"),
    ).rejects.toThrow(/invalid_logo_bytes/);
    await expect(
      setLogo(USERS.alice, ORGS.a, 'image/png', "convert_to(repeat('x', 500000), 'utf8')"),
    ).rejects.toThrow(/invalid_logo_bytes/);

    // None of the refusals disturbed the row the earlier test wrote.
    expect((await storedLogo(ORGS.a)).rows).toEqual([{ mime: 'image/png', byte_length: 12 }]);
  });

  it('drops the mark with the organization', async () => {
    const orphanOrg = '10000000-0000-4000-8000-00000000000c';

    // No membership: deleting an organization that still has an owner is refused by
    // app.protect_last_owner, so the cascade path is exercised on an empty tenant.
    await database.asPostgres((client) =>
      client.query(
        "insert into public.organizations (id, name, slug) values ($1, 'Org C', 'org-c')",
        [orphanOrg],
      ),
    );
    await database.asPostgres((client) =>
      client.query(
        `insert into public.organization_logos (organization_id, mime, bytes)
         values ($1, 'image/jpeg', ${JPEG_HEADER})`,
        [orphanOrg],
      ),
    );
    expect((await storedLogo(orphanOrg)).rows).toHaveLength(1);

    await database.asPostgres((client) =>
      client.query('delete from public.organizations where id = $1', [orphanOrg]),
    );
    expect((await storedLogo(orphanOrg)).rows).toHaveLength(0);
  });
});
