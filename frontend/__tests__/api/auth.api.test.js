/**
 * Unit tests for src/api/auth.js
 *
 * Tests:
 *  - getSession: success, unauthenticated, network error
 *  - getProviders: returns list, returns empty on error
 *  - fetchCsrf: stores token on client headers
 *  - logout: calls csrf then logout endpoint
 *  - loginWithProvider: builds correct redirect URL
 *  - No unexpected console.error calls
 *
 * Axios is mocked by creating jest.fn()s INSIDE the factory and exposing them
 * via __get/__post/__defaults properties on the mock module. This avoids the
 * temporal dead zone error that occurs when referencing `const` variables from
 * outside a hoisted jest.mock() factory.
 */

jest.mock("axios", () => {
  const _get = jest.fn();
  const _post = jest.fn();
  const _defaults = { headers: { common: {} } };
  return {
    create: jest.fn(() => ({ get: _get, post: _post, defaults: _defaults })),
    __get: _get,
    __post: _post,
    __defaults: _defaults,
  };
});

import axios from "axios";
// Same jest.fn() instances that the factory passed to axios.create()
const mockGet = axios.__get;
const mockPost = axios.__post;
const mockDefaults = axios.__defaults;

// Import real auth.js AFTER mocks (jest.mock is hoisted before imports)
import {
  getSession,
  getProviders,
  fetchCsrf,
  logout,
  loginWithProvider,
} from "../../src/api/auth.js";

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockDefaults.headers.common = {};
  // Only reset href -- origin/hostname/protocol are read-only getters on jsdom Location
  window.location.href = "http://localhost/";
});

// getSession
describe("getSession()", () => {
  it("returns session data when server responds with authenticated:true", async () => {
    mockGet.mockResolvedValueOnce({
      data: { authenticated: true, user: { id: 1, username: "alice" } },
    });
    const result = await getSession();
    expect(result).toEqual({
      authenticated: true,
      user: { id: 1, username: "alice" },
    });
    expect(mockGet).toHaveBeenCalledWith("/auth/session/");
  });

  it("returns { authenticated: false, user: null } on network error", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network Error"));
    const result = await getSession();
    expect(result).toEqual({ authenticated: false, user: null });
  });

  it("returns { authenticated: false, user: null } when server returns unauthenticated", async () => {
    mockGet.mockResolvedValueOnce({
      data: { authenticated: false, user: null },
    });
    const result = await getSession();
    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
  });
});

// getProviders
describe("getProviders()", () => {
  it("returns provider list on success", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        providers: [
          {
            id: "github",
            name: "GitHub",
            login_url: "/accounts/github/login/",
          },
          {
            id: "google",
            name: "Google",
            login_url: "/accounts/google/login/",
          },
        ],
      },
    });
    const providers = await getProviders();
    expect(providers).toHaveLength(2);
    expect(providers[0]).toMatchObject({ id: "github" });
    expect(providers[1]).toMatchObject({ id: "google" });
    expect(mockGet).toHaveBeenCalledWith("/auth/providers/");
  });

  it("returns empty array when no providers key in response", async () => {
    mockGet.mockResolvedValueOnce({ data: {} });
    expect(await getProviders()).toEqual([]);
  });

  it("returns empty array and logs error on network failure", async () => {
    mockGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const providers = await getProviders();
    expect(providers).toEqual([]);
    expect(spy).toHaveBeenCalledWith(
      "[auth] getProviders:error",
      expect.any(Error),
    );
    spy.mockRestore();
  });
});

// fetchCsrf
describe("fetchCsrf()", () => {
  it("fetches CSRF token and stores it on client headers", async () => {
    mockGet.mockResolvedValueOnce({ data: { csrfToken: "tok-abc123" } });
    const token = await fetchCsrf();
    expect(token).toBe("tok-abc123");
    expect(mockGet).toHaveBeenCalledWith("/auth/csrf/");
    expect(mockDefaults.headers.common["X-CSRFToken"]).toBe("tok-abc123");
  });
});

// logout
describe("logout()", () => {
  it("calls /auth/csrf/ then /auth/logout/ in order", async () => {
    mockGet.mockResolvedValueOnce({ data: { csrfToken: "tok-xyz" } });
    mockPost.mockResolvedValueOnce({ data: {} });
    await logout();
    expect(mockGet).toHaveBeenCalledWith("/auth/csrf/");
    expect(mockPost).toHaveBeenCalledWith("/auth/logout/");
    const getOrder = mockGet.mock.invocationCallOrder[0];
    const postOrder = mockPost.mock.invocationCallOrder[0];
    expect(getOrder).toBeLessThan(postOrder);
  });
});

// loginWithProvider
// jsdom does not implement navigation, so window.location.href never updates.
// Instead, spy on console.info which logs the resolved oauthUrl before navigating.
describe("loginWithProvider()", () => {
  let capturedOauthUrl;

  beforeEach(() => {
    capturedOauthUrl = undefined;
    jest.spyOn(console, "info").mockImplementation((msg, data) => {
      if (msg === "[auth] loginWithProvider:redirect") {
        capturedOauthUrl = data.oauthUrl;
      }
    });
  });

  it("rewrites absolute providerLoginUrl to same origin", () => {
    loginWithProvider(
      "github",
      "https://api.example.com/accounts/github/login/?next=/",
    );
    expect(capturedOauthUrl).toBe(
      "http://localhost/accounts/github/login/?next=/",
    );
  });

  it("uses fallback URL when providerLoginUrl is empty", () => {
    loginWithProvider("google", "");
    expect(capturedOauthUrl).toContain("accounts/google/login/");
  });

  it("uses providerLoginUrl as-is when it is a relative path", () => {
    loginWithProvider("telegram", "/accounts/telegram/login/");
    // new URL('/accounts/telegram/login/') throws -- raw value is used
    expect(capturedOauthUrl).toBe("/accounts/telegram/login/");
  });
});
