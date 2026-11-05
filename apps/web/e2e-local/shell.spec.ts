import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'local-e2e-password';

// A laptop with the browser chrome open leaves less room than the full menu needs,
// which is exactly the height where items used to fall off the bottom unreachable.
const SHORT_VIEWPORT = { width: 1366, height: 700 };

const LABELS = {
  en: {
    nav: 'Main navigation',
    openNav: 'Open navigation',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    dashboard: 'Dashboard',
    team: 'Team',
  },
  ar: {
    nav: 'التنقل الرئيسي',
    openNav: 'فتح التنقل',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    submit: 'تسجيل الدخول',
    dashboard: 'لوحة التحكم',
    team: 'الفريق',
  },
} as const;

const MENU_ITEMS = [
  'Dashboard',
  'Products',
  'Scanning',
  'Counter sale',
  'Stock levels',
  'Movements',
  'Reservations',
  'Devices',
  'Suppliers',
  'Purchase orders',
  'Outgoing orders',
  'Customers',
  'Reconciliation',
  'Warehouses',
  'Catalog settings',
  'Guide',
  'Team',
];

type ShellLocale = keyof typeof LABELS;

async function signIn(page: Page, locale: ShellLocale): Promise<void> {
  const labels = LABELS[locale];
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel(labels.email, { exact: true }).fill('alice@example.com');
  await page.getByLabel(labels.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: labels.submit, exact: true }).click();
  await expect(
    page
      .locator('#main-content')
      .getByRole('heading', { level: 1, name: labels.dashboard, exact: true }),
  ).toBeVisible();
}

function menu(page: Page, locale: ShellLocale) {
  return page.getByRole('navigation', { name: LABELS[locale].nav });
}

function menuItem(page: Page, locale: ShellLocale, label: string) {
  return menu(page, locale).getByRole('link', { name: label, exact: true });
}

// Desktop gets a short viewport so the menu has to scroll; mobile gets the drawer.
async function openMenu(page: Page, locale: ShellLocale): Promise<boolean> {
  const viewport = page.viewportSize();
  if (viewport && viewport.width >= 1024) {
    await page.setViewportSize(SHORT_VIEWPORT);
    return true;
  }
  await page.getByRole('button', { name: LABELS[locale].openNav }).click();
  return false;
}

async function teamHeading(page: Page, locale: ShellLocale): Promise<void> {
  await expect(
    page
      .locator('#main-content')
      .getByRole('heading', { level: 1, name: LABELS[locale].team, exact: true }),
  ).toBeVisible();
}

test.describe('app shell navigation', () => {
  test('lists every screen and keeps each one reachable on a short viewport', async ({ page }) => {
    await signIn(page, 'en');
    const desktop = await openMenu(page, 'en');

    await expect(menu(page, 'en').getByRole('link')).toHaveCount(MENU_ITEMS.length);
    expect((await menu(page, 'en').getByRole('link').allInnerTexts()).map((t) => t.trim())).toEqual(
      MENU_ITEMS,
    );

    if (desktop) {
      const metrics = await menuItem(page, 'en', 'Team').evaluate((link) => {
        const nav = link.closest('nav');
        return nav ? { scrollHeight: nav.scrollHeight, clientHeight: nav.clientHeight } : null;
      });
      expect(metrics, 'the menu owns its own scroll').not.toBeNull();
      expect(metrics!.scrollHeight).toBeGreaterThan(metrics!.clientHeight);
    }

    for (const label of MENU_ITEMS) {
      const link = menuItem(page, 'en', label);
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
    }
  });

  test('reveals the highlight for the screen being viewed', async ({ page }) => {
    const viewport = page.viewportSize();
    const desktop = Boolean(viewport && viewport.width >= 1024);
    if (desktop) await page.setViewportSize(SHORT_VIEWPORT);

    await signIn(page, 'en');
    await page.goto('/team');
    await teamHeading(page, 'en');
    if (!desktop) await page.getByRole('button', { name: LABELS.en.openNav }).click();

    await expect(menuItem(page, 'en', 'Team')).toBeInViewport();
  });

  test('reveals the highlight in the right-to-left menu', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mystock.locale', 'ar');
    });
    await signIn(page, 'ar');
    const desktop = await openMenu(page, 'ar');
    await page.goto('/team');
    await teamHeading(page, 'ar');
    if (!desktop) await page.getByRole('button', { name: LABELS.ar.openNav }).click();

    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    const team = menuItem(page, 'ar', LABELS.ar.team);
    await expect(team).toBeInViewport();

    if (desktop) {
      await test.info().attach('arabic-menu-short-viewport', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    }
  });
});
