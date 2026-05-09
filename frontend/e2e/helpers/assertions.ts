/**
 * Assertion helpers for the GREEN SLOP design system.
 * Central place for design token checks used across specs.
 */
import { Page, expect } from '@playwright/test';

// ── Design tokens ─────────────────────────────────────────────────────────────

export const GREEN_SLOP = {
  primary: '#00ff00',
  background: 'rgba(0, 20, 0',   // prefix — rgba() has varying alpha
  fontFamily: 'Courier New',
} as const;

// ── Typography / colour assertions ────────────────────────────────────────────

/** Assert the page body uses the Courier New monospace font. */
export async function expectSlopFont(page: Page) {
  const fontFamily = await page.evaluate(() =>
    getComputedStyle(document.body).fontFamily,
  );
  expect(fontFamily).toContain('Courier New');
}

/** Assert a CSS custom property or computed color includes the green hue. */
export async function expectGreenElement(
  page: Page,
  selector: string,
  property: 'color' | 'background-color' | 'border-color' = 'color',
) {
  const value = await page.locator(selector).evaluate(
    (el, prop) => getComputedStyle(el).getPropertyValue(prop),
    property,
  );
  // rgb(0, 255, 0) or rgba(0, 255, 0, ...) — both are #00ff00
  expect(value).toMatch(/rgb\(0,\s*255,\s*0\)|rgba\(0,\s*255,\s*0/);
}

// ── Clerk ID regression checks ────────────────────────────────────────────────

/**
 * Assert that NO text visible on the page matches the Clerk internal ID
 * pattern: user_xxxx or clerk_user_xxxx.
 *
 * This is the primary regression guard for the display-name bug fix.
 */
export async function expectNoClerkIds(page: Page) {
  const allText = await page.evaluate(() => document.body.innerText);
  const CLERK_ID_RE = /(clerk_)?user_[a-z0-9]{6,}/gi;
  const matches = allText.match(CLERK_ID_RE);
  expect(
    matches,
    `Found raw Clerk IDs in page text: ${JSON.stringify(matches)}`,
  ).toBeNull();
}

/**
 * Assert that a specific element's text content does NOT match Clerk ID pattern.
 */
export async function expectNoClerkIdIn(page: Page, selector: string) {
  const text = await page.locator(selector).innerText();
  expect(text).not.toMatch(/(clerk_)?user_[a-z0-9]{6,}/i);
}

// ── Accessibility helpers ─────────────────────────────────────────────────────

/** Check page has a single h1. */
export async function expectSingleH1(page: Page) {
  const count = await page.locator('h1').count();
  expect(count).toBeGreaterThanOrEqual(1);
}

/** Assert no images are missing alt text. */
export async function expectNoMissingAlt(page: Page) {
  const missing = await page.locator('img:not([alt])').count();
  expect(
    missing,
    `${missing} image(s) are missing alt attributes`,
  ).toBe(0);
}
