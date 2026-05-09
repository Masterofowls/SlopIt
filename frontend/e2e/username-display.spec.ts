/**
 * USERNAME DISPLAY REGRESSION TESTS — most critical spec in this suite.
 *
 * These tests guard against the bug where Clerk internal user IDs
 * (e.g. user_3DT6aKB92KuolU9RxoPF0naad3g) appeared in the UI as
 * post author names, comment author names, and profile usernames.
 *
 * The fix is in:
 *   - Post.jsx      → resolveAuthorName()
 *   - CommentSection.jsx → resolveCommentAuthor()
 *   - ProfilePage.jsx    → cleanName()
 *
 * These tests ensure that even when the API returns raw Clerk IDs,
 * the UI always renders a safe fallback ("anon" or email prefix).
 *
 * No auth is required — we mock the backend API and drive PostPage
 * (which is not behind a ProtectedRoute).
 */
import { test, expect } from '@playwright/test';
import { mockBackendApi } from './helpers/api-mock';
import {
  CLERK_ID,
  CLERK_ID_ALT,
  CLERK_ID_PATTERN,
  MOCK_AUTHOR_CLERK_USERNAME,
  MOCK_AUTHOR_CLERK_DISPLAY_NAME,
  MOCK_COMMENTS_WITH_CLERK_AUTHOR,
  makeMockPost,
} from './mock-data';
import { expectNoClerkIds } from './helpers/assertions';

// ── Post author regression tests ──────────────────────────────────────────────

test.describe('Post author — Clerk ID regression', () => {
  test('post with author.username = Clerk ID shows "anon", not the raw ID', async ({
    page,
  }) => {
    const badPost = makeMockPost({
      slug: 'clerk-id-author',
      title: 'Clerk ID Author Post',
      author: MOCK_AUTHOR_CLERK_USERNAME,
    });
    await mockBackendApi(page, { postBySlug: badPost, comments: { results: [], next: null, count: 0 } });
    await page.goto('/post/clerk-id-author');
    await page.waitForSelector('.author-username', { timeout: 15_000 });

    const authorText = await page.locator('.author-username').first().innerText();

    // Must NOT be the raw Clerk ID
    expect(authorText).not.toMatch(CLERK_ID_PATTERN);
    expect(authorText).not.toBe(CLERK_ID);
    expect(authorText).not.toBe(CLERK_ID_ALT);
  });

  test('post with author.display_name = Clerk ID shows safe fallback', async ({
    page,
  }) => {
    const badPost = makeMockPost({
      slug: 'clerk-display-author',
      title: 'Clerk Display Name Author',
      author: MOCK_AUTHOR_CLERK_DISPLAY_NAME,
    });
    await mockBackendApi(page, { postBySlug: badPost, comments: { results: [], next: null, count: 0 } });
    await page.goto('/post/clerk-display-author');
    await page.waitForSelector('.author-username', { timeout: 15_000 });

    const authorText = await page.locator('.author-username').first().innerText();
    expect(authorText).not.toMatch(CLERK_ID_PATTERN);
  });

  test('post with all author fields null shows "anon"', async ({ page }) => {
    const badPost = makeMockPost({
      slug: 'null-author',
      title: 'No Author Post',
      author: null,
    });
    await mockBackendApi(page, { postBySlug: badPost, comments: { results: [], next: null, count: 0 } });
    await page.goto('/post/null-author');
    await page.waitForSelector('.author-username, .post-title', {
      timeout: 15_000,
    });

    const authorEl = page.locator('.author-username');
    if (await authorEl.count() > 0) {
      const authorText = await authorEl.first().innerText();
      // Should show "anon" or similar fallback
      expect(authorText.toLowerCase()).toMatch(/anon|unknown|user/);
      expect(authorText).not.toMatch(CLERK_ID_PATTERN);
    }
  });

  test('feed of posts with Clerk ID authors — none shown in UI', async ({
    page,
  }) => {
    const clerkPosts = {
      results: [
        makeMockPost({ id: 1, slug: 'p1', author: MOCK_AUTHOR_CLERK_USERNAME }),
        makeMockPost({ id: 2, slug: 'p2', author: MOCK_AUTHOR_CLERK_DISPLAY_NAME }),
        makeMockPost({
          id: 3,
          slug: 'p3',
          author: {
            id: 4,
            username: CLERK_ID_ALT,
            display_name: CLERK_ID_ALT,
            first_name: null,
            last_name: null,
            email: null,
            avatar_url: null,
          },
        }),
      ],
      next: null,
      count: 3,
    };
    await mockBackendApi(page, { feed: clerkPosts, posts: clerkPosts });
    await page.goto('/home');
    // Wait for any post content to appear
    await page.waitForTimeout(3000);

    // No Clerk IDs should be visible anywhere in the page
    const allText = await page.evaluate(() => document.body.innerText);
    const matches = allText.match(/(clerk_)?user_[a-z0-9]{6,}/gi);
    expect(
      matches,
      `Found raw Clerk IDs in feed: ${JSON.stringify(matches)}`,
    ).toBeNull();
  });
});

