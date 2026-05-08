/**
 * AuthButtons (src/components/auth/auth_buttons.jsx) was removed during the
 * Clerk migration. Provider-specific auth is now handled by:
 *   - Clerk (Google, GitHub, email) via <SignIn> in AuthPage
 *   - Telegram via the "Continue with Telegram" button in AuthPage
 *
 * See __tests__/pages/AuthPage.test.jsx for Telegram button coverage.
 */

describe("AuthButtons (retired)", () => {
  it("placeholder — see AuthPage.test.jsx for auth button coverage", () => {
    expect(true).toBe(true);
  });
});
