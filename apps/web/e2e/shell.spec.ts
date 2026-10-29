import { expect, test } from '@playwright/test';

test.describe('application shell', () => {
  test('dashboard renders and reports the API as online', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'API online' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Distinct products')).toBeVisible();
  });

  test('shows no fabricated inventory numbers', async ({ page }) => {
    await page.goto('/');

    const metrics = page.locator('dl');
    await expect(metrics.getByText('—')).toHaveCount(4);
    await expect(page.getByText('No inventory data yet')).toBeVisible();
  });

  test('navigates to the products page', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
    }

    await page.getByRole('link', { name: 'Products' }).click();

    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
    await expect(page.getByText('No products yet')).toBeVisible();
  });

  test('offers a skip link as the first focusable element', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });

  test('renders the not-found page for unknown routes', async ({ page }) => {
    await page.goto('/definitely-not-a-route');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to dashboard' })).toBeVisible();
  });
});

test.describe('api contract', () => {
  test('health endpoint returns a stable envelope', async ({ request }) => {
    const response = await request.get('http://localhost:4100/health');

    expect(response.ok()).toBe(true);
    expect(response.headers()['x-request-id']).toBeTruthy();

    const body = (await response.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('mystock-api');
  });

  test('unknown api routes return the error envelope', async ({ request }) => {
    const response = await request.get('http://localhost:4100/api/v1/nope');

    expect(response.status()).toBe(404);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe('not_found');
    expect(body.error.requestId).toBe(response.headers()['x-request-id']);
  });
});
