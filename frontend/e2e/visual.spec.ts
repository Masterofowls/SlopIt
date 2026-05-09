/**
 * Visual regression tests — pixel-perfect snapshot comparisons.
 *
 * Run with:
 *   npm run test:e2e:update-snapshots  (first time, or when UI intentionally changes)
 *   npm run test:e2e                   (subsequent runs — fails on unexpected diffs)
 *
 * Snapshots are stored in: frontend/e2e/__snapshots__/
 *
 * All visual tests use mocked APIs to ensure deterministic renders.
 * Animations are disabled in playwright.config.ts (animations: 'disabled').
 *
 * NOTE: These only run on chromium (not in the `authenticated` project).
 * Snapshot names include the OS/browser suffix added by Playwright automatically.
 */
import { test, expect } from '@playwright/test';
import { mockBackendApi } from './helpers/api-mock';
import { makeMockPost, MOCK_FEED_RESPONSE, MOCK_PROFILE } from './mock-data';

// Helper: wait for fonts + layout to settle
async function waitForStableRender(page: import('@playwright/test').Page) {
  // Wait for network idle (no pending requests)
  await page.waitForLoadState('networkidle');
  // Extra buffer for CSS transitions / font loading
  await page.waitForTimeout(500);
}

// ── LandingPage visual snapshots ──────────────────────────────────────────────

test.describe('Visual — LandingPage', () => {
  test('desktop 1280×720 matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await waitForStableRender(page);
    await expect(page).toHaveScreenshot('landing-desktop-1280.png', {
      fullPage: false,
    });
  });

  test('mobile 375×812 matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await waitForStableRender(page);
    await expect(page).toHaveScreenshot('landing-mobile-375.png', {
      fullPage: false,
    });
  });

  test('tablet 768×1024 matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await waitForStableRender(page);
    await expect(page).toHaveScreenshot('landing-tablet-768.png', {
      fullPage: false,
    });
  });
});

// ── PostPage visual snapshots ─────────────────────────────────────────────────

test.describe('Visual — PostPage', () => {
  test.beforeEach(async ({ page }) => {
    const post = makeMockPost({
      slug: 'visual-test-post',
      title: 'VISUAL_TEST: This Is Slop',
      body_html:
        '<p>This is the <strong>deterministic</strong> post body for visual testing.</p>',
    });
    await mockBackendApi(page, {
      postBySlug: post,
      comments: { results: [], next: null, count: 0 },
    });
  });

  test('desktop 1280×720 matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/post/visual-test-post');
    await page.waitForSelector('.post-title', { timeout: 15_000 });
    await waitForStableRender(page);
    await expect(page).toHaveScreenshot('post-page-desktop-1280.png', {
      fullPage: false,
    });
  });

  test('mobile 375×812 matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/post/visual-test-post');
    await page.waitForSelector('.post-title', { timeout: 15_000 });
    await waitForStableRender(page);
    await expect(page).toHaveScreenshot('post-page-mobile-375.png', {
      fullPage: false,
    });
  });
});

// ── Design system spot checks ─────────────────────────────────────────────────

test.describe('Visual — Design system colours', () => {
  test('landing page background is dark (not white)', async ({ page }) => {
    await page.goto('/');
    await waitForStableRender(page);

    // Take a screenshot and check the dominant background colour is dark
    const bgColour = await page.evaluate(() => {
      const el = document.documentElement;
      return window.getComputedStyle(el).backgroundColor;
    });
    // Should not be pure white
    expect(bgColour).not.toBe('rgb(255, 255, 255)');
  });

  test('landing page uses monospace font', async ({ page }) => {
    await page.goto('/');
    await waitForStableRender(page);

    const fontFamily = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).fontFamily;
    });
    // GREEN SLOP design: Courier New or similar monospace
    const isMonospace =
      fontFamily.includes('Courier') ||
      fontFamily.includes('monospace') ||
      fontFamily.includes('mono');
    expect(isMonospace).toBe(true);
  });

  test('green accent colour is used on LandingPage', async ({ page }) => {
    await page.goto('/');
    await waitForStableRender(page);

    // Check for any element with green (#00ff00) colour
    const hasGreenText = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const c = window.getComputedStyle(el).color;
        if (c === 'rgb(0, 255, 0)') return true;
      }
      return false;
    });
    expect(hasGreenText).toBe(true);
  });
});
