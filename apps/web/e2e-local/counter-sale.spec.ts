import { readFile } from 'node:fs/promises';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const AUTH_ORIGIN = 'http://localhost:4200';
const API_BASE = 'http://localhost:4101/api/v1';
const ORGANIZATION_ID = '10000000-0000-4000-8000-00000000000a';
const WAREHOUSE_ID = '50000000-0000-4000-8000-00000000000a';
const LOCATION_ID = '60000000-0000-4000-8000-00000000000a';
const CABLE_ID = '20000000-0000-4000-8000-0000000000a2';
const IPHONE_ID = '20000000-0000-4000-8000-0000000000a1';
const CABLE_CODE = 'ms-a-0002';
const IPHONE_BARCODE = '2000000000015';
const CABLE_NAME = 'USB-C cable 2m';
const PASSWORD = 'local-e2e-password';

/** 8 900 millimes: the catalogue sale price of the cable, in the unit the invoice stores. */
const CABLE_UNIT_MINOR = 8900;

const RUN = Date.now().toString(36).toUpperCase();
const IMEI_SEED = String(Date.now()).slice(-13);

let token = '';

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

async function signIn(page: Page, email = 'alice@example.com'): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function postReceipt(request: APIRequestContext, quantity: number): Promise<void> {
  const response = await request.post(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/stock-movements`,
    {
      headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
      data: {
        productId: CABLE_ID,
        warehouseId: WAREHOUSE_ID,
        locationId: LOCATION_ID,
        type: 'receipt',
        quantity,
        reason: 'Local E2E counter-sale fixture receipt',
      },
    },
  );

  expect(response.ok(), await response.text()).toBeTruthy();
}

async function onHand(request: APIRequestContext): Promise<number> {
  const response = await request.get(`${API_BASE}/organizations/${ORGANIZATION_ID}/stock-levels`, {
    headers: authHeaders(),
    params: { productId: CABLE_ID, page: 1, pageSize: 20 },
  });

  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { items: { onHand: number }[] };
  return body.items.reduce((sum, item) => sum + item.onHand, 0);
}

interface InvoiceJson {
  id: string;
  number: string;
  salesOrderNumber: string | null;
  netAmountMinor: number;
  taxAmountMinor: number;
  totalAmountMinor: number;
  paidAmountMinor: number;
  remainingAmountMinor: number;
  paymentStatus: string;
  lineCount: number;
  totalQuantity: number;
  lines: { kind: string; serialNumber: string | null; taxRatePercent: number }[];
}

async function invoiceByReference(
  request: APIRequestContext,
  reference: string,
): Promise<InvoiceJson> {
  const list = await request.get(`${API_BASE}/organizations/${ORGANIZATION_ID}/sales-invoices`, {
    headers: authHeaders(),
    params: { search: reference, page: 1, pageSize: 10 },
  });
  expect(list.ok(), await list.text()).toBeTruthy();
  const body = (await list.json()) as { items: { id: string }[] };
  expect(body.items).toHaveLength(1);

  const detail = await request.get(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/sales-invoices/${body.items[0]!.id}`,
    { headers: authHeaders() },
  );
  expect(detail.ok(), await detail.text()).toBeTruthy();
  return (await detail.json()) as InvoiceJson;
}

