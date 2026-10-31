import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'local-e2e-password';
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/;

async function startInLocale(page: Page, locale: 'en' | 'fr' | 'ar'): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('mystock.locale', value as string);
  }, locale);
}

async function documentLanguage(page: Page): Promise<{ lang: string; dir: string }> {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
}

async function attachScreenshot(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

function dashboardHeading(page: Page, name: string) {
  return page.locator('#main-content').getByRole('heading', { level: 1, name, exact: true });
}

test.describe('French locale', () => {
  test('pre-auth copy, sign-in, and money formatting follow the stored locale', async ({
    page,
  }) => {
    await startInLocale(page, 'fr');
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in$/);

    await expect(await documentLanguage(page)).toEqual({ lang: 'fr', dir: 'ltr' });
    await expect(page.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible();

    await page.getByLabel('E-mail', { exact: true }).fill('alice@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(dashboardHeading(page, 'Tableau de bord')).toBeVisible();
    await expect(page.getByLabel('Langue')).toHaveValue('fr');
    await expect(await documentLanguage(page)).toEqual({ lang: 'fr', dir: 'ltr' });

    const main = page.locator('#main-content');
    await expect(main).toContainText(/\d,\d{3}/);
    await expect(main).toContainText('oct.');
    await expect(main).not.toContainText(/\d{1,2}:\d{2} (AM|PM)/);

    await page.reload();
    await expect(dashboardHeading(page, 'Tableau de bord')).toBeVisible();
    await expect(await documentLanguage(page)).toEqual({ lang: 'fr', dir: 'ltr' });

    await attachScreenshot(page, 'french-dashboard');
  });

  test('authentication errors are shown in French', async ({ page }) => {
    await startInLocale(page, 'fr');
    await page.goto('/sign-in');

    await page.getByLabel('E-mail', { exact: true }).fill('unknown-user@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toContainText('Identifiants de connexion invalides');
    await expect(page.getByRole('alert')).not.toContainText('Invalid login credentials');
  });
});

test.describe('Arabic locale', () => {
  test('renders right-to-left with Arabic copy and Latin digits', async ({ page }) => {
    await startInLocale(page, 'ar');
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in$/);

    await expect(await documentLanguage(page)).toEqual({ lang: 'ar', dir: 'rtl' });
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();

    await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('alice@example.com');
    await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await expect(dashboardHeading(page, 'لوحة التحكم')).toBeVisible();
    await expect(page.getByLabel('اللغة')).toHaveValue('ar');
    await expect(await documentLanguage(page)).toEqual({ lang: 'ar', dir: 'rtl' });

    const main = page.locator('#main-content');
    const text = await main.innerText();
    expect(text).toMatch(/\d,\d{3}/);
    expect(text).not.toMatch(ARABIC_INDIC_DIGITS);

    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 1024) {
      const sidebar = await page.getByRole('navigation', { name: 'التنقل الرئيسي' }).boundingBox();
      expect(sidebar, 'sidebar is visible on desktop').not.toBeNull();
      expect(sidebar!.x).toBeGreaterThan(viewport.width / 2);
    }

    await page.reload();
    await expect(dashboardHeading(page, 'لوحة التحكم')).toBeVisible();
    await expect(await documentLanguage(page)).toEqual({ lang: 'ar', dir: 'rtl' });

    await attachScreenshot(page, 'arabic-dashboard');
  });
});

test.describe('language switcher', () => {
  test('switches copy and layout live and persists the choice', async ({ page }) => {
    await page.goto('/sign-in');

    await page.getByLabel('Language').selectOption('fr');
    await expect(page.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible();
    await page.getByLabel('Langue').selectOption('en');
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();

    await page.getByLabel('Email', { exact: true }).fill('alice@example.com');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(dashboardHeading(page, 'Dashboard')).toBeVisible();

    await page.getByLabel('Language').selectOption('fr');
    await expect(dashboardHeading(page, 'Tableau de bord')).toBeVisible();
    await expect(await documentLanguage(page)).toEqual({ lang: 'fr', dir: 'ltr' });

    await page.getByLabel('Langue').selectOption('ar');
    await expect(dashboardHeading(page, 'لوحة التحكم')).toBeVisible();
    await expect(await documentLanguage(page)).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(await page.evaluate(() => window.localStorage.getItem('mystock.locale'))).toBe('ar');

    await page.getByLabel('اللغة').selectOption('en');
    await expect(dashboardHeading(page, 'Dashboard')).toBeVisible();
    await expect(await documentLanguage(page)).toEqual({ lang: 'en', dir: 'ltr' });

    await page.getByLabel('Language').selectOption('ar');
    await page.reload();
    await expect(dashboardHeading(page, 'لوحة التحكم')).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('mystock.locale'))).toBe('ar');
  });
});
