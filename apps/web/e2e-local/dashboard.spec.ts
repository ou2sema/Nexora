import { expect, test, type Page } from '@playwright/test';

const AUTH_ORIGIN = 'http://localhost:4200';
const API_BASE = 'http://localhost:4101/api/v1';
const ORGANIZATION_ID = '10000000-0000-4000-8000-00000000000a';
const ORGANIZATION_B_ID = '10000000-0000-4000-8000-00000000000b';
const CABLE_ID = '20000000-0000-4000-8000-0000000000a2';
const PASSWORD = 'local-e2e-password';

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

test('clears export feedback and filters when switching organization', async ({ page }) => {
  await signIn(page);

  const warehouseSelect = page.locator('#report-warehouse');
  await warehouseSelect.selectOption('50000000-0000-4000-8000-00000000000a');
  await expect(warehouseSelect).toHaveValue('50000000-0000-4000-8000-00000000000a');

  await page.getByRole('button', { name: 'Stock levels CSV' }).click();
  const notice = page
    .getByRole('status')
    .filter({ hasText: /^Downloaded nexora-stock-levels-\d{4}-\d{2}-\d{2}\.csv$/ });
  await expect(notice).toBeVisible();

  await page.getByRole('combobox', { name: 'Organization' }).selectOption({ label: 'Org B' });

  await expect(notice).toHaveCount(0);
  await expect(warehouseSelect).toHaveValue('');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true }),
  ).toBeVisible();
});

test('does not carry product data across organizations but keeps it across same-tenant filters', async ({
  page,
  request,
}) => {
  const token = await ownerToken();
  const marker = `Org B switch marker ${Date.now()}`;
  const created = await request.post(`${API_BASE}/organizations/${ORGANIZATION_B_ID}/products`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { sku: `SWITCH-${Date.now()}`, name: marker },
  });
  expect(created.ok(), await created.text()).toBeTruthy();

  await signIn(page);
  await page.goto('/products');
  const organizationSelect = page.getByRole('combobox', { name: 'Organization' });
  await organizationSelect.selectOption(ORGANIZATION_ID);
  await expect(page.getByRole('row', { name: /iPhone 15 128GB/ })).toBeVisible();

  const escapedApiBase = API_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let markOrganizationRequestReached: () => void = () => {};
  let releaseOrganizationResponse: () => void = () => {};
  const organizationRequestReached = new Promise<void>((resolve) => {
    markOrganizationRequestReached = resolve;
  });
  const organizationResponseGate = new Promise<void>((resolve) => {
    releaseOrganizationResponse = resolve;
  });
  await page.route(
    new RegExp(`${escapedApiBase}/organizations/${ORGANIZATION_B_ID}/products\\?`),
    async (route) => {
      markOrganizationRequestReached();
      await organizationResponseGate;
      await route.continue();
    },
  );

  await organizationSelect.selectOption(ORGANIZATION_B_ID);
  await organizationRequestReached;
  try {
    await expect(page.getByRole('row', { name: /iPhone 15 128GB/ })).toHaveCount(0);
  } finally {
    releaseOrganizationResponse();
  }
  await expect(page.getByRole('row', { name: new RegExp(marker) })).toBeVisible();
  await expect(page.getByRole('row', { name: /iPhone 15 128GB/ })).toHaveCount(0);

  await organizationSelect.selectOption(ORGANIZATION_ID);
  await expect(page.getByRole('row', { name: /iPhone 15 128GB/ })).toBeVisible();
  let markFilterRequestReached: () => void = () => {};
  let releaseFilterResponse: () => void = () => {};
  const filterRequestReached = new Promise<void>((resolve) => {
    markFilterRequestReached = resolve;
  });
  const filterResponseGate = new Promise<void>((resolve) => {
    releaseFilterResponse = resolve;
  });
  await page.route(
    new RegExp(`${escapedApiBase}/organizations/${ORGANIZATION_ID}/products\\?.*status=archived`),
    async (route) => {
      markFilterRequestReached();
      await filterResponseGate;
      await route.continue();
    },
  );
  await page.locator('#product-status-filter').selectOption('archived');
  await filterRequestReached;
  try {
    await expect(page.getByRole('row', { name: /iPhone 15 128GB/ })).toBeVisible();
  } finally {
    releaseFilterResponse();
  }
  await expect(page.getByRole('row', { name: /iPhone 15 128GB/ })).toHaveCount(0);
  await expect(page.getByText('No matching products')).toBeVisible();
});

test('top-bar bell shows alerts and jumps to the low-stock section', async ({ page, request }) => {
  const token = await ownerToken();
  const patch = await request.patch(
    `${API_BASE}/organizations/${ORGANIZATION_ID}/products/${CABLE_ID}`,
    {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { reorderThreshold: 999 },
    },
  );
  expect(patch.ok(), await patch.text()).toBeTruthy();

  await signIn(page);

  const bell = page.getByRole('link', { name: /Low stock alerts/ });
  await expect(bell).toHaveAttribute('aria-label', 'Low stock alerts: 1 product');

  await page.evaluate(() => window.scrollTo(0, 0));
  await bell.click();
  await expect(page).toHaveURL(/#low-stock$/);
  await expect(page.locator('#low-stock')).toBeInViewport();

  await page.goto('/team');
  await bell.click();
  await expect(page).toHaveURL(/\/#low-stock$/);
  await expect(page.locator('#low-stock')).toBeInViewport();
});
