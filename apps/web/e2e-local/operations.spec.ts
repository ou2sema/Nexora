import { readFile } from 'node:fs/promises';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const AUTH_ORIGIN = 'http://localhost:4200';
const API_BASE = 'http://localhost:4101/api/v1';
const ORGANIZATION_ID = '10000000-0000-4000-8000-00000000000a';
const WAREHOUSE_ID = '50000000-0000-4000-8000-00000000000a';
const LOCATION_ID = '60000000-0000-4000-8000-00000000000a';
const CABLE_ID = '20000000-0000-4000-8000-0000000000a2';
const IPHONE_ID = '20000000-0000-4000-8000-0000000000a1';
const PASSWORD = 'local-e2e-password';

const RUN = Date.now().toString(36).toUpperCase();
const IMEI_SEED = String(Date.now()).slice(-13);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

async function signIn(page: Page, email = 'alice@example.com'): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function createSupplier(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.post(`${API_BASE}/organizations/${ORGANIZATION_ID}/suppliers`, {
    headers: authHeaders(),
    data: { name, contactName: 'E2E contact', email: 'e2e@example.com', countryCode: 'TN' },
  });

  expect(response.ok(), await response.text()).toBeTruthy();
  const supplier = (await response.json()) as { id: string };
  return supplier.id;
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
        reason: 'Local E2E fixture receipt',
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

async function createPurchaseOrder(
  page: Page,
  supplierId: string,
  productId: string,
  quantity: number,
  unitCost: string,
): Promise<void> {
  await page.getByRole('button', { name: 'New purchase order' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await expect(dialog.locator('#po-supplier option')).not.toHaveCount(1);
  await dialog.locator('#po-supplier').selectOption(supplierId);
  await dialog.locator('#po-warehouse').selectOption(WAREHOUSE_ID);
  await dialog.locator('#po-location').selectOption(LOCATION_ID);
  await dialog.locator('#po-line-product-0').selectOption(productId);
  await dialog.locator('#po-line-quantity-0').fill(String(quantity));
  await dialog.locator('#po-line-cost-0').fill(unitCost);
  await dialog.getByRole('button', { name: 'Create purchase order' }).click();

  await expect(dialog).toBeHidden();
}

async function openLatestRow(page: Page, text: string): Promise<void> {
  const row = page.getByRole('row', { name: new RegExp(escapeRegExp(text)) }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * A download proves two things the file name cannot: the request asked for the locale the
 * reader is looking at, and the bytes that came back are a PDF.
 */
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function receivePurchaseOrder(
  request: APIRequestContext,
  supplierId: string,
  productId: string,
  quantity: number,
): Promise<string> {
  const created = await request.post(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/purchase-orders`,
    {
      headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
      data: {
        supplierId,
        warehouseId: WAREHOUSE_ID,
        locationId: LOCATION_ID,
        expectedOn: todayIso(),
        lines: [{ productId, quantity, unitCostMinor: 4500 }],
      },
    },
  );
  expect(created.ok(), await created.text()).toBeTruthy();
  const order = (await created.json()) as { orderId: string };

  const ordered = await request.post(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/purchase-orders/${order.orderId}/order`,
    { headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() } },
  );
  expect(ordered.ok(), await ordered.text()).toBeTruthy();

  const detail = await request.get(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/purchase-orders/${order.orderId}`,
    { headers: authHeaders() },
  );
  expect(detail.ok(), await detail.text()).toBeTruthy();
  const lines = (await detail.json()) as { lines: { id: string }[] };
  expect(lines.lines).toHaveLength(1);

  const received = await request.post(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/purchase-orders/${order.orderId}/receipts`,
    {
      headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
      data: { lines: [{ lineId: lines.lines[0]!.id, quantity }] },
    },
  );
  expect(received.ok(), await received.text()).toBeTruthy();
  return order.orderId;
}

async function createPostedReturn(
  request: APIRequestContext,
  orderId: string,
  quantity: number,
): Promise<void> {
  const detail = await request.get(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/purchase-orders/${orderId}`,
    { headers: authHeaders() },
  );
  expect(detail.ok(), await detail.text()).toBeTruthy();
  const lines = (await detail.json()) as { lines: { id: string; productSku: string }[] };
  const line = lines.lines.find((candidate) => candidate.productSku === 'CABLE-USB-C');
  expect(line).toBeTruthy();

  const created = await request.post(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/purchase-orders/${orderId}/returns`,
    {
      headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
      data: {
        reason: 'Purchase document download check',
        reference: 'E2E-DOC',
        lines: [{ purchaseOrderLineId: line!.id, quantity }],
      },
    },
  );
  expect(created.ok(), await created.text()).toBeTruthy();
  const purchaseReturn = (await created.json()) as { returnId: string };

  const posted = await request.post(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/purchase-orders/${orderId}/returns/${purchaseReturn.returnId}/post`,
    { headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() } },
  );
  expect(posted.ok(), await posted.text()).toBeTruthy();
}

async function fulfilSalesOrder(
  request: APIRequestContext,
  customerName: string,
  quantity: number,
): Promise<string> {
  const created = await request.post(`${API_BASE}/organizations/${ORGANIZATION_ID}/sales-orders`, {
    headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() },
    data: {
      customerName,
      warehouseId: WAREHOUSE_ID,
      locationId: LOCATION_ID,
      lines: [{ productId: CABLE_ID, quantity, unitPriceMinor: 8900 }],
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const order = (await created.json()) as { orderId: string };

  for (const action of ['confirm', 'fulfil']) {
    const response = await request.post(
      `${API_BASE}/organizations/${ORGANIZATION_ID}/sales-orders/${order.orderId}/${action}`,
      { headers: { ...authHeaders(), 'idempotency-key': crypto.randomUUID() } },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
  }

  return order.orderId;
}

test.beforeAll(async () => {
  token = await ownerToken();
});

test.describe('suppliers', () => {
  test('owner creates, deactivates and reactivates a supplier', async ({ page }) => {
    const name = `E2E Supplier ${RUN}`;

    await signIn(page);
    await page.goto('/suppliers');
    await expect(page.getByRole('heading', { name: 'Suppliers', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'New supplier' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('#supplier-name').fill(name);
    await dialog.locator('#supplier-email').fill('orders@e2e-supplier.example');
    await dialog.locator('#supplier-city').fill('Tunis');
    await dialog.locator('#supplier-country').fill('tn');
    await dialog.getByRole('button', { name: 'Create supplier' }).click();
    await expect(dialog).toBeHidden();

    await page.locator('#supplier-search').fill(name);
    const row = page.getByRole('row', { name: new RegExp(escapeRegExp(name)) });
    await expect(row).toBeVisible();
    await expect(row.getByText('Tunis, TN')).toBeVisible();

    await row.getByRole('button', { name: 'Deactivate' }).click();
    await expect(row.getByText('Inactive')).toBeVisible();
    await row.getByRole('button', { name: 'Reactivate' }).click();
    await expect(row.getByText('Active')).toBeVisible();
  });
});

test.describe('purchase orders', () => {
  test('receives an ordered purchase order and increases stock', async ({ page, request }) => {
    const supplierName = `E2E PO Supplier ${RUN}`;
    const supplierId = await createSupplier(request, supplierName);
    const before = await onHand(request);

    await signIn(page);
    await page.goto('/purchasing');
    await expect(page.getByRole('heading', { name: 'Purchase orders', exact: true })).toBeVisible();

    await createPurchaseOrder(page, supplierId, CABLE_ID, 4, '4.500');
    await openLatestRow(page, supplierName);

    await page.getByRole('button', { name: 'Mark as ordered' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('status')).toContainText(/is now ordered/);
    await expect(dialog.getByText('Ordered · MAIN / A-01')).toBeVisible();

    await dialog.getByLabel('Quantity to receive for CABLE-USB-C').fill('4');
    await dialog.getByRole('button', { name: 'Post receipt' }).click();
    await expect(dialog.getByRole('status')).toContainText('Received 4 units');
    await expect(dialog.getByText('Received · MAIN / A-01')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    expect(await onHand(request)).toBe(before + 4);
  });

  test('receiving serialized lines registers traceable devices', async ({ page, request }) => {
    const supplierName = `E2E Serial Supplier ${RUN}`;
    const supplierId = await createSupplier(request, supplierName);
    const serialA = `SN-E2E-${RUN}-A`;
    const serialB = `SN-E2E-${RUN}-B`;

    await signIn(page);
    await page.goto('/purchasing');
    await createPurchaseOrder(page, supplierId, IPHONE_ID, 2, '3150.000');
    await openLatestRow(page, supplierName);

    await page.getByRole('button', { name: 'Mark as ordered' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('status')).toContainText(/is now ordered/);

    await dialog
      .getByLabel('Serial numbers for IPHONE-15')
      .fill(`${serialA}|${IMEI_SEED}01\n${serialB}|${IMEI_SEED}02`);
    await dialog.getByRole('button', { name: 'Post receipt' }).click();
    await expect(dialog.getByRole('status')).toContainText('Received 2 units');
    await expect(dialog.getByText('Received · MAIN / A-01')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.goto('/devices');
    await expect(page.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
    await page.locator('#device-search').fill(`SN-E2E-${RUN}`);

    const first = page.getByRole('row', { name: new RegExp(escapeRegExp(serialA)) });
    const second = page.getByRole('row', { name: new RegExp(escapeRegExp(serialB)) });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect(first.getByText('In stock')).toBeVisible();
    await expect(first).toContainText('iPhone 15 128GB');
  });

  test('returns received goods to the supplier and reduces stock', async ({ page, request }) => {
    const supplierName = `E2E Return Supplier ${RUN}`;
    const supplierId = await createSupplier(request, supplierName);
    const before = await onHand(request);
    await receivePurchaseOrder(request, supplierId, CABLE_ID, 3);

    await signIn(page);
    await page.goto('/purchasing');
    await page.locator('#po-search').fill(supplierName);
    await openLatestRow(page, supplierName);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Returns to supplier' })).toBeVisible();
    await dialog.getByRole('button', { name: 'New purchase return' }).click();

    const returnDialog = page.getByRole('dialog', { name: 'Return goods to supplier' });
    await expect(returnDialog).toBeVisible();
    await returnDialog.getByLabel('Reason', { exact: true }).fill('Damaged cable batch');
    await returnDialog.getByLabel('Return quantity for CABLE-USB-C').fill('1');
    await returnDialog.getByRole('button', { name: 'Create return' }).click();
    await expect(returnDialog).toBeHidden();

    await expect(dialog.getByText(/created as a draft/)).toBeVisible();
    const row = dialog.getByRole('row', { name: /PR-/ });
    await expect(row).toContainText('Draft');
    await row.getByRole('button', { name: 'Post return' }).click();
    await expect(dialog.getByText(/Return PR-.* posted/)).toBeVisible();
    await expect(row).toContainText('Posted');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    expect(await onHand(request)).toBe(before + 2);
  });

  test('downloads the purchase order and its return note as PDFs', async ({ page, request }) => {
    const supplierName = `E2E Docs Supplier ${RUN}`;
    const supplierId = await createSupplier(request, supplierName);
    const orderId = await receivePurchaseOrder(request, supplierId, CABLE_ID, 2);
    await createPostedReturn(request, orderId, 1);

    await signIn(page);
    await page.goto('/purchasing');
    await page.locator('#po-search').fill(supplierName);
    await openLatestRow(page, supplierName);

    const dialog = page.getByRole('dialog');
    await expectPdfDownload(
      page,
      () => dialog.getByRole('button', { name: 'Download purchase order PDF' }).click(),
      /^nexora-PO-\d{4}-\d{4}\.pdf$/,
    );

    const returnRow = dialog.getByRole('row', { name: /PR-/ });
    await expect(returnRow).toContainText('Posted');

    // The manager changes the app's language; the next document is printed in it.
    await page.getByLabel('Language').selectOption('fr');
    await expectPdfDownload(
      page,
      () => returnRow.getByRole('button', { name: 'Télécharger le PDF' }).click(),
      /^nexora-PR-\d{4}-\d{4}\.pdf$/,
      'fr',
    );

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('outgoing orders', () => {
  test('confirms, reserves and fulfils an outgoing order', async ({ page, request }) => {
    await postReceipt(request, 10);
    const before = await onHand(request);
    const customer = `E2E Customer ${RUN}`;

    await signIn(page);
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: 'Outgoing orders', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'New outgoing order' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.locator('#so-customer').fill(customer);
    await createDialog.locator('#so-email').fill('buyer@e2e.example');
    await createDialog.locator('#so-warehouse').selectOption(WAREHOUSE_ID);
    await createDialog.locator('#so-location').selectOption(LOCATION_ID);
    await createDialog.locator('#so-line-product-0').selectOption(CABLE_ID);
    await createDialog.locator('#so-line-quantity-0').fill('2');
    await createDialog.locator('#so-line-price-0').fill('8.900');
    await createDialog.getByRole('button', { name: 'Create outgoing order' }).click();
    await expect(createDialog).toBeHidden();

    await openLatestRow(page, customer);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Draft · MAIN / A-01')).toBeVisible();

    await dialog.getByRole('button', { name: 'Confirm and reserve stock' }).click();
    await expect(dialog.getByRole('status')).toContainText('Reserved 2 units');
    await expect(dialog.getByText('Confirmed · MAIN / A-01')).toBeVisible();

    await dialog.getByRole('button', { name: 'Fulfil and issue stock' }).click();
    await expect(dialog.getByRole('status')).toContainText('Issued 2 units');
    await expect(dialog.getByText('Fulfilled · MAIN / A-01')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    expect(await onHand(request)).toBe(before - 2);
  });

  test('restocks a customer return after fulfilment', async ({ page, request }) => {
    await postReceipt(request, 6);
    const before = await onHand(request);
    const customer = `E2E Return Customer ${RUN}`;
    await fulfilSalesOrder(request, customer, 2);

    await signIn(page);
    await page.goto('/orders');
    await page.locator('#so-search').fill(customer);
    await openLatestRow(page, customer);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Returns from customer' })).toBeVisible();
    await dialog.getByRole('button', { name: 'New sales return' }).click();

    const returnDialog = page.getByRole('dialog', { name: 'Restock a customer return' });
    await expect(returnDialog).toBeVisible();
    await returnDialog
      .getByLabel('Reason', { exact: true })
      .fill('Customer returned an unused cable');
    await returnDialog.getByLabel('Return quantity for CABLE-USB-C').fill('1');
    await returnDialog.getByRole('button', { name: 'Create return' }).click();
    await expect(returnDialog).toBeHidden();

    await expect(dialog.getByText(/created as a draft/)).toBeVisible();
    const row = dialog.getByRole('row', { name: /SR-/ });
    await expect(row).toContainText('Draft');
    await row.getByRole('button', { name: 'Post return' }).click();
    await expect(dialog.getByText(/Return SR-.* posted/)).toBeVisible();
    await expect(row).toContainText('Posted');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    expect(await onHand(request)).toBe(before - 1);
  });
});

test.describe('supplier performance', () => {
  test('shows delivery metrics on the dashboard', async ({ page, request }) => {
    const supplierName = `E2E Perf Supplier ${RUN}`;
    const supplierId = await createSupplier(request, supplierName);
    await receivePurchaseOrder(request, supplierId, CABLE_ID, 2);

    await signIn(page);
    await page.goto('/');

    const section = page.getByRole('region', { name: 'Supplier performance' });
    await expect(section).toBeVisible();
    await section.locator('#supplier-window').selectOption('30');

    const row = section.getByRole('row', { name: new RegExp(escapeRegExp(supplierName)) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('1 received');
    await expect(row).toContainText('100%');
  });
});

test.describe('role gating', () => {
  test('viewer sees read-only operational pages', async ({ page }) => {
    await signIn(page, 'dave@example.com');

    await page.goto('/suppliers');
    await expect(page.getByText('Your viewer role is read-only', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New supplier' })).toBeDisabled();

    await page.goto('/purchasing');
    await expect(page.getByText('Your viewer role is read-only', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New purchase order' })).toBeDisabled();

    await page.goto('/orders');
    await expect(page.getByText('Your viewer role is read-only', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New outgoing order' })).toBeDisabled();
  });
});
