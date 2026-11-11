import { stat } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

const AUTH_ORIGIN = 'http://localhost:4200';
const API_BASE = 'http://localhost:4101/api/v1';
const ORGANIZATION_ID = '10000000-0000-4000-8000-00000000000a';
const WAREHOUSE_ID = '50000000-0000-4000-8000-00000000000a';
const LOCATION_ID = '60000000-0000-4000-8000-00000000000a';
const PASSWORD = 'local-e2e-password';
const UNITS = 3;

let token = '';
let orderId = '';
let orderNumber = '';
let productBarcode = '';

const batch = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
const productName = `Tracked widget ${batch}`;
const productSku = `TRACKED-${batch}`;

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

function writeHeaders(): Record<string, string> {
  return { ...authHeaders(), 'idempotency-key': crypto.randomUUID() };
}

async function ownerToken(): Promise<string> {
  const response = await fetch(`${AUTH_ORIGIN}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: 'a'.repeat(40) },
    body: JSON.stringify({ email: 'alice@example.com', password: PASSWORD }),
  });

  expect(response.ok, `local auth token request failed: ${response.status}`).toBeTruthy();
  const session = (await response.json()) as { access_token: string };
  return session.access_token;
}

async function apiPost(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${API_BASE}/organizations/${ORGANIZATION_ID}${path}`, {
    method: 'POST',
    headers: writeHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();

  expect(response.ok, `${path} failed: ${text}`).toBeTruthy();
  return text === '' ? null : (JSON.parse(text) as unknown);
}

/** A tracked product, its shared model barcode, and an ordered delivery of three units. */
async function openTrackedDelivery(): Promise<void> {
  const product = (await apiPost('/products', {
    sku: productSku,
    name: productName,
    isIndividuallyTracked: true,
  })) as { id: string };

  const barcode = (await apiPost(`/products/${product.id}/barcode`)) as { barcode: string };
  productBarcode = barcode.barcode;

  const supplier = (await apiPost('/suppliers', {
    name: `Tracked supplier ${batch}`,
    countryCode: 'TN',
  })) as { id: string };

  const order = (await apiPost('/purchase-orders', {
    supplierId: supplier.id,
    warehouseId: WAREHOUSE_ID,
    locationId: LOCATION_ID,
    lines: [{ productId: product.id, quantity: UNITS, unitCostMinor: 1500 }],
  })) as { orderId: string; number: string };
  orderId = order.orderId;
  orderNumber = order.number;

  await apiPost(`/purchase-orders/${orderId}/order`);
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email', { exact: true }).fill('alice@example.com');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

function dockSection(page: Page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /Receiving dock/ }) });
}

async function scan(page: Page, code: string): Promise<void> {
  await page.getByLabel('Barcode, serial number or SKU').click();
  await page.keyboard.type(code, { delay: 10 });
  await page.keyboard.press('Enter');
}

async function lookup(page: Page, code: string): Promise<void> {
  await page.getByLabel('Barcode, serial number or SKU').fill(code);
  await page.getByRole('button', { name: 'Look up' }).click();
}

test.beforeAll(async () => {
  token = await ownerToken();
  await openTrackedDelivery();
});

test('a tracked delivery prints one unit label per received unit', async ({ page }) => {
  await signIn(page);
  await page.goto('/scan');

  const dock = dockSection(page);
  await dock.getByLabel('Purchase order').selectOption(orderId);
  await expect(
    dock.getByText('One label and one unit record will be created per unit received.'),
  ).toBeVisible();

  // The shared model barcode still counts single units for this line.
  await scan(page, productBarcode);
  await expect(dock.getByText(`${productName}: 1 of ${UNITS} received.`)).toBeVisible();
  await dock.getByLabel('Units received now').fill(String(UNITS));
  await expect(dock.getByText(`${UNITS} to receive · ${UNITS} ready`)).toBeVisible();

  await dock.getByRole('button', { name: `Post receipt · ${UNITS} units · 1 line` }).click();
  await expect(
    dock.getByText(`${orderNumber} is now Received. Received ${UNITS} units.`),
  ).toBeVisible();

  // One label target per registered unit; the dialog titles are the unit codes themselves.
  await dock.getByRole('button', { name: `Print ${UNITS} units` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Print labels')).toBeVisible();

  const targets = await dialog.getByRole('listitem').allTextContents();
  expect(targets).toHaveLength(UNITS);

  const unitCodes = targets
    .flatMap((text) => text.match(/NX[A-F0-9]{20}/g) ?? [])
    .filter((code, index, all) => all.indexOf(code) === index);
  expect(unitCodes).toHaveLength(UNITS);
  for (const target of targets) expect(target).toContain('unit');

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^nexora-labels-\d{4}-\d{2}-\d{2}\.pdf$/);
  const path = await download.path();
  expect(path, 'the label sheet must be saved to disk').toBeTruthy();
  expect((await stat(path!)).size).toBeGreaterThan(2000);

  // A unit code resolves to that exact physical item, not to the model.
  await lookup(page, unitCodes[0]!);
  const unitCard = page.locator('article').filter({ hasText: unitCodes[0]! });
  await expect(unitCard.getByText('Individually tracked unit')).toBeVisible();
  await expect(unitCard.getByRole('heading', { level: 2, name: unitCodes[0]! })).toBeVisible();
  await expect(unitCard.getByText(productSku)).toBeVisible();
  await expect(unitCard.getByRole('heading', { name: 'Unit history' })).toBeVisible();
  await expect(unitCard.getByRole('listitem').filter({ hasText: 'Received' })).toHaveCount(1);

  // The shared product barcode still resolves aggregate stock for the model.
  await lookup(page, productBarcode);
  const productCard = page.locator('article').filter({ hasText: productName });
  await expect(productCard.getByText('Quantity product')).toBeVisible();
  await expect(productCard.getByRole('heading', { level: 2, name: productName })).toBeVisible();
});
