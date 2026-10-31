import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGS, USERS, seedFixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './harness';

const PAT = '00000000-0000-4000-8000-0000000000f0';
const GINA = '00000000-0000-4000-8000-0000000000f2';
const PAT_EMAIL = 'pat@example.com';
const GINA_EMAIL = 'gina@example.com';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedFixtures(database.client);

  await database.client.exec(`
    insert into auth.users (id, email) values
      ('${PAT}', '${PAT_EMAIL}'),
      ('${GINA}', '${GINA_EMAIL}');

    update public.profiles set is_platform_admin = true where id = '${PAT}';

    insert into public.memberships (organization_id, user_id, role) values
      ('${ORGS.a}', '${GINA}', 'manager');
  `);
});

afterAll(async () => {
  await database.client.close();
});

async function auditCount(): Promise<number> {
  const result = await database.asPostgres((client) =>
    client.query<{ count: number }>('select count(*)::int as count from public.admin_audit_events'),
  );
  return result.rows[0]?.count ?? -1;
}

describe('platform administrator audit trail', () => {
  it('records organization, invitation and membership actions', async () => {
    const created = await database.asUser(
      PAT,
      (client) =>
        client.query<{ id: string }>(
          "select app.create_organization('Audit Co', 'audit-co') as id",
        ),
      { commit: true },
    );
    const organizationId = created.rows[0]?.id;

    const invitation = await database.asUser(
      PAT,
      (client) =>
        client.query<{ id: string }>(
          "select app.create_organization_invitation($1, 'audited@example.com', 'manager') as id",
          [ORGS.b],
        ),
      { commit: true },
    );
    const invitationId = invitation.rows[0]?.id;

    await database.asUser(
      PAT,
      (client) =>
        client.query('select app.revoke_organization_invitation($1, $2)', [ORGS.b, invitationId]),
      { commit: true },
    );

    await database.asUser(
      PAT,
      (client) =>
        client.query("select app.change_member_role($1, $2, 'admin')", [ORGS.a, USERS.dave]),
      { commit: true },
    );

    await database.asUser(
      PAT,
      (client) =>
        client.query('select app.remove_organization_member($1, $2)', [ORGS.a, USERS.dave]),
      { commit: true },
    );

    const rows = await database.asUser(PAT, (client) =>
      client.query<{
        action: string;
        actor_id: string;
        organization_id: string | null;
        target_email: string | null;
        detail: Record<string, string>;
      }>(
        `select action, actor_id, organization_id, target_email, detail
         from public.admin_audit_events`,
      ),
    );

    expect(rows.rows.map((row) => row.action).sort()).toEqual([
      'invitation_created',
      'invitation_revoked',
      'member_removed',
      'member_role_changed',
      'organization_created',
    ]);
    expect(rows.rows.every((row) => row.actor_id === PAT)).toBe(true);

    const byAction = Object.fromEntries(rows.rows.map((row) => [row.action, row]));

    expect(byAction.organization_created?.organization_id).toBe(organizationId);
    expect(byAction.organization_created?.detail).toMatchObject({
      name: 'Audit Co',
      slug: 'audit-co',
    });
    expect(byAction.invitation_created?.detail).toMatchObject({ role: 'manager' });
    expect(byAction.invitation_created?.target_email).toBe('audited@example.com');
    expect(byAction.invitation_revoked?.target_email).toBe('audited@example.com');
    expect(byAction.member_role_changed?.detail).toMatchObject({ from: 'viewer', to: 'admin' });
    expect(byAction.member_role_changed?.target_email).toBe('dave@example.com');
    expect(byAction.member_removed?.detail).toMatchObject({ role: 'admin' });
  });

  it('does not record organization-level administration', async () => {
    const before = await auditCount();

    const invitation = await database.asUser(
      USERS.alice,
      (client) =>
        client.query<{ id: string }>(
          "select app.create_organization_invitation($1, 'local-viewer@example.com', 'viewer') as id",
          [ORGS.a],
        ),
      { commit: true },
    );

    await database.asUser(
      USERS.alice,
      (client) => client.query("select app.change_member_role($1, $2, 'viewer')", [ORGS.a, GINA]),
      { commit: true },
    );

    await database.asUser(
      USERS.alice,
      (client) =>
        client.query('select app.revoke_organization_invitation($1, $2)', [
          ORGS.a,
          invitation.rows[0]?.id,
        ]),
      { commit: true },
    );

    expect(await auditCount()).toBe(before);
  });

  it('shows audit rows to platform administrators only', async () => {
    const platformRows = await database.asUser(PAT, (client) =>
      client.query('select id from public.admin_audit_events'),
    );
    const ownerRows = await database.asUser(USERS.alice, (client) =>
      client.query('select id from public.admin_audit_events'),
    );
    const viewerRows = await database.asUser(USERS.bob, (client) =>
      client.query('select id from public.admin_audit_events'),
    );

    expect(platformRows.rows.length).toBeGreaterThan(0);
    expect(ownerRows.rows).toHaveLength(0);
    expect(viewerRows.rows).toHaveLength(0);
  });

  it('denies direct writes to organization administrators', async () => {
    await expect(
      database.asUser(USERS.alice, (client) =>
        client.query("insert into public.admin_audit_events (action) values ('forged_action')"),
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });
});
