import { expect, test, type Page } from '@playwright/test';

const AUTH_ORIGIN = 'http://localhost:4200';
const API_BASE = 'http://localhost:4101/api/v1';
const ORGANIZATION_ID = '10000000-0000-4000-8000-00000000000a';
const WAREHOUSE_ID = '50000000-0000-4000-8000-00000000000a';
const LOCATION_ID = '60000000-0000-4000-8000-00000000000a';
const CABLE_CODE = 'ms-a-0002';
const PASSWORD = 'local-e2e-password';

let token = '';

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
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

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email', { exact: true }).fill('alice@example.com');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function lookup(page: Page, code: string): Promise<void> {
  await page.getByLabel('Barcode, serial number or SKU').fill(code);
  await page.getByRole('button', { name: 'Look up' }).click();
}

test.beforeAll(async ({ request }) => {
  token = await ownerToken();

  // Only one count may be open per location, so an interrupted run would block the next one.
  const open = await request.get(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/stock-counts?page=1&pageSize=20&status=open`,
    { headers: authHeaders() },
  );
  expect(open.ok(), await open.text()).toBeTruthy();
  const { items } = (await open.json()) as { items: { id: string; locationId: string }[] };

  for (const count of items.filter((item) => item.locationId === LOCATION_ID)) {
    const discarded = await request.post(
      `${API_BASE}/organizations/${ORGANIZATION_ID}/stock-counts/${count.id}/discard`,
      { headers: authHeaders() },
    );
    expect(discarded.ok(), await discarded.text()).toBeTruthy();
  }
});

test('scanning console receives a scanned product and posts an inventory count', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/scan');
  await expect(page.getByRole('heading', { level: 1, name: 'Scanning' })).toBeVisible();
  await expect(page.getByText('Nothing scanned yet')).toBeVisible();

  await lookup(page, CABLE_CODE);
  await expect(page.getByRole('heading', { name: 'USB-C cable 2m' })).toBeVisible();
  await expect(page.getByText('Not assigned')).toBeVisible();

  await page.getByLabel('Warehouse').selectOption(WAREHOUSE_ID);
  await page.getByLabel('Storage location').selectOption(LOCATION_ID);

  const quantity = page.getByLabel('Quantity', { exact: true });
  await quantity.fill('3');
  await page.getByRole('button', { name: 'Post receipt' }).click();
  await expect(page.getByText(/^Received 3 × USB-C cable 2m\. On hand is now /)).toBeVisible();

  await page.getByRole('tab', { name: 'Inventory count' }).click();
  await expect(page.getByRole('heading', { name: 'Start a count' })).toBeVisible();
  await page.getByRole('button', { name: 'Start count' }).click();
  await expect(page.getByRole('heading', { name: 'Record a counted product' })).toBeVisible();
  await expect(
    page.getByText('Scan a product to record the first counted quantity.'),
  ).toBeVisible();

  await page.getByLabel('Mode').selectOption('set');
  await quantity.fill('7');
  await page.getByRole('button', { name: 'Record count' }).click();
  await expect(page.getByText('USB-C cable 2m: counted 7 (absolute).')).toBeVisible();

  await page.getByRole('button', { name: 'Post count' }).click();
  await expect(page.getByText(/Posting writes \d+ adjustment/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm post' }).click();
  await expect(page.getByText(/^Count posted: 1 line, /)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start a count' })).toBeVisible();

  // The posted count is the durable result: the ledger projection must read the counted quantity.
  await lookup(page, CABLE_CODE);
  const cableLine = page.locator('tbody tr').filter({ hasText: 'MAIN / A-01' });
  await expect(cableLine.locator('td').nth(1)).toHaveText('7');
});
