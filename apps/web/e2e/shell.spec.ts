import { expect, test } from '@playwright/test';

test.describe('authentication gate', () => {
  test('redirects anonymous visitors to the sign-in page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Sign in', level: 2 })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('validates the form before contacting the auth service', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('switches to account creation', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'Create one' }).click();

    await expect(
      page.getByRole('heading', { name: 'Create your account', level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('offers a skip link as the first focusable element', async ({ page }) => {
    await page.goto('/sign-in');
    await page.keyboard.press('Tab');

    await expect(page.getByRole('link', { name: 'Skip to sign-in form' })).toBeFocused();
  });

  test('protects unknown routes behind the same gate', async ({ page }) => {
    await page.goto('/definitely-not-a-route');

    await expect(page).toHaveURL(/\/sign-in$/);
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

  test('rejects requests without a bearer token', async ({ request }) => {
    const response = await request.get('http://localhost:4100/api/v1/me');

    expect(response.status()).toBe(401);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe('unauthenticated');
    expect(body.error.requestId).toBe(response.headers()['x-request-id']);
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
