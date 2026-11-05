import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'local-e2e-password';
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/;

const GUIDE_TITLES = {
  en: { nav: 'Guide', heading: 'User guide' },
  fr: { nav: 'Guide', heading: "Guide de l'utilisateur" },
  ar: { nav: 'الدليل', heading: 'دليل المستخدم' },
} as const;

const LABELS = {
  en: { email: 'Email', password: 'Password', submit: 'Sign in', dashboard: 'Dashboard' },
  fr: {
    email: 'E-mail',
    password: 'Mot de passe',
    submit: 'Se connecter',
    dashboard: 'Tableau de bord',
  },
  ar: {
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    submit: 'تسجيل الدخول',
    dashboard: 'لوحة التحكم',
  },
} as const;

type GuideLocale = keyof typeof LABELS;

// One heading plus a numbered how-to list per section; the last section has no watch-out card.
const STEP_COUNTS = [3, 4, 5, 4, 4, 4, 4, 4, 6];

async function startInLocale(page: Page, locale: GuideLocale): Promise<void> {
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

async function signIn(page: Page, locale: GuideLocale): Promise<void> {
  const labels = LABELS[locale];
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel(labels.email, { exact: true }).fill('alice@example.com');
  await page.getByLabel(labels.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: labels.submit, exact: true }).click();
  await expect(
    page.locator('#main-content').getByRole('heading', { level: 1, name: labels.dashboard }),
  ).toBeVisible();
}

async function openGuide(page: Page, locale: GuideLocale): Promise<void> {
  await signIn(page, locale);
  await page.goto('/guide');
  await expect(
    page
      .locator('#main-content')
      .getByRole('heading', { level: 1, name: GUIDE_TITLES[locale].heading, exact: true }),
  ).toBeVisible();
  await expect(page.locator('#main-content section[id]')).toHaveCount(STEP_COUNTS.length);
}

async function sectionStepCounts(page: Page): Promise<number[]> {
  const sections = page.locator('#main-content section[id]');
  const counts: number[] = [];
  for (let index = 0; index < (await sections.count()); index += 1) {
    counts.push(await sections.nth(index).locator('ol > li').count());
  }
  return counts;
}

async function sectionTitles(page: Page): Promise<string[]> {
  return page.locator('#main-content section[id] h2').allInnerTexts();
}

async function attachScreenshot(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

test.describe('French guide', () => {
  test('translates every section and keeps the screen links working', async ({ page }) => {
    await startInLocale(page, 'fr');
    await openGuide(page, 'fr');

    await expect(await documentLanguage(page)).toEqual({ lang: 'fr', dir: 'ltr' });
    expect(await sectionStepCounts(page)).toEqual(STEP_COUNTS);

    await expect(page.getByRole('heading', { level: 2, name: 'Vendre au comptoir' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Stock, mouvements et réservations' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Règles à retenir' })).toBeVisible();
    await expect(page.locator('#main-content')).not.toContainText('What to watch out for');

    const titles = await sectionTitles(page);
    expect(titles).toHaveLength(STEP_COUNTS.length);
    expect(new Set(titles).size).toBe(titles.length);

    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 1024) {
      await expect(
        page.getByRole('link', { name: GUIDE_TITLES.fr.nav, exact: true }),
      ).toBeVisible();
    }

    await page.getByRole('link', { name: /\/sale$/ }).click();
    await expect(page).toHaveURL(/\/sale$/);
    await expect(
      page.locator('#main-content').getByRole('heading', { level: 1, name: 'Vente au comptoir' }),
    ).toBeVisible();

    await page.goBack();
    await expect(
      page
        .locator('#main-content')
        .getByRole('heading', { level: 1, name: GUIDE_TITLES.fr.heading, exact: true }),
    ).toBeVisible();

    await attachScreenshot(page, 'french-guide');
  });
});

test.describe('Arabic guide', () => {
  test('renders right-to-left with Arabic copy and Latin digits', async ({ page }) => {
    await startInLocale(page, 'ar');
    await openGuide(page, 'ar');

    await expect(await documentLanguage(page)).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(await sectionStepCounts(page)).toEqual(STEP_COUNTS);

    await expect(page.getByRole('heading', { level: 2, name: 'البيع من الكاونتر' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'قواعد تستحق التذكّر' }),
    ).toBeVisible();

    const main = page.locator('#main-content');
    await expect(main).not.toContainText('User guide');
    await expect(main).not.toContainText('Vendre au comptoir');

    const text = await main.innerText();
    expect(text).not.toMatch(ARABIC_INDIC_DIGITS);
    expect(text).toContain('30');
    expect(text).toContain('FI-2026-0001');

    // Every screen link keeps its route as a left-to-right island, otherwise bidi
    // reorders the leading slash and the Arabic page shows "sale/ فتح".
    await expect(main.locator('bdi[dir="ltr"]')).toHaveText([
      '/sign-in',
      '/',
      '/sale',
      '/scan',
      '/stock',
      '/orders',
    ]);

    await attachScreenshot(page, 'arabic-guide');
  });
});

test.describe('guide locale parity', () => {
  test('switching language live keeps the same structure and swaps the copy', async ({ page }) => {
    await openGuide(page, 'en');

    const englishTitles = await sectionTitles(page);
    expect(await sectionStepCounts(page)).toEqual(STEP_COUNTS);
    await expect(
      page.getByRole('heading', { level: 3, name: 'What to watch out for' }),
    ).toHaveCount(STEP_COUNTS.length - 1);

    await page.getByLabel('Language').selectOption('fr');
    await expect(await documentLanguage(page)).toEqual({ lang: 'fr', dir: 'ltr' });
    expect(await sectionStepCounts(page)).toEqual(STEP_COUNTS);

    const frenchTitles = await sectionTitles(page);
    expect(frenchTitles).toHaveLength(englishTitles.length);
    expect(frenchTitles.some((title, index) => title !== englishTitles[index])).toBe(true);

    await page.getByLabel('Langue').selectOption('ar');
    await expect(await documentLanguage(page)).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(await sectionStepCounts(page)).toEqual(STEP_COUNTS);

    await page.reload();
    await expect(
      page
        .locator('#main-content')
        .getByRole('heading', { level: 1, name: GUIDE_TITLES.ar.heading, exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('mystock.locale'))).toBe('ar');
  });
});
