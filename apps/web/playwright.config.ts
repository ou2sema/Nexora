import { defineConfig, devices } from '@playwright/test';

const API_URL = 'http://localhost:4100';

// Local runs reuse the system Edge install; CI downloads Playwright's Chromium.
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? undefined : 'msedge');
const browserTarget = browserChannel ? { channel: browserChannel } : {};

const apiEnv = {
  NODE_ENV: 'test',
  API_PORT: '4100',
  WEB_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'warn',
  SUPABASE_URL: 'https://testsupabase.supabase.co',
  SUPABASE_ANON_KEY: 'a'.repeat(40),
  SUPABASE_JWT_ISSUER: 'https://testsupabase.supabase.co/auth/v1',
  SUPABASE_JWT_AUDIENCE: 'authenticated',
  DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/postgres',
  DATABASE_SSL: 'false',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['allure-playwright', { outputFolder: 'allure-results', detail: true, suiteTitle: false }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
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
      command: 'node dist/main.js',
      cwd: '../api',
      url: `${API_URL}/health`,
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev --workspace @mystock/web',
      cwd: '../..',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
