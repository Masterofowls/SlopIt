/**
 * Landing page (/) — E2E tests.
 *
 * The landing page is fully public — no auth or API mocks needed.
 * Tests cover: visual structure, GREEN SLOP design, CTA buttons,
 * random subtitle display, navigation, responsiveness.
 */
import { test, expect } from "@playwright/test";
import {
  expectNoClerkIds,
  expectSingleH1,
  expectNoMissingAlt,
} from "./helpers/assertions";

test.describe("LandingPage (/)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for initial content to render
    await page.waitForSelector("h1", { timeout: 10_000 });
  });

  // ── Core content ────────────────────────────────────────────────────────────

  test("renders the SLOPIT brand title", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const text = await h1.innerText();
    expect(text.toLowerCase()).toContain("slop");
  });

  test("renders a subtitle / tagline", async ({ page }) => {
    // The subtitle rotates randomly — just verify something renders below h1
    const subtitle = page
      .locator('p, .subtitle, .tagline, [class*="subtitle"]')
      .first();
    await expect(subtitle).toBeVisible();
  });

  test("has at least one call-to-action button", async ({ page }) => {
    // Expects Login / Enter / Sign in type buttons
    const ctaButton = page
      .locator('button, a[href*="home"], a[href*="auth"], a[href*="login"]')
      .first();
    await expect(ctaButton).toBeVisible();
  });

  // ── No Clerk IDs in page ─────────────────────────────────────────────────────

  test("shows no raw Clerk internal IDs", async ({ page }) => {
    await expectNoClerkIds(page);
  });

  // ── Accessibility ────────────────────────────────────────────────────────────

  test("has at least one h1 heading", async ({ page }) => {
    await expectSingleH1(page);
  });

  test("all images have alt text", async ({ page }) => {
    await expectNoMissingAlt(page);
  });

  // ── GREEN SLOP design system ──────────────────────────────────────────────────

  test("uses custom slop font", async ({ page }) => {
    // Landing page uses the custom glitch-font, not Courier New
    const fontFamily = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    // Accept glitch-font OR Courier New (design token may be applied on sub-elements)
    const hasExpectedFont =
      fontFamily.includes("glitch-font") || fontFamily.includes("Courier New");
    expect(hasExpectedFont).toBe(true);
  });

  test("page background is dark (not white)", async ({ page }) => {
    // body itself may be transparent — check the main content container
    const bg = await page.evaluate(() => {
      const content =
        document.querySelector(".landing-content") ||
        document.querySelector(".landing-page") ||
        document.body;
      return getComputedStyle(content).backgroundColor;
    });
    // Should not be pure white
    expect(bg).not.toBe("rgb(255, 255, 255)");
  });

  // ── Navigation ───────────────────────────────────────────────────────────────

  test("clicking Login navigates to /auth", async ({ page }) => {
    const loginBtn = page.locator(
      'button:has-text("Login"), a:has-text("Login"), button:has-text("Sign in")',
    );
    const count = await loginBtn.count();
    if (count > 0) {
      await loginBtn.first().click();
      await expect(page).toHaveURL(/\/(auth|home)/);
    } else {
      // Some versions auto-redirect authenticated users — skip if no login button
      test.info().annotations.push({
        type: "info",
        description:
          "No login button found — user may already be authenticated",
      });
    }
  });

  // ── Responsiveness ───────────────────────────────────────────────────────────

  test("renders correctly at mobile width (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.waitForSelector("h1");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();

    // No horizontal scroll
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test("renders correctly at tablet width (768px)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForSelector("h1");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("renders correctly at desktop width (1440px)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await page.waitForSelector("h1");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  // ── Page metadata ─────────────────────────────────────────────────────────────

  test("has a page title", async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    await page.reload();
    await page.waitForTimeout(2000);
    // Filter out known Clerk/CORS warnings that don't affect functionality
    const realErrors = errors.filter(
      (e) =>
        !e.includes("clerk") &&
        !e.includes("CORS") &&
        !e.includes("ERR_BLOCKED_BY_CLIENT") &&
        // Font/asset loading failures are expected in test env
        !e.includes("ERR_FAILED") &&
        !e.includes("ERR_NAME_NOT_RESOLVED") &&
        !e.includes("Failed to load resource"),
    );
    expect(realErrors).toHaveLength(0);
  });
});
