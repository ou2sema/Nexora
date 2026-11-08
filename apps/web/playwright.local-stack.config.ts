import { defineConfig, devices } from '@playwright/test';

// Self-contained stack: embedded PostgreSQL, a fake Supabase auth/JWKS server,
// the real API build and this app — no hosted project or credentials involved.
const WEB_ORIGIN = 'http://localhost:5174';
const API_ORIGIN = 'http://localhost:4101';

// Local runs reuse the system Edge install; CI downloads Playwright's Chromium.
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? undefined : 'msedge');
const browserTarget = browserChannel ? { channel: browserChannel } : {};

export default defineConfig({
  testDir: './e2e-local',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['allure-playwright', { outputFolder: 'allure-results', detail: true, suiteTitle: false }],
  ],
  use: {
    baseURL: WEB_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        ...browserTarget,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], ...browserTarget },
    },
  ],
  webServer: [
    {
      command: 'node scripts/local-e2e-stack.mjs',
      cwd: '../api',
      url: `${API_ORIGIN}/health/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: WEB_ORIGIN,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_SUPABASE_URL: 'http://localhost:4200',
        VITE_SUPABASE_ANON_KEY: 'a'.repeat(40),
        VITE_API_BASE_URL: `${API_ORIGIN}/api/v1`,
      },
    },
  ],
});