// ── Comment author regression tests ──────────────────────────────────────────

test.describe('Comment author — Clerk ID regression', () => {
  test('comment with author.username = Clerk ID shows "anon", not raw ID', async ({
    page,
  }) => {
    const mockPost = makeMockPost({ slug: 'comment-test' });
    await mockBackendApi(page, {
      postBySlug: mockPost,
      comments: MOCK_COMMENTS_WITH_CLERK_AUTHOR,
    });
    await page.goto('/post/comment-test');

    // Trigger comment expansion
    await page.waitForSelector('.post-title', { timeout: 15_000 });
    const commentBtn = page.locator(
      'button:has-text("comment"), button:has-text("COMMENT"), .toggle-comments',
    );
    if (await commentBtn.count() > 0) {
      await commentBtn.first().click();
      await page.waitForTimeout(1000);
    }

    // Check all .cs-author elements
    const authorEls = page.locator('.cs-author');
    const count = await authorEls.count();
    for (let i = 0; i < count; i++) {
      const text = await authorEls.nth(i).innerText();
      expect(text).not.toMatch(CLERK_ID_PATTERN);
    }
  });

  test('no raw Clerk IDs anywhere after loading post + comments', async ({
    page,
  }) => {
    const mockPost = makeMockPost({ slug: 'full-clerk-test' });
    await mockBackendApi(page, {
      postBySlug: mockPost,
      comments: MOCK_COMMENTS_WITH_CLERK_AUTHOR,
    });
    await page.goto('/post/full-clerk-test');

    // Expand comments
    await page.waitForSelector('.post-title', { timeout: 15_000 });
    const commentBtn = page.locator(
      'button:has-text("comment"), button:has-text("COMMENT")',
    );
    if (await commentBtn.count() > 0) {
      await commentBtn.first().click();
      await page.waitForTimeout(1000);
    }

    await expectNoClerkIds(page);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

test.describe('Clerk ID edge cases', () => {
  test('author with email but Clerk ID username falls back to email prefix', async ({
    page,
  }) => {
    const emailFallbackAuthor = {
      id: 5,
      username: CLERK_ID,
      display_name: null,
      first_name: null,
      last_name: null,
      email: 'testuser@example.com',
      avatar_url: null,
    };
    const post = makeMockPost({
      slug: 'email-fallback',
      author: emailFallbackAuthor,
    });
    await mockBackendApi(page, { postBySlug: post, comments: { results: [], next: null, count: 0 } });
    await page.goto('/post/email-fallback');
    await page.waitForSelector('.author-username', { timeout: 15_000 });

    const authorText = await page.locator('.author-username').first().innerText();
    // Should show the email prefix, not the Clerk ID
    expect(authorText).not.toMatch(CLERK_ID_PATTERN);
    // Depending on implementation, could be "testuser" or "testuser@example.com"
    expect(authorText.toLowerCase()).toContain('testuser');
  });

  test('author with first+last name and Clerk ID username shows full name', async ({
    page,
  }) => {
    const nameAuthor = {
      id: 6,
      username: CLERK_ID,
      display_name: null,
      first_name: 'Jane',
      last_name: 'Doe',
      email: null,
      avatar_url: null,
    };
    const post = makeMockPost({ slug: 'name-author', author: nameAuthor });
    await mockBackendApi(page, { postBySlug: post, comments: { results: [], next: null, count: 0 } });
    await page.goto('/post/name-author');
    await page.waitForSelector('.author-username', { timeout: 15_000 });

    const authorText = await page.locator('.author-username').first().innerText();
    expect(authorText).not.toMatch(CLERK_ID_PATTERN);
    expect(authorText).toContain('Jane');
  });
});
