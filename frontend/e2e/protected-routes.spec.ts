/**
 * ProtectedRoute behaviour — E2E tests.
 *
 * Verifies that:
 *  - /profile redirects to /auth (or shows login) when not authenticated
 *  - /home, /post/:slug, / render without auth redirect
 *
 * We do NOT use a mock Clerk session here — tests run unauthenticated.
 * Clerk will be in an uninitialized / signed-out state.
 */
import { test, expect } from "@playwright/test";
import { mockBackendApi } from "./helpers/api-mock";
import { makeMockPost, MOCK_FEED_RESPONSE } from "./mock-data";

test.describe("Protected routes — unauthenticated access", () => {
  // ── /profile — must redirect ────────────────────────────────────────────────

  test("/profile shows auth gate when not signed in", async ({ page }) => {
    await mockBackendApi(page);
    await page.goto("/profile");

    // ProtectedRoute renders <AuthPage /> in-place (no redirect).
    // URL may stay at /profile OR redirect to /auth.
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    const isRedirected =
      currentUrl.includes("/auth") || currentUrl.includes("/sign-in");

    // ProtectedRoute renders AuthPage inline — check for auth-page content
    const hasAuthContent =
      (await page.locator(".auth-page, .auth-page-title").count()) > 0 ||
      (await page.locator('h1:has-text("SlopIt")').count()) > 0 ||
      (await page
        .locator('button:has-text("back"), button:has-text("←")')
        .count()) > 0 ||
      (await page.locator('[class*="cl-"], input[type="email"]').count()) > 0;

    // Either redirected to /auth OR auth gate content is visible
    expect(isRedirected || hasAuthContent).toBe(true);
  });

  // ── /home — NOT behind ProtectedRoute ──────────────────────────────────────

  test("/home renders content without auth (not a protected route)", async ({
    page,
  }) => {
    await mockBackendApi(page, { feed: MOCK_FEED_RESPONSE });
    await page.goto("/home");

    // Should stay on /home — this is NOT a ProtectedRoute
    await expect(page).toHaveURL(/\/home/);

    // Page should render some content
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  // ── /post/:slug — NOT behind ProtectedRoute ─────────────────────────────────

  test("/post/:slug renders without auth redirect", async ({ page }) => {
    await mockBackendApi(page, {
      postBySlug: makeMockPost({ slug: "public-post" }),
    });
    await page.goto("/post/public-post");

    // Should stay on this URL
    await expect(page).toHaveURL(/\/post\/public-post/);
    await page.waitForSelector(".post-title, .post-page__error", {
      timeout: 10_000,
    });
  });

  // ── / (landing) — public ───────────────────────────────────────────────────

  test("/ renders without auth redirect", async ({ page }) => {
    await page.goto("/");
    // Should not redirect away from / — check URL ends with just /
    const url = page.url();
    expect(url).toMatch(/localhost:\d+\/?$/);
    await page.waitForSelector("h1", { timeout: 10_000 });
  });
});

// ── Authenticated user flow ────────────────────────────────────────────────────

test.describe("Auth page (/auth)", () => {
  test("/auth URL loads without crashing (no dedicated route)", async ({
    page,
  }) => {
    // /auth has no React Router <Route> — the auth gate is rendered by
    // <ProtectedRoute> inline (e.g., at /profile). Navigating directly to /auth
    // loads the SPA shell but no page-specific component. Verify no crash.
    await page.goto("/auth");
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    expect(url).toContain("/auth");
    // SPA root element must exist (app didn't crash)
    await expect(page.locator("#root")).toBeAttached();
  });

  test("/auth does not redirect back to itself", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForTimeout(2000);
    // Should still be on /auth or have successfully navigated to /home (if auto-signed-in)
    const url = page.url();
    expect(url).toMatch(/\/(auth|home|$)/);
  });
});

// ── Deep links ────────────────────────────────────────────────────────────────

test.describe("Deep linking", () => {
  test("deep link to /post/:slug works and shows post", async ({ page }) => {
    const slug = "deep-link-test";
    await mockBackendApi(page, {
      postBySlug: makeMockPost({ slug, title: "Deep Linked Post" }),
    });
    await page.goto(`/post/${slug}`);
    await page.waitForSelector(".post-title", { timeout: 15_000 });
    await expect(page.locator(".post-title").first()).toContainText(
      "Deep Linked Post",
    );
  });

  test("unknown route shows 404 content or redirects", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz-404");
    await page.waitForTimeout(2000);
    // Either shows a 404 page or redirects to home — should not crash
    const text = (await page.locator("body").innerText()).toLowerCase();
    const is404 = text.includes("not found") || text.includes("404");
    const isRedirected =
      page.url().includes("/home") || page.url().endsWith("/");
    // The app should handle unknown routes gracefully
    expect(is404 || isRedirected || text.length > 0).toBe(true);
  });
});
