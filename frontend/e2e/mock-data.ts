/**
 * Shared mock data for Playwright E2E tests.
 * Mirrors the shape of the Django REST API responses.
 */

// ── ID patterns ───────────────────────────────────────────────────────────────

/** Raw Clerk ID that should NEVER appear in the UI after our display-name fix. */
export const CLERK_ID = 'user_3DT6aKB92KuolU9RxoPF0naad3g';
export const CLERK_ID_ALT = 'clerk_user_abc123def456xyz';
/** k_user_ variant seen in live Clerk responses (also must not appear in UI). */
export const CLERK_ID_K_PREFIX = 'k_user_3DT6aKB92KuolU9RxoPF0naad3g';

/** Regex used by cleanName / isClerkId in the source code (mirrors source). */
export const CLERK_ID_PATTERN = /^(clerk_|k_)?user_[a-z0-9]{6,}/i;

// ── Author objects ────────────────────────────────────────────────────────────

export const MOCK_AUTHOR = {
  id: 1,
  username: 'slopmaster',
  display_name: 'Slop Master',
  first_name: 'Slop',
  last_name: 'Master',
  email: 'slop@example.com',
  avatar_url: null,
};

/** Author whose username is a raw Clerk ID — the bug scenario. */
export const MOCK_AUTHOR_CLERK_USERNAME = {
  id: 2,
  username: CLERK_ID,
  display_name: null,       // simulate missing display_name
  first_name: null,
  last_name: null,
  email: null,
  avatar_url: null,
};

/** Author with Clerk ID as display_name (secondary bug scenario). */
export const MOCK_AUTHOR_CLERK_DISPLAY_NAME = {
  id: 3,
  username: 'user_clerk_fallback',
  display_name: CLERK_ID,
  first_name: null,
  last_name: null,
  email: 'user@example.com',
  avatar_url: null,
};

// ── Profile (/me/) ────────────────────────────────────────────────────────────

export const MOCK_PROFILE = {
  username: 'slopmaster',
  email: 'slop@example.com',
  bio: 'I slop therefore I am.',
  avatar_url: null,
  social_avatar_url: null,
  website_url: null,
  feed_lifetime_hours: 24,
  karma_score: 420,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-05-01T10:00:00Z',
};

/** Profile where the username is a Clerk internal ID — tests the display fix. */
export const MOCK_PROFILE_CLERK_ID = {
  ...MOCK_PROFILE,
  username: CLERK_ID,
  email: null,
  bio: '',
};

// ── Posts ─────────────────────────────────────────────────────────────────────

export function makeMockPost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    slug: 'test-slop-abc123',
    title: 'My First Slop',
    body_markdown:
      'This is some **serious** slop content.\n\nSecond paragraph.',
    body_html:
      '<p>This is some <strong>serious</strong> slop content.</p>' +
      '<p>Second paragraph.</p>',
    kind: 'text',
    author: MOCK_AUTHOR,
    reaction_counts: { like: 42, dislike: 3 },
    comment_count: 7,
    user_reaction: null,
    created_at: '2025-05-09T08:00:00Z',
    tags: ['slop', 'vibes'],
    media_urls: [],
    ...overrides,
  };
}

export const MOCK_POSTS_LIST = [
  makeMockPost({ id: 1, slug: 'slop-alpha', title: 'Alpha Slop' }),
  makeMockPost({ id: 2, slug: 'slop-beta', title: 'Beta Slop' }),
  makeMockPost({ id: 3, slug: 'slop-gamma', title: 'Gamma Slop' }),
];

export const MOCK_FEED_RESPONSE = {
  results: MOCK_POSTS_LIST,
  next: null,
  previous: null,
  count: 3,
};

// ── Comments ──────────────────────────────────────────────────────────────────

export function makeMockComment(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: 1,
    body_markdown: 'Great slop, 10/10',
    author: MOCK_AUTHOR,
    created_at: '2025-05-09T08:05:00Z',
    reply_count: 0,
    reaction_counts: { like: 1, dislike: 0 },
    user_reaction: null,
    ...overrides,
  };
}

export const MOCK_COMMENTS_CLEAN = {
  results: [
    makeMockComment({ id: 1, body_markdown: 'This slop hits different.' }),
    makeMockComment({
      id: 2,
      body_markdown: 'Certified slop moment.',
      author: {
        ...MOCK_AUTHOR,
        id: 3,
        username: 'slopreader',
        display_name: 'Slop Reader',
      },
    }),
  ],
  next: null,
  previous: null,
  count: 2,
};

/** Comments with a Clerk ID as author — the bug scenario for CommentSection. */
export const MOCK_COMMENTS_WITH_CLERK_AUTHOR = {
  results: [
    makeMockComment({ id: 1 }),
    makeMockComment({
      id: 2,
      body_markdown: 'Another test comment.',
      author: MOCK_AUTHOR_CLERK_USERNAME,
    }),
    makeMockComment({
      id: 3,
      body_markdown: 'Yet another comment.',
      author: MOCK_AUTHOR_CLERK_DISPLAY_NAME,
    }),
  ],
  next: null,
  previous: null,
  count: 3,
};

// ── Clerk mock user (for window injection) ────────────────────────────────────

export const MOCK_CLERK_USER = {
  id: 'user_mock_test_clerk_id',
  username: 'slopmaster',
  fullName: 'Slop Master',
  firstName: 'Slop',
  lastName: 'Master',
  primaryEmailAddress: { emailAddress: 'slop@example.com' },
  imageUrl: '',
  createdAt: new Date('2025-01-15').getTime(),
};
