import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for SlopIt frontend E2E tests.
 *
 * Test tiers:
 *  - Public (no auth): landing.spec, protected-routes.spec
 *  - API-mocked (no auth): post-page.spec, username-display.spec
 *  - Auth required: profile.spec, home.spec
 *    → run after: npm run e2e:auth-setup  (saves storageState)
 *
 * For local dev, set PLAYWRIGHT_BASE_URL to override the default.
 * For production smoke tests: PLAYWRIGHT_BASE_URL=https://peaceful-flower-536.fly.dev
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // GREEN SLOP palette — used in visual assertions
    colorScheme: 'dark',
  },
  projects: [
    // ── Chromium desktop (primary) ────────────────────────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // ── Firefox desktop ───────────────────────────────────────────────────
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      // Only run on CI to keep local runs fast
      ...(process.env.CI ? {} : { testIgnore: '**/*' }),
    },
    // ── Mobile Chrome ─────────────────────────────────────────────────────
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    // ── Mobile Safari ─────────────────────────────────────────────────────
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      ...(process.env.CI ? {} : { testIgnore: '**/*' }),
    },
    // ── Auth-required tests — uses saved Clerk session state ──────────────
    {
      name: 'authenticated',
      testMatch: ['**/profile.spec.ts', '**/home.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/session.json',
      },
      // These tests require running the auth setup first:
      // node e2e/helpers/auth-setup.ts
    },
  ],
  // Auto-start Vite dev server when running locally
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
  // Visual snapshot configuration
  snapshotDir: './e2e/__snapshots__',
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 150,
      animations: 'disabled',
    },
  },
  // Output artifacts
  outputDir: './playwright-test-results',
});