/** Posts a counter sale straight through the RPC contract, for the cases the screen covers elsewhere. */
async function createSale(
  request: APIRequestContext,
  input: Record<string, unknown>,
): Promise<{ number: string; orderId: string | null }> {
  const response = await request.post(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/sales-invoices`,
    {
      headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
      data: input,
    },
  );

  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { number: string; orderId: string | null };
}

async function registerDevice(
  request: APIRequestContext,
  serial: string,
  imeiSuffix: string,
): Promise<void> {
  const response = await request.post(`${API_BASE}/organizations/${ORGANIZATION_ID}/devices`, {
    headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
    data: {
      productId: IPHONE_ID,
      serialNumber: serial,
      imei: `${IMEI_SEED}${imeiSuffix}`,
      warehouseId: WAREHOUSE_ID,
      locationId: LOCATION_ID,
    },
  });

  expect(response.ok(), await response.text()).toBeTruthy();
}

async function deviceStatus(request: APIRequestContext, serial: string): Promise<string | null> {
  const response = await request.get(`${API_BASE}/organizations/${ORGANIZATION_ID}/devices`, {
    headers: authHeaders(),
    params: { search: serial, page: 1, pageSize: 5 },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { items: { status: string }[] };
  return body.items[0]?.status ?? null;
}

/**
 * Units the picker will offer: in stock for this product at the depot the invoice
 * issues from. Counted from the API rather than hardcoded, because the local stack
 * reuses one database and earlier specs leave sold and in-stock units behind.
 */
async function inStockAtDepot(request: APIRequestContext): Promise<number> {
  const response = await request.get(`${API_BASE}/organizations/${ORGANIZATION_ID}/devices`, {
    headers: authHeaders(),
    params: {
      productId: IPHONE_ID,
      warehouseId: WAREHOUSE_ID,
      status: 'in_stock',
      page: 1,
      pageSize: 100,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { items: { locationId: string }[] };
  return body.items.filter((device) => device.locationId === LOCATION_ID).length;
}

async function expectPdfDownload(
  page: Page,
  trigger: () => Promise<void>,
  filenamePattern: RegExp,
  locale: 'en' | 'fr' | 'ar' = 'en',
): Promise<void> {
  const downloadPromise = page.waitForEvent('download');
  const printPromise = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith('/pdf'),
  );
  await trigger();
  const [download, printRequest] = await Promise.all([downloadPromise, printPromise]);

  expect(new URL(printRequest.url()).searchParams.get('locale')).toBe(locale);
  expect(download.suggestedFilename()).toMatch(filenamePattern);

  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  expect(bytes.length).toBeGreaterThan(1200);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
}

async function chooseDepot(page: Page): Promise<void> {
  await page.locator('#sale-warehouse').selectOption(WAREHOUSE_ID);
  await page.locator('#sale-location').selectOption(LOCATION_ID);
}

function scanSection(page: Page): Locator {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Scan the label' }) });
}

/**
 * Types the code and presses Add, the same way the counter's manual fallback
 * works. What the code resolves to — a basket line or the unit picker — is the
 * caller's assertion, because a serialized code never reaches the basket.
 */
async function scan(page: Page, code: string): Promise<void> {
  const section = scanSection(page);
  await section.locator('#sale-scan-code').fill(code);
  await section.getByRole('button', { name: 'Add', exact: true }).click();
}

/**
 * The hardware-scanner path: 8 ms between keystrokes is inside the wedge's 60 ms
 * burst window, and Enter is the scanner's terminator. Nothing is clicked, so this
 * is the only test that proves a USB scan cannot also submit the payment form.
 */
async function scanWithWedge(page: Page, code: string): Promise<void> {
  await scanSection(page).locator('#sale-scan-code').click();
  await page.keyboard.type(code, { delay: 8 });
  await page.keyboard.press('Enter');
}

function confirmDialog(page: Page): Locator {
  return page.getByRole('dialog');
}

/**
 * A product read is held until the operator accepts it, so every scan of a plain
 * product ends here. The quantity is the one the popup will add to the basket.
 */
async function confirmScan(page: Page, quantity?: string): Promise<void> {
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  const field = dialog.getByLabel('Quantity to add');
  if (quantity !== undefined) await field.fill(quantity);
  await dialog.getByRole('button', { name: 'Add to basket' }).click();
  await expect(dialog).toBeHidden();
}

function summaryBar(page: Page): Locator {
  return page.locator('#sale-mobile-summary');
}

/**
 * A beep cannot be heard by a test runner, but the tone it plays is an oscillator
 * on the Web Audio graph, so the counter below proves a read was announced and
 * that one held-up label is announced once rather than on every frame.
 */
async function armBeepCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const counted = window as unknown as { __beeps: number };
    counted.__beeps = 0;
    const audio = window.AudioContext;
    if (!audio) return;
    const createOscillator = audio.prototype.createOscillator;
    audio.prototype.createOscillator = function (this: AudioContext) {
      counted.__beeps += 1;
      return createOscillator.call(this);
    };
  });
}

async function beepCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __beeps: number }).__beeps);
}

test.beforeAll(async () => {
  token = await ownerToken();
});

test.describe('counter sale', () => {
  test('scans into a basket, posts the sale and downloads both documents', async ({
    page,
    request,
  }) => {
    await postReceipt(request, 8);
    const before = await onHand(request);
    const reference = `E2E-CS-${RUN}`;
    const buyer = `E2E Buyer ${RUN}`;

    await armBeepCounter(page);
    await signIn(page);
    await page.goto('/sale');
    await expect(page.getByRole('heading', { level: 1, name: 'Counter sale' })).toBeVisible();
    await expect(page.getByText('Nothing scanned yet')).toBeVisible();

    await chooseDepot(page);
    await page.locator('#sale-default-tax').fill('19');

    // The same code read twice is one line with two units, not two lines: once as
    // a hardware-scanner burst, once typed by hand. Each read waits for the operator.
    await scanWithWedge(page, CABLE_CODE);
    const popup = confirmDialog(page);
    await expect(popup.getByRole('heading', { name: `Add ${CABLE_NAME}?` })).toBeVisible();
    await expect(popup).toContainText(CABLE_CODE);
    await expect(popup.getByLabel('Quantity to add')).toHaveValue('1');
    await expect(popup.getByLabel('Quantity to add')).toBeFocused();
    await expect(popup).not.toContainText('Already in basket');
    await confirmScan(page);
    expect(await beepCount(page)).toBe(1);
    await expect(scanSection(page).getByRole('status')).toContainText('added to the basket');
    await expect(page.getByLabel('Barcode, serial number or SKU')).toHaveValue('');
    await expect(page.getByLabel('Barcode, serial number or SKU')).toBeFocused();

    await scan(page, CABLE_CODE);
    expect(await beepCount(page)).toBe(2);
    await expect(popup).toContainText('Already in basket');
    await confirmScan(page);
    await expect(page.getByLabel(`Quantity for ${CABLE_NAME}`)).toHaveValue('2');
    await expect(page.getByLabel(`Tax rate for ${CABLE_NAME}`)).toHaveValue('19');

    // The client edits the price; the server decides what the invoice carries.
    await page.getByLabel(`Unit price for ${CABLE_NAME}`).fill('9.000');
    await page.locator('#sale-customer-name').fill(buyer);
    await page.locator('#sale-payment-amount').fill('11.182');
    await page.locator('#sale-reference').fill(reference);

    await page.getByRole('button', { name: 'Post sale' }).click();
    const posted = page.getByRole('heading', { name: /Invoice FI-\d{4}-\d{4} issued/ });
    await expect(posted).toBeVisible();
    await expect(page.getByText(/1 line \/ 2 units left the depot/)).toBeVisible();
    await expect(page.getByText('Partially paid', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Stock left through the ledger')).toBeVisible();

    await expectPdfDownload(
      page,
      () => page.getByRole('button', { name: 'Invoice PDF' }).click(),
      /^nexora-FI-\d{4}-\d{4}\.pdf$/,
    );
    await expectPdfDownload(
      page,
      () => page.getByRole('button', { name: 'Bon de sortie PDF' }).click(),
      /^nexora-SO-\d{4}-\d{4}-issue-note\.pdf$/,
    );

    // The amounts are the database's: 2 × 9.000 = 18.000 net, 19% = 3.420, total 21.420.
    const invoice = await invoiceByReference(request, reference);
    expect(invoice.netAmountMinor).toBe(18_000);
    expect(invoice.taxAmountMinor).toBe(3_420);
    expect(invoice.totalAmountMinor).toBe(21_420);
    expect(invoice.paidAmountMinor).toBe(11_182);
    expect(invoice.remainingAmountMinor).toBe(10_238);
    expect(invoice.paymentStatus).toBe('partial');
    expect(invoice.lineCount).toBe(1);
    expect(invoice.totalQuantity).toBe(2);
    expect(invoice.salesOrderNumber).toMatch(/^SO-\d{4}-\d{4}$/);
    expect(invoice.lines[0]?.kind).toBe('product');

    expect(await onHand(request)).toBe(before - 2);

    // The counter's memory lists the invoice it just posted.
    await page.getByRole('button', { name: 'Next sale' }).click();
    await page.locator('#sale-recent-search').fill(reference);
    const row = page.getByRole('row', { name: new RegExp(escapeRegExp(invoice.number)) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(buyer);
    await expect(row.getByText('Partially paid')).toBeVisible();
  });

  test('holds a product read until the operator confirms it', async ({ page }) => {
    const viewport = page.viewportSize();
    const phone = Boolean(viewport && viewport.width < 1024);

    await armBeepCounter(page);
    await signIn(page);
    await page.goto('/sale');
    await chooseDepot(page);

    // A read is an offer, not an order: refusing it leaves the basket as it was.
    await scanWithWedge(page, CABLE_CODE);
    const popup = confirmDialog(page);
    await expect(popup.getByRole('heading', { name: `Add ${CABLE_NAME}?` })).toBeVisible();
    await popup.getByRole('button', { name: 'Cancel' }).click();
    await expect(popup).toBeHidden();
    await expect(page.getByText('Nothing scanned yet')).toBeVisible();
    expect(await beepCount(page)).toBe(1);

    // The popup is also where a bulk add happens: three cartons read as one code.
    await scan(page, CABLE_CODE);
    await confirmScan(page, '3');
    await expect(page.getByLabel(`Quantity for ${CABLE_NAME}`)).toHaveValue('3');

    // On a phone the basket the operator built stays on screen, not below the fold.
    if (phone) {
      const summary = summaryBar(page);
      await expect(summary).toBeInViewport();
      await expect(summary).toContainText('1 line / 3 units');
      await expect(summary.getByRole('button', { name: 'Post sale' })).toBeVisible();
    }
  });

  test('sells a serialized unit chosen from the picker without a ledger movement', async ({
    page,
    request,
  }) => {
    const serialScanned = `SN-E2E-CS-${RUN}`;
    const serialPicked = `SN-E2E-SD-${RUN}`;
    const reference = `E2E-SD-${RUN}`;
    const stockedBefore = await inStockAtDepot(request);
    await registerDevice(request, serialScanned, '07');
    await registerDevice(request, serialPicked, '08');
    const before = await onHand(request);

    await signIn(page);
    await page.goto('/sale');
    await chooseDepot(page);

    await scan(page, serialScanned);
    await expect(page.getByText(`${serialScanned} added to the basket.`)).toBeVisible();

    // A serialized product code names the model, so the counter asks which unit leaves.
    await scan(page, IPHONE_BARCODE);
    const picker = page.getByRole('dialog');
    await expect(
      picker.getByRole('heading', { name: 'Choose the unit — iPhone 15 128GB' }),
    ).toBeVisible();
    await expect(picker).toContainText(`${stockedBefore + 2} units in stock at MAIN / A-01.`);

    await picker.locator('#sale-device-search').fill(serialPicked);
    await expect(picker).toContainText('1 unit in stock at MAIN / A-01.');
    await expect(picker.getByRole('button', { name: 'Take this unit' })).toHaveCount(1);
    await picker.getByRole('button', { name: 'Take this unit' }).click();
    await expect(picker).toBeHidden();

    await page.locator('#sale-customer-name').fill(`E2E Serial Buyer ${RUN}`);
    await page.locator('#sale-reference').fill(reference);
    await page.getByRole('button', { name: 'Post sale' }).click();

    await expect(
      page.getByRole('heading', { name: /Invoice FI-\d{4}-\d{4} issued/ }),
    ).toBeVisible();
    await expect(page.getByText('Serialized units only')).toBeVisible();

    const invoice = await invoiceByReference(request, reference);
    expect(invoice.salesOrderNumber).toBeNull();
    expect(invoice.lineCount).toBe(2);
    expect(invoice.totalQuantity).toBe(2);
    expect(invoice.paymentStatus).toBe('unpaid');
    expect(invoice.lines.filter((line) => line.kind === 'device')).toHaveLength(2);

    // Devices leave through the lifecycle, not the ledger: the cable quantity is untouched.
    expect(await onHand(request)).toBe(before);
    expect(await deviceStatus(request, serialScanned)).toBe('sold');
    expect(await deviceStatus(request, serialPicked)).toBe('sold');

    await expectPdfDownload(
      page,
      () => page.getByRole('button', { name: 'Bon de sortie PDF' }).click(),
      /^nexora-FI-\d{4}-\d{4}-issue-note\.pdf$/,
    );
  });

  test('settles the balance from the invoice detail', async ({ page, request }) => {
    const reference = `E2E-PAY-${RUN}`;
    await postReceipt(request, 4);
    const sale = await createSale(request, {
      warehouseId: WAREHOUSE_ID,
      locationId: LOCATION_ID,
      customerName: `E2E Debtor ${RUN}`,
      lines: [
        { kind: 'product', productId: CABLE_ID, quantity: 1, unitPriceMinor: CABLE_UNIT_MINOR },
      ],
      paidAmountMinor: 0,
      paymentMethod: 'credit',
      reference,
    });

    await signIn(page);
    await page.goto('/sale');
    await page.locator('#sale-recent-search').fill(reference);

    const row = page.getByRole('row', { name: new RegExp(escapeRegExp(sale.number)) });
    await expect(row).toBeVisible();
    await expect(row.getByText('Unpaid')).toBeVisible();
    await row.getByRole('button', { name: 'Open' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { level: 3, name: 'Record a payment' })).toBeVisible();
    await expect(dialog.getByText('is still due on this invoice')).toBeVisible();

    await dialog.locator('#invoice-payment-amount').fill('5.000');
    await dialog.locator('#invoice-payment-note').fill('First instalment');
    await dialog.getByRole('button', { name: 'Record payment' }).click();
    await expect(dialog.getByRole('status')).toContainText('Payment recorded on');

    const afterFirst = await invoiceByReference(request, reference);
    expect(afterFirst.paidAmountMinor).toBe(5_000);
    expect(afterFirst.remainingAmountMinor).toBe(3_900);
    expect(afterFirst.paymentStatus).toBe('partial');

    await dialog.locator('#invoice-payment-amount').fill('3.900');
    await expect(dialog.getByText('This settles the invoice exactly.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Record payment' }).click();
    await expect(dialog.getByRole('status')).toContainText('is paid in full.');

    const settled = await invoiceByReference(request, reference);
    expect(settled.paymentStatus).toBe('paid');
    expect(settled.remainingAmountMinor).toBe(0);
    expect(settled.lines[0]?.kind).toBe('product');
  });

  test('viewer reads the counter without posting', async ({ page }) => {
    await signIn(page, 'dave@example.com');
    await page.goto('/sale');

    await expect(
      page.getByText('Your viewer role is read-only', { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Post sale' })).toBeDisabled();
    await expect(page.locator('#sale-scan-code')).toBeDisabled();
  });
});
