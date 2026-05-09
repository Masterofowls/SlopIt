/**
 * Auth setup helper for Playwright E2E tests.
 *
 * HOW TO USE:
 * -----------
 * 1. Ensure the dev server is running: npm run dev
 * 2. Run: npx playwright test --config playwright.config.ts e2e/helpers/auth-setup.ts
 *    OR: npm run e2e:auth-setup
 * 3. This opens a browser, lets you sign in with Clerk, then saves the
 *    session to e2e/.auth/session.json
 * 4. The 'authenticated' project in playwright.config.ts uses this file.
 *
 * The saved session includes Clerk cookies + localStorage so subsequent tests
 * can run as the authenticated user without repeating the sign-in flow.
 *
 * ENVIRONMENT VARIABLES:
 *   PLAYWRIGHT_TEST_EMAIL    — Clerk test account email
 *   PLAYWRIGHT_TEST_PASSWORD — Clerk test account password
 *   (If not set, the browser opens interactively so you can sign in manually.)
 */
import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_FILE = path.join(__dirname, '../.auth/session.json');

setup('authenticate with Clerk', async ({ page }) => {
  // Ensure auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/');

  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

  if (email && password) {
    // Automated sign-in via environment variables
    await page.click('[data-testid="sign-in-btn"], a[href*="auth"], button:has-text("Login")');
    await page.waitForURL('**/auth', { timeout: 10_000 });

    // Wait for Clerk sign-in form
    await page.waitForSelector('input[type="email"], input[name="identifier"]', {
      timeout: 15_000,
    });
    await page.fill('input[type="email"], input[name="identifier"]', email);
    await page.keyboard.press('Enter');

    await page.waitForSelector('input[type="password"]', { timeout: 10_000 });
    await page.fill('input[type="password"]', password);
    await page.keyboard.press('Enter');

    // Wait for redirect after successful login
    await page.waitForURL('**/home', { timeout: 20_000 });
  } else {
    // Interactive sign-in — pause so the user can log in manually
    console.log(
      '\n⚠️  No PLAYWRIGHT_TEST_EMAIL/PASSWORD set.\n' +
        '   Sign in manually in the browser, then press Resume in Playwright.',
    );
    await page.pause();
  }

  // Save storage state (cookies + localStorage) for reuse in authenticated tests
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✅ Auth session saved to ${AUTH_FILE}`);
});
