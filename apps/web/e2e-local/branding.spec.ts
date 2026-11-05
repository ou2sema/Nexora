import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const AUTH_ORIGIN = 'http://localhost:4200';
const API_BASE = 'http://localhost:4101/api/v1';
const ORGANIZATION_ID = '10000000-0000-4000-8000-00000000000a';
const WAREHOUSE_ID = '50000000-0000-4000-8000-00000000000a';
const LOCATION_ID = '60000000-0000-4000-8000-00000000000a';
const CABLE_ID = '20000000-0000-4000-8000-0000000000a2';
const PASSWORD = 'local-e2e-password';

/** 4 x 3 transparent PNG: the smallest mark that proves the renderer placed a box. */
const LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAFklEQVR4nGPQiNry/07Ulv8wmoGgAAD76R61DGuNpgAAAABJRU5ErkJggg==',
  'base64',
);

/** 2 x 2 opaque PNG: a second mark whose intrinsic size differs from the first. */
const LOGO_REPLACEMENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGO4o6FxR0ODAUIBACOuBLGNQbmyAAAAAElFTkSuQmCC',
  'base64',
);

const RUN = Date.now().toString(36).toUpperCase();

let token = '';

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function ownerToken(email = 'alice@example.com'): Promise<string> {
  const response = await fetch(`${AUTH_ORIGIN}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: 'a'.repeat(40) },
    body: JSON.stringify({ email, password: PASSWORD }),
  });

  expect(response.ok, `local auth token request failed: ${response.status}`).toBeTruthy();
  const session = (await response.json()) as { access_token: string };
  return session.access_token;
}

async function signIn(page: Page, email = 'alice@example.com'): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

function brandingSection(page: Page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Branding' }) });
}

/**
 * The intrinsic width is the bytes the browser was actually handed. A blob URL cannot
 * prove that, because every object URL is unique even when the content is stale.
 */
function intrinsicWidth(image: Locator): Promise<number> {
  return image.evaluate((el) => (el as HTMLImageElement).naturalWidth);
}

/**
 * The browser prints the mark as an /Image XObject — plus its soft mask when the PNG carries
 * transparency — and an invoice of this size draws no other raster, so a non-zero count is the
 * mark being on the page and zero is the mark having left it.
 */
function imageObjects(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length;
}

async function invoicePdf(request: APIRequestContext, invoiceId: string): Promise<Buffer> {
  const response = await request.get(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/sales-invoices/${invoiceId}/pdf`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return await response.body();
}

/** One-unit counter sale, so the spec prints a real document instead of a fixture row. */
async function createInvoice(request: APIRequestContext): Promise<string> {
  const receipt = await request.post(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/stock-movements`,
    {
      headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
      data: {
        productId: CABLE_ID,
        warehouseId: WAREHOUSE_ID,
        locationId: LOCATION_ID,
        type: 'receipt',
        quantity: 1,
        reason: 'Local E2E branding fixture receipt',
      },
    },
  );
  expect(receipt.ok(), await receipt.text()).toBeTruthy();

  const sale = await request.post(`${API_BASE}/organizations/${ORGANIZATION_ID}/sales-invoices`, {
    headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
    data: {
      warehouseId: WAREHOUSE_ID,
      locationId: LOCATION_ID,
      customerName: `E2E Branding Buyer ${RUN}`,
      lines: [{ kind: 'product', productId: CABLE_ID, quantity: 1, unitPriceMinor: 8900 }],
      paidAmountMinor: 8900,
      paymentMethod: 'cash',
      reference: `E2E-BRAND-${RUN}`,
    },
  });
  expect(sale.ok(), await sale.text()).toBeTruthy();
  const body = (await sale.json()) as { invoiceId: string };
  return body.invoiceId;
}

test.beforeAll(async () => {
  token = await ownerToken();
});

test.describe('organization branding', () => {
  test('uploads the mark, shows it in the workspace, and prints it on the invoice', async ({
    page,
    request,
  }) => {
    await request.delete(`${API_BASE}/organizations/${ORGANIZATION_ID}/logo`, {
      headers: { authorization: `Bearer ${token}` },
    });

    await signIn(page);
    await page.goto('/team');

    const section = brandingSection(page);
    await expect(section.getByText('No logo')).toBeVisible();

    await section.getByLabel('Logo image').setInputFiles({
      name: 'org-a.png',
      mimeType: 'image/png',
      buffer: LOGO_PNG,
    });

    await expect(section.getByRole('img', { name: 'Org A logo' })).toBeVisible();
    // The switcher keeps the mark in the header on every screen; on the narrow project
    // the header hides it, so presence is what this can prove there.
    await expect(page.locator('header img[src^="blob:"]')).toBeAttached();
    await expect
      .poll(() => intrinsicWidth(section.getByRole('img', { name: 'Org A logo' })))
      .toBe(4);

    const invoiceId = await createInvoice(request);
    expect(imageObjects(await invoicePdf(request, invoiceId))).toBeGreaterThan(0);

    // Replacing the mark has to reach the rendered pixels. The response is cached
    // immutably, so a client that re-reads the same URL replays the first file.
    await section.getByLabel('Logo image').setInputFiles({
      name: 'org-a-v2.png',
      mimeType: 'image/png',
      buffer: LOGO_REPLACEMENT_PNG,
    });
    await expect
      .poll(() => intrinsicWidth(section.getByRole('img', { name: 'Org A logo' })))
      .toBe(2);

    await section.getByRole('button', { name: 'Remove logo' }).click();
    await expect(section.getByText('No logo')).toBeVisible();
    await expect(page.locator('header img[src^="blob:"]')).toHaveCount(0);

    // The same document re-rendered without the stored mark, so the file proves where
    // the image came from rather than what the printer cached.
    expect(imageObjects(await invoicePdf(request, invoiceId))).toBe(0);
  });

  test('a viewer sees the mark without the controls', async ({ page }) => {
    await signIn(page, 'dave@example.com');
    await page.goto('/team');

    const section = brandingSection(page);
    await expect(section.getByText('Owners, admins, and managers change the logo.')).toBeVisible();
    await expect(section.getByRole('button', { name: /logo/i })).toHaveCount(0);
  });
});
