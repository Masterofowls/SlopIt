/**
 * Reusable Playwright helper: mock the Django backend API (slopit-api.fly.dev).
 *
 * All api calls go through axios instance with baseURL:
 *   https://slopit-api.fly.dev/api/v1  (or VITE_API_URL env override)
 *
 * We intercept any URL containing /api/v1/ regardless of hostname,
 * so these mocks work against both localhost:5173 and fly.dev.
 */
import { Page } from "@playwright/test";
import {
  MOCK_FEED_RESPONSE,
  MOCK_PROFILE,
  MOCK_COMMENTS_CLEAN,
  makeMockPost,
  MOCK_POSTS_LIST,
} from "../mock-data";

const API = "**/api/v1";

export interface ApiMockOverrides {
  feed?: unknown;
  posts?: unknown;
  /** /me/ endpoint — alias: `profile` */
  me?: unknown;
  profile?: unknown;
  comments?: unknown;
  postBySlug?: unknown;
  userPosts?: unknown;
  bookmarks?: unknown;
  telegramMe?: unknown;
}

/**
 * Set up route-level mocks for all backend API endpoints used by the app.
 *
 * Call this BEFORE `page.goto()` so the mocks are active when the page loads.
 * Overrides allow per-test customisation without boilerplate.
 */
export async function mockBackendApi(
  page: Page,
  overrides: ApiMockOverrides = {},
) {
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  // Telegram session check — always return unauthenticated so we don't mix
  // session-cookie auth into tests that mock Clerk.
  await page.route(`${API}/me/telegram/`, (r) =>
    r.fulfill({ status: 401, body: '{"detail":"Unauthenticated"}' }),
  );

  // Profile endpoint
  await page.route(`${API}/me/`, (r) =>
    r.fulfill(json(overrides.me ?? overrides.profile ?? MOCK_PROFILE)),
  );

  // Bookmarks
  await page.route(`${API}/me/bookmarks/`, (r) =>
    r.fulfill(
      json(overrides.bookmarks ?? { results: [], next: null, count: 0 }),
    ),
  );

  // Feed (cursor-based)
  await page.route(`${API}/feed/**`, (r) =>
    r.fulfill(json(overrides.feed ?? MOCK_FEED_RESPONSE)),
  );

  // Posts list (own posts on homepage)
  await page.route(`${API}/posts/?ordering=*`, (r) =>
    r.fulfill(json(overrides.posts ?? MOCK_FEED_RESPONSE)),
  );

  // Post by slug — used by PostPage
  await page.route(`${API}/posts/by-slug/**`, async (route) => {
    const slug = route
      .request()
      .url()
      .split("/posts/by-slug/")[1]
      ?.replace(/\/$/, "");
    const defaultPost = makeMockPost({ slug: slug ?? "test", id: 99 });
    await route.fulfill(json(overrides.postBySlug ?? defaultPost));
  });

  // Comments for a post
  await page.route(`${API}/posts/*/comments/**`, (r) =>
    r.fulfill(json(overrides.comments ?? MOCK_COMMENTS_CLEAN)),
  );

  // User posts (ProfilePage)
  await page.route(`${API}/users/*/posts/**`, (r) =>
    r.fulfill(
      json(
        overrides.userPosts ?? {
          results: MOCK_POSTS_LIST,
          next: null,
          count: 3,
        },
      ),
    ),
  );

  // Reactions (POST, swallow silently)
  await page.route(`${API}/posts/*/react/`, (r) =>
    r.fulfill({ status: 200, body: '{"status":"ok"}' }),
  );

  // Bookmarks (POST/DELETE)
  await page.route(`${API}/posts/*/bookmark/`, (r) =>
    r.fulfill({ status: 200, body: '{"bookmarked":true}' }),
  );

  // Trending tags (used in Navigation sidebar)
  await page.route(`${API}/tags/trending/**`, (r) =>
    r.fulfill(json({ results: [], next: null, count: 0 })),
  );
}

/**
 * Mock Clerk's Frontend API (FAPI) to simulate an authenticated session.
 *
 * This intercepts the network calls Clerk.js makes to initialise the session.
 * NOTE: Clerk v5 validates JWT signatures. These mocked responses will cause
 * Clerk to initialize but may not result in `isSignedIn: true` unless the
 * JWT passes cryptographic validation.
 *
 * For full E2E auth tests, use storageState from a real login session:
 *   npm run e2e:auth-setup  →  saves e2e/.auth/session.json
 */
export async function mockClerkFapi(page: Page) {
  // Intercept Clerk FAPI — covers both development and production Clerk keys
  await page.route("**/v1/client*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        response: {
          id: "client_test",
          object: "client",
          sessions: [], // empty = signed out state (sufficient for UI tests)
          sign_in: null,
          sign_up: null,
          last_active_session_id: null,
        },
        client: null,
      }),
    });
  });

  // Swallow all other Clerk calls silently to prevent network errors in tests
  await page.route("**clerk.**.com/**", (r) => r.abort());
  await page.route("**clerk.accounts.dev/**", (r) => r.abort());
}
