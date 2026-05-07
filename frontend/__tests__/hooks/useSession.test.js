/**
 * Tests for src/hooks/useSession.js
 *
 * The hook has module-level shared state (sharedSession, sharedFetchedAt).
 * Strategy: keep static imports (so React instance is consistent), and expire
 * the shared cache between tests by advancing a fake Date.now() clock by 10 s
 * (> 4 s TTL) in beforeEach. Tests use waitFor() for final state assertions
 * so they are not sensitive to the initial sharedSession value.
 */

import { renderHook, act, waitFor } from "@testing-library/react";

jest.mock("../../src/api/auth.js", () => ({
  getSession: jest.fn(),
  logout: jest.fn(),
}));

import { getSession, logout } from "../../src/api/auth.js";
import { useSession } from "../../src/hooks/useSession.js";

// Incrementing fake clock -- each test advances by 10 s to expire the 4 s cache
let fakeNow = 1_700_000_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  fakeNow += 10_000; // advance past SESSION_CACHE_MS (4000 ms)
  jest.spyOn(Date, "now").mockReturnValue(fakeNow);
  sessionStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});

// Fixtures
const AUTHED = {
  authenticated: true,
  user: { id: 1, username: "alice", profile: { displayName: "Alice" } },
};
const UNAUTHED = { authenticated: false, user: null };

// ── Authenticated flow ─────────────────────────────────────────────────────────

describe("useSession() -- authenticated flow", () => {
  it("fetches on mount and resolves with user session", async () => {
    getSession.mockResolvedValue(AUTHED);

    const { result } = renderHook(() => useSession());

    // Wait for the fetch to complete (sessionStorage is cleared in beforeEach)
    await waitFor(() =>
      expect(sessionStorage.getItem("auth:last_status")).toBe("success"),
    );

    expect(result.current.session).not.toBeNull();
    expect(result.current.session.user.username).toBe("alice");
    expect(result.current.error).toBeNull();
  });

  it("sets session to null when API returns authenticated:false", async () => {
    getSession.mockResolvedValue(UNAUTHED);

    const { result } = renderHook(() => useSession());

    await waitFor(() =>
      expect(sessionStorage.getItem("auth:last_status")).toBe(
        "unauthenticated",
      ),
    );

    expect(result.current.session).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("exposes the user object with expected nested fields", async () => {
    getSession.mockResolvedValue(AUTHED);

    const { result } = renderHook(() => useSession());
    await waitFor(() =>
      expect(sessionStorage.getItem("auth:last_status")).toBe("success"),
    );

    expect(result.current.session.user).toMatchObject({
      id: 1,
      username: "alice",
    });
    expect(result.current.session.user.profile.displayName).toBe("Alice");
  });
});

// ── Error handling ─────────────────────────────────────────────────────────────

describe("useSession() -- error handling", () => {
  it("sets error and null session when getSession throws", async () => {
    const networkError = new Error("Network Error");
    getSession.mockRejectedValue(networkError);

    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSession());

    await waitFor(() =>
      expect(sessionStorage.getItem("auth:last_status")).toBe("error"),
    );

    expect(result.current.session).toBeNull();
    expect(result.current.error).toBe(networkError);
    spy.mockRestore();
  });
});

// ── Cache ──────────────────────────────────────────────────────────────────────

describe("useSession() -- cache", () => {
  it("does not call getSession twice within the cache TTL", async () => {
    // Date.now() is fixed to fakeNow for the duration of this test (by beforeEach).
    // After the first fetch: sharedFetchedAt = fakeNow.
    // Second render cache check: fakeNow - fakeNow = 0 < 4000 -> hit.
    getSession.mockResolvedValue(AUTHED);

    const { result: r1 } = renderHook(() => useSession());
    await waitFor(() => expect(r1.current.isPending).toBe(false));

    const callsAfterFirst = getSession.mock.calls.length; // should be 1

    const { result: r2 } = renderHook(() => useSession());
    await waitFor(() => expect(r2.current.isPending).toBe(false));

    // No new getSession calls -- second render hit the cache
    expect(getSession.mock.calls.length).toBe(callsAfterFirst);
    expect(r2.current.session.user.username).toBe("alice");
  });

  it("force-refresh bypasses the cache and calls getSession again", async () => {
    getSession.mockResolvedValue(AUTHED);

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isPending).toBe(false));

    const callsBefore = getSession.mock.calls.length;

    await act(async () => {
      await result.current.refreshSession(true);
    });

    expect(getSession.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

// ── Logout ─────────────────────────────────────────────────────────────────────

describe("useSession() -- logout", () => {
  it("clears session and calls authLogout", async () => {
    getSession.mockResolvedValue(AUTHED);
    logout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.session).toBeNull();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("auth:last_status")).toBe("logged_out");
  });
});

// ── Session normalisation ──────────────────────────────────────────────────────

describe("useSession() -- session normalisation", () => {
  it("handles nested session.user structure", async () => {
    getSession.mockResolvedValue({
      session: { authenticated: true, user: { id: 2, username: "bob" } },
    });

    const { result } = renderHook(() => useSession());
    await waitFor(() =>
      expect(sessionStorage.getItem("auth:last_status")).toBe("success"),
    );

    expect(result.current.session?.user?.username).toBe("bob");
  });

  it("handles account.user structure", async () => {
    getSession.mockResolvedValue({
      authenticated: true,
      account: { user: { id: 3, username: "carol" } },
    });

    const { result } = renderHook(() => useSession());
    await waitFor(() =>
      expect(sessionStorage.getItem("auth:last_status")).toBe("success"),
    );

    expect(result.current.session?.user?.username).toBe("carol");
  });
});
