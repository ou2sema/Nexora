import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const AUTH_ORIGIN = 'http://localhost:4200';
const API_BASE = 'http://localhost:4101/api/v1';
const ORGANIZATION_ID = '10000000-0000-4000-8000-00000000000a';
const WAREHOUSE_ID = '50000000-0000-4000-8000-00000000000a';
const LOCATION_ID = '60000000-0000-4000-8000-00000000000a';
const PHONE_ID = '20000000-0000-4000-8000-0000000000a1';
const PHONE_BARCODE = '2000000000015';
const CABLE_ID = '20000000-0000-4000-8000-0000000000a2';
const CABLE_CODE = 'ms-a-0002';
const CABLE_ORDERED = 5;
const CABLE_RECEIVED = 4;
const PHONE_ORDERED = 2;
const PASSWORD = 'local-e2e-password';

let token = '';
let orderId = '';
let orderNumber = '';

// The register keeps every serial forever, so each run reads a batch nobody scanned before.
const batch = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
const serialFirst = `E2E-${batch}-A`;
const serialSecond = `E2E-${batch}-B`;
const serialExtra = `E2E-${batch}-C`;
const imei = `35${Date.now()}`;

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

/** One unit on the shelf, so the scanned product renders a stock line to measure against. */
async function seedCableStock(): Promise<void> {
  await apiPost('/stock-movements', {
    productId: CABLE_ID,
    warehouseId: WAREHOUSE_ID,
    locationId: LOCATION_ID,
    type: 'receipt',
    quantity: 1,
    reason: 'Local E2E dock fixture',
  });
}

/** Five cables and two serialized phones, sent so the dock has a delivery to receive. */
async function openPurchaseOrder(): Promise<void> {
  const supplier = (await apiPost('/suppliers', {
    name: `Dock supplier ${batch}`,
    contactName: 'E2E contact',
    email: 'e2e@example.com',
    countryCode: 'TN',
  })) as { id: string };

  const order = (await apiPost('/purchase-orders', {
    supplierId: supplier.id,
    warehouseId: WAREHOUSE_ID,
    locationId: LOCATION_ID,
    lines: [
      { productId: CABLE_ID, quantity: CABLE_ORDERED, unitCostMinor: 4500 },
      { productId: PHONE_ID, quantity: PHONE_ORDERED, unitCostMinor: 3150000 },
    ],
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

/**
 * A hardware read, not a click: the scanner fires a burst of keystrokes and ends it
 * with Enter, which the keyboard wedge owns. The Look up button is never touched.
 */
async function scan(page: Page, code: string): Promise<void> {
  await page.getByLabel('Barcode, serial number or SKU').click();
  await page.keyboard.type(code, { delay: 10 });
  await page.keyboard.press('Enter');
}

async function lookup(page: Page, code: string): Promise<void> {
  await page.getByLabel('Barcode, serial number or SKU').fill(code);
  await page.getByRole('button', { name: 'Look up' }).click();
}

function dockSection(page: Page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /Receiving dock/ }) });
}

/**
 * The shelf is read from the ledger, not from the scan card: other specs move the same
 * cable, and a card can only ever show what the last scan said.
 */
async function cableOnHand(request: APIRequestContext): Promise<number> {
  const response = await request.get(`${API_BASE}/organizations/${ORGANIZATION_ID}/stock-levels`, {
    headers: authHeaders(),
    params: { productId: CABLE_ID, page: 1, pageSize: 20 },
  });

  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { items: { onHand: number }[] };
  return body.items.reduce((sum, item) => sum + item.onHand, 0);
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
    await apiPost(`/stock-counts/${count.id}/discard`);
  }

  await seedCableStock();
  await openPurchaseOrder();
});

