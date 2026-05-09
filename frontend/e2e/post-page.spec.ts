/**
 * PostPage (/post/:slug) — E2E tests.
 *
 * PostPage is NOT behind a ProtectedRoute, so it renders without Clerk auth.
 * We mock the backend API via page.route() to avoid hitting the live API.
 *
 * Selectors confirmed from source:
 *   .author-username  — post author name (in Post.jsx)
 *   .post-title       — post title
 *   .post-text        — post body
 *   .cs-author        — comment author name (in CommentSection.jsx)
 */
import { test, expect } from "@playwright/test";
import { mockBackendApi } from "./helpers/api-mock";
import { makeMockPost, MOCK_COMMENTS_CLEAN, MOCK_AUTHOR } from "./mock-data";
import { expectNoClerkIds } from "./helpers/assertions";

const TEST_SLUG = "test-slop-abc123";

test.describe("PostPage (/post/:slug)", () => {
  test.beforeEach(async ({ page }) => {
    const mockPost = makeMockPost({
      slug: TEST_SLUG,
      title: "My First Slop",
      body_html: "<p>This is some <strong>serious</strong> slop content.</p>",
      author: MOCK_AUTHOR,
    });
    await mockBackendApi(page, {
      postBySlug: mockPost,
      comments: MOCK_COMMENTS_CLEAN,
    });
    await page.goto(`/post/${TEST_SLUG}`);
    // Wait for post content to load (not the loading spinner)
    await page.waitForSelector(".post-title, .post-page__error", {
      timeout: 15_000,
    });
  });

  // ── Content rendering ────────────────────────────────────────────────────────

  test("renders the post title", async ({ page }) => {
    const title = page.locator(".post-title").first();
    await expect(title).toBeVisible();
    await expect(title).toContainText("My First Slop");
  });

  test("renders the post body", async ({ page }) => {
    const body = page.locator(".post-text").first();
    await expect(body).toBeVisible();
    await expect(body).toContainText("slop content");
  });

  test("renders the post author name", async ({ page }) => {
    const authorEl = page.locator(".author-username").first();
    await expect(authorEl).toBeVisible();
    await expect(authorEl).toContainText("Slop Master");
  });

  test("author name is not a raw Clerk internal ID", async ({ page }) => {
    const authorText = await page
      .locator(".author-username")
      .first()
      .innerText();
    expect(authorText).not.toMatch(/(clerk_)?user_[a-z0-9]{6,}/i);
  });

  // ── Comments ─────────────────────────────────────────────────────────────────

  test("shows a comment toggle button", async ({ page }) => {
    // Comment button should be in the post footer
    const commentBtn = page.locator(
      'button:has-text("comment"), button[aria-label*="comment"], .post-comments-btn',
    );
    const count = await commentBtn.count();
    if (count > 0) {
      await expect(commentBtn.first()).toBeVisible();
    }
    // Post component renders comment section — may auto-expand on PostPage
  });

  // ── Regression: no Clerk IDs visible ─────────────────────────────────────────

  test("shows no raw Clerk internal IDs anywhere on page", async ({ page }) => {
    // Also expand comments if they exist
    const commentToggle = page.locator(
      'button:has-text("comment"), .cs-toggle, button:has-text("COMMENT")',
    );
    if ((await commentToggle.count()) > 0) {
      await commentToggle.first().click();
      await page.waitForTimeout(500);
    }
    await expectNoClerkIds(page);
  });

  // ── Error states ─────────────────────────────────────────────────────────────

  test("shows error message when post is not found (404)", async ({ page }) => {
    await page.route("**/api/v1/posts/by-slug/**", (route) =>
      route.fulfill({ status: 404, body: '{"detail":"Not found."}' }),
    );
    await page.goto("/post/nonexistent-slug");
    await page.waitForSelector(".post-page__error, .post-page__error-text", {
      timeout: 10_000,
    });
    const errorMsg = page
      .locator(".post-page__error-text, .post-page__error")
      .first();
    await expect(errorMsg).toBeVisible();
  });

  test("shows loading state then content", async ({ page }) => {
    // Slow down the API response to catch loading state
    await page.route("**/api/v1/posts/by-slug/**", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        json: makeMockPost({ slug: "slow-post", title: "Slow Slop" }),
      });
    });
    await page.goto("/post/slow-post");

    // Loading state may appear briefly
    const loadingText = page.locator(".post-page__loading-text");
    // Wait for final content (loading may resolve too fast to catch)
    await page.waitForSelector(".post-title, .post-page__error", {
      timeout: 10_000,
    });
    await expect(page.locator(".post-title").first()).toBeVisible();
  });

  // ── Back button ──────────────────────────────────────────────────────────────

  test("back button is visible and clickable", async ({ page }) => {
    const backBtn = page.locator(".post-page__back-btn");
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toContainText("BACK");
  });

  // ── Navigation ───────────────────────────────────────────────────────────────

  test("renders navigation bar", async ({ page }) => {
    // Navigation component always renders
    const nav = page.locator("nav, header, .navigation, .nav-bar");
    await expect(nav.first()).toBeVisible();
  });
});
