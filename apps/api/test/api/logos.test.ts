import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MAX_LOGO_BYTES } from '@mystock/contracts';

import { ORGS, USERS } from '../db/fixtures';
import { LOGO_JPEG, LOGO_PNG } from './logo-image';
import { createTestContext, type TestContext } from './test-app';

const PNG = LOGO_PNG;
const JPEG = LOGO_JPEG;

describe('organization logos', () => {
  let ctx: TestContext;
  let aliceToken: string;
  let bobToken: string;
  let daveToken: string;
  let carolToken: string;

  const server = () => ctx.app.getHttpServer();
  const auth = (token: string) => `Bearer ${token}`;
  const logoUrl = (organizationId: string) => `/api/v1/organizations/${organizationId}/logo`;

  const putLogo = (token: string, organizationId: string) =>
    request(server()).put(logoUrl(organizationId)).set('authorization', auth(token));
  const getLogo = (token: string, organizationId: string) =>
    request(server()).get(logoUrl(organizationId)).set('authorization', auth(token));
  const deleteLogo = (token: string, organizationId: string) =>
    request(server()).delete(logoUrl(organizationId)).set('authorization', auth(token));
  const me = (token: string) =>
    request(server()).get('/api/v1/me').set('authorization', auth(token));

  beforeAll(async () => {
    ctx = await createTestContext();
    aliceToken = await ctx.tokenFor(USERS.alice, { email: 'alice@example.com' });
    bobToken = await ctx.tokenFor(USERS.bob, { email: 'bob@example.com' });
    daveToken = await ctx.tokenFor(USERS.dave, { email: 'dave@example.com' });
    carolToken = await ctx.tokenFor(USERS.carol, { email: 'carol@example.com' });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('refuses an upload without a token', async () => {
    const response = await request(server())
      .put(logoUrl(ORGS.a))
      .set('content-type', 'image/png')
      .send(PNG);

    expect(response.status).toBe(401);
  });

  it('stores a PNG for the writer who uploads it', async () => {
    const response = await putLogo(aliceToken, ORGS.a).set('content-type', 'image/png').send(PNG);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      organizationId: ORGS.a,
      mime: 'image/png',
      byteLength: PNG.byteLength,
      updatedAt: expect.any(String),
    });
  });

  it('serves the stored bytes to any member of the organization', async () => {
    const owner = await getLogo(aliceToken, ORGS.a);
    expect(owner.status).toBe(200);
    expect(owner.headers['content-type']).toContain('image/png');
    expect(owner.headers['cache-control']).toBe('private, max-age=86400, immutable');
    expect(Buffer.from(owner.body)).toEqual(PNG);

    const viewer = await getLogo(daveToken, ORGS.a);
    expect(viewer.status).toBe(200);
    expect(Buffer.from(viewer.body)).toEqual(PNG);
  });

  it('hides the logo from another tenant', async () => {
    const outsider = await getLogo(bobToken, ORGS.a);
    expect(outsider.status).toBe(404);
    expect(outsider.body.error.code).toBe('organization_not_found');

    const nonMember = await getLogo(carolToken, ORGS.a);
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe('organization_not_found');
  });

  it('replaces the mark with a JPEG and keeps one row per organization', async () => {
    const response = await putLogo(aliceToken, ORGS.a).set('content-type', 'image/jpeg').send(JPEG);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      organizationId: ORGS.a,
      mime: 'image/jpeg',
      byteLength: JPEG.byteLength,
      updatedAt: expect.any(String),
    });

    const downloaded = await getLogo(aliceToken, ORGS.a);
    expect(Buffer.from(downloaded.body)).toEqual(JPEG);

    const { rows } = await ctx.database.query<{ count: string }>(
      'select count(*)::text as count from public.organization_logos where organization_id = $1',
      [ORGS.a],
    );
    expect(rows[0]?.count).toBe('1');
  });

  it('carries the logo summary in /me and clears it again', async () => {
    const withLogo = await me(aliceToken);
    expect(withLogo.body.memberships[0]).toEqual({
      organizationId: ORGS.a,
      organizationName: 'Org A',
      organizationSlug: 'org-a',
      role: 'owner',
      logo: {
        organizationId: ORGS.a,
        mime: 'image/jpeg',
        byteLength: JPEG.byteLength,
        updatedAt: expect.any(String),
      },
    });

    const removed = await deleteLogo(aliceToken, ORGS.a);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ removed: true });

    const missing = await getLogo(aliceToken, ORGS.a);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('logo_not_found');

    const twice = await deleteLogo(aliceToken, ORGS.a);
    expect(twice.body).toEqual({ removed: false });

    const afterDelete = await me(aliceToken);
    expect(afterDelete.body.memberships[0].logo).toBeNull();
  });

  it('refuses to let a viewer change the mark', async () => {
    const upload = await putLogo(daveToken, ORGS.a).set('content-type', 'image/png').send(PNG);
    expect(upload.status).toBe(403);
    expect(upload.body.error.code).toBe('forbidden');

    const removal = await deleteLogo(daveToken, ORGS.a);
    expect(removal.status).toBe(403);
  });

  it('refuses a media type pdf-lib cannot embed', async () => {
    const svg = await putLogo(aliceToken, ORGS.a)
      .set('content-type', 'image/svg+xml')
      .send('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    expect(svg.status).toBe(415);
    expect(svg.body.error.code).toBe('unsupported_logo_type');

    const webp = await putLogo(aliceToken, ORGS.a).set('content-type', 'image/webp').send(PNG);
    expect(webp.status).toBe(415);

    const json = await putLogo(aliceToken, ORGS.a)
      .set('content-type', 'application/json')
      .send({ logo: PNG.toString('base64') });
    expect(json.status).toBe(415);
  });

  it('refuses bytes that are not the image they claim to be', async () => {
    const wrongType = await putLogo(aliceToken, ORGS.a).set('content-type', 'image/jpeg').send(PNG);
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.error.code).toBe('invalid_logo_image');
    expect(wrongType.body.error.details).toEqual({ detected: 'image/png', declared: 'image/jpeg' });

    const notAnImage = await putLogo(aliceToken, ORGS.a)
      .set('content-type', 'image/png')
      .send(Buffer.from('this is a plain text body, not an image'));
    expect(notAnImage.status).toBe(400);
    expect(notAnImage.body.error.code).toBe('invalid_logo_image');
  });

  it('refuses an image the renderer cannot embed', async () => {
    // A real PNG signature that stops before the image data: accepted at the write, it
    // would fail every later document of this organization.
    const truncated = Buffer.concat([PNG.subarray(0, 24), Buffer.alloc(16)]);

    const response = await putLogo(aliceToken, ORGS.a)
      .set('content-type', 'image/png')
      .send(truncated);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_logo_image');
  });

  it('refuses an empty upload and one over the byte cap', async () => {
    const empty = await putLogo(aliceToken, ORGS.a)
      .set('content-type', 'image/png')
      .send(Buffer.alloc(0));
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('invalid_logo_image');

    const oversized = await putLogo(aliceToken, ORGS.a)
      .set('content-type', 'image/png')
      .send(Buffer.alloc(MAX_LOGO_BYTES + 1, 0x50));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('payload_too_large');

    const stillMissing = await getLogo(aliceToken, ORGS.a);
    expect(stillMissing.status).toBe(404);
  });

  it('leaves logo null for an organization that never uploaded one', async () => {
    const response = await me(bobToken);
    expect(response.body.memberships[0].logo).toBeNull();
  });
});