test('the receiving dock turns scans into one posted purchase receipt', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.goto('/scan');
  await expect(page.getByRole('heading', { level: 1, name: 'Scanning' })).toBeVisible();

  // Other specs move the same shelf, so the receipt is proven as a measured delta.
  const onHandBefore = await cableOnHand(request);

  await dockSection(page).getByLabel('Purchase order').selectOption(orderId);
  await expect(dockSection(page).getByText('Lands in MAIN / A-01.')).toBeVisible();

  // A quantity product: one read queues one unit, and the typed box overrides the count.
  await scan(page, CABLE_CODE);
  await expect(dockSection(page).getByText('USB-C cable 2m: 1 of 5 received.')).toBeVisible();
  await dockSection(page).getByLabel('Units received now').fill(String(CABLE_RECEIVED));
  await expect(dockSection(page).getByText('5 to receive · 4 ready')).toBeVisible();

  // A serialized product: its barcode names the line, then every unit is read as it arrives.
  await scan(page, PHONE_BARCODE);
  await expect(
    dockSection(page).getByText('iPhone 15 128GB is serialized: 0 of 2. Scan each unit.'),
  ).toBeVisible();
  await expect(dockSection(page).getByText('Serial scans land on this line.')).toBeVisible();

  await scan(page, serialFirst);
  await expect(
    dockSection(page).getByText(`${serialFirst} queued for iPhone 15 128GB: 1 of 2.`),
  ).toBeVisible();

  // A phone box carries both codes; the IMEI read joins the serial scanned before it.
  await scan(page, imei);
  await expect(
    dockSection(page).getByText(`IMEI ${imei} joined to the iPhone 15 128GB serial before it.`),
  ).toBeVisible();
  await expect(dockSection(page).getByText(`${serialFirst} · ${imei}`)).toBeVisible();

  await scan(page, serialSecond);
  await expect(
    dockSection(page).getByText(`${serialSecond} queued for iPhone 15 128GB: 2 of 2.`),
  ).toBeVisible();

  // A third unit nobody ordered is refused at the dock, never posted and never dropped.
  await scan(page, serialExtra);
  await expect(
    dockSection(page).getByText('iPhone 15 128GB is fully delivered. Nothing more can be queued.'),
  ).toBeVisible();

  await expect(
    dockSection(page).getByRole('button', { name: 'Post receipt · 6 units · 2 lines' }),
  ).toBeEnabled();
  await dockSection(page)
    .getByRole('button', { name: /^Post receipt/ })
    .click();
  await expect(
    dockSection(page).getByText(`${orderNumber} is now Partially received. Received 6 units.`),
  ).toBeVisible();

  // The ledger is the durable result, and the dock reopens on what the order still expects.
  expect(await cableOnHand(request)).toBe(onHandBefore + CABLE_RECEIVED);
  await expect(dockSection(page).getByRole('listitem')).toHaveCount(1);
  await expect(dockSection(page).getByText('1 to receive · 0 ready')).toBeVisible();
});

test('the count tab still posts a variance against the shelf', async ({ page, request }) => {
  await signIn(page);
  await page.goto('/scan');

  await page.getByRole('tab', { name: 'Inventory count' }).click();
  await expect(page.getByRole('heading', { name: 'Start a count' })).toBeVisible();

  await page.getByLabel('Warehouse').selectOption(WAREHOUSE_ID);
  await page.getByLabel('Storage location').selectOption(LOCATION_ID);
  await page.getByRole('button', { name: 'Start count' }).click();
  await expect(page.getByRole('heading', { name: 'Record a counted product' })).toBeVisible();
  await expect(
    page.getByText('Scan a product to record the first counted quantity.'),
  ).toBeVisible();

  await lookup(page, CABLE_CODE);
  await page.getByLabel('Mode').selectOption('set');
  await page.getByLabel('Quantity', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Record count' }).click();
  await expect(page.getByText('USB-C cable 2m: counted 7 (absolute).')).toBeVisible();

  await page.getByRole('button', { name: 'Post count' }).click();
  await expect(page.getByText(/Posting writes \d+ adjustment/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm post' }).click();
  await expect(page.getByText(/^Count posted: 1 line, /)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start a count' })).toBeVisible();

  // An absolute count is the deterministic end state: the ledger must read exactly 7.
  expect(await cableOnHand(request)).toBe(7);
});
