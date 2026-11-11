import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'local-e2e-password';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page
      .locator('#main-content')
      .getByRole('heading', { level: 1, name: 'Dashboard', exact: true }),
  ).toBeVisible();
}

async function navigation(page: Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1024) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }

  return page.getByRole('navigation', { name: 'Main navigation' });
}

test.describe('role-aware workspace', () => {
  test('owner lands on setup and team, and keeps the full business navigation', async ({
    page,
  }) => {
    await signIn(page, 'alice@example.com');

    const main = page.locator('#main-content');
    await expect(main.getByRole('heading', { name: 'Setup', exact: true })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: /Warehouses/ })).toBeVisible();
    await expect(main.getByRole('link', { name: /Pending invitations/ })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Stock levels CSV' })).toBeVisible();

    const nav = await navigation(page);
    for (const label of [
      'Counter sale',
      'Reconciliation',
      'Warehouses',
      'Catalog settings',
      'Team',
    ]) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(1);
    }
  });

  test('manager lands on the counter with replenishment, counts and supplier tasks', async ({
    page,
  }) => {
    await signIn(page, 'gina@example.com');

    const main = page.locator('#main-content');
    const sale = main.getByRole('link', { name: 'Open counter sale', exact: true });
    await expect(sale).toBeVisible();
    await expect(sale).toHaveAttribute('href', '/sale');
    await expect(main.getByRole('link', { name: 'Scan a code', exact: true })).toHaveAttribute(
      'href',
      '/scan',
    );

    for (const heading of ['Low stock', 'Open counts', 'Supplier tasks']) {
      await expect(main.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await expect(main.getByRole('button', { name: 'Stock levels CSV' })).toHaveCount(0);

    const nav = await navigation(page);
    for (const label of ['Counter sale', 'Purchase orders', 'Suppliers', 'Scanning']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(1);
    }
    for (const label of ['Reconciliation', 'Warehouses', 'Catalog settings', 'Team']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }
  });

  test('viewer lands on a read-only counter and keeps only lookup navigation', async ({ page }) => {
    await signIn(page, 'dave@example.com');

    await expect(page.getByText('Your viewer role is read-only', { exact: false })).toBeVisible();
    await expect(page.locator('#counter-code')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Look up', exact: true })).toBeVisible();

    const nav = await navigation(page);
    for (const label of ['Scanning', 'Products', 'Stock levels', 'Movements']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(1);
    }
    for (const label of [
      'Counter sale',
      'Suppliers',
      'Purchase orders',
      'Outgoing orders',
      'Customers',
      'Devices',
      'Reservations',
      'Reconciliation',
      'Warehouses',
      'Catalog settings',
      'Team',
    ]) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }
  });
});
