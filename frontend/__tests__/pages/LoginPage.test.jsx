/**
 * Integration tests for src/pages/LoginPage.jsx
 *
 * Covers:
 *  - Renders the login form when unauthenticated
 *  - Redirects to /home when already authenticated
 *  - Shows error banner when URL has ?error= param (OAuth failure)
 *  - Shows error banner from location.state.authStatus = "error"
 *  - Shows "logged out" info banner when sessionStorage has auth:last_status=logged_out
 *  - Shows session error banner when useSession returns an error
 *  - Schedules a forced refresh after 900 ms when unauthenticated (no oauthError)
 *  - No console.error during normal unauthenticated render
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ── Mock heavy child components ────────────────────────────────────────────────
jest.mock("../../src/components/ToxicBackground.jsx", () => ({
  __esModule: true,
  default: () => <div data-testid="frog-background" />,
}));

jest.mock("../../src/features/auth/components/LoginForm.jsx", () => ({
  __esModule: true,
  default: () => <div data-testid="login-form">Login Form</div>,
}));

// ── Mock useSession ────────────────────────────────────────────────────────────
jest.mock("../../src/hooks/useSession.js", () => ({
  useSession: jest.fn(),
}));

import { useSession } from "../../src/hooks/useSession.js";
import LoginPage from "../../src/pages/LoginPage.jsx";

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderLoginPage({
  session = null,
  isPending = false,
  error = null,
  search = "",
  state = undefined,
  lastStatus = null,
} = {}) {
  useSession.mockReturnValue({
    session,
    isPending,
    error,
    refreshSession: jest.fn().mockResolvedValue(null),
  });

  if (lastStatus) {
    sessionStorage.setItem("auth:last_status", lastStatus);
  } else {
    sessionStorage.removeItem("auth:last_status");
  }

  const path = `/login${search}`;

  return render(
    <MemoryRouter initialEntries={[{ pathname: "/login", search, state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<div data-testid="home-page">Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  sessionStorage.clear();
});

describe("LoginPage — unauthenticated render", () => {
  it("renders the login form when unauthenticated", () => {
    renderLoginPage({ isPending: false, session: null });
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });

  it("does not show any banner by default", () => {
    renderLoginPage({ isPending: false, session: null });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders without console.error", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    renderLoginPage({ isPending: false, session: null });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("LoginPage — authenticated redirect", () => {
  it("redirects to /home when session is present and not pending", async () => {
    renderLoginPage({
      isPending: false,
      session: { user: { id: 1, username: "alice" } },
    });

    await waitFor(() =>
      expect(screen.getByTestId("home-page")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("login-form")).not.toBeInTheDocument();
  });

  it("stays on login page while still pending", () => {
    renderLoginPage({ isPending: true, session: null });
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
    expect(screen.queryByTestId("home-page")).not.toBeInTheDocument();
  });
});

describe("LoginPage — OAuth error banner", () => {
  it("shows error banner when ?error= is in the URL", () => {
    renderLoginPage({ search: "?error=access_denied" });
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/access_denied/i);
  });

  it("shows error banner when ?auth_error= is in the URL", () => {
    renderLoginPage({ search: "?auth_error=token_expired" });
    const banner = screen.getByRole("status");
    expect(banner.textContent).toMatch(/token_expired/i);
  });
});

describe("LoginPage — location.state banner", () => {
  it('shows error banner from location.state.authStatus = "error"', () => {
    renderLoginPage({
      state: { authStatus: "error", authMessage: "You must sign in first." },
    });
    const banner = screen.getByRole("status");
    expect(banner.textContent).toMatch(/you must sign in first/i);
  });

  it("uses fallback message when authMessage is missing from state", () => {
    renderLoginPage({
      state: { authStatus: "error" },
    });
    const banner = screen.getByRole("status");
    expect(banner.textContent).toMatch(/authentication required/i);
  });
});

describe("LoginPage — session error banner", () => {
  it("shows error banner when useSession returns an error", () => {
    renderLoginPage({ error: new Error("Session check failed") });
    const banner = screen.getByRole("status");
    expect(banner.textContent).toMatch(/unable to verify session/i);
  });
});

describe("LoginPage — logged out banner", () => {
  it("shows info banner when sessionStorage has auth:last_status=logged_out", () => {
    renderLoginPage({ lastStatus: "logged_out" });
    const banner = screen.getByRole("status");
    expect(banner.textContent).toMatch(/logged out successfully/i);
  });
});

describe("LoginPage — forced refresh timer", () => {
  it("calls refreshSession after 900 ms when unauthenticated with no oauthError", async () => {
    const mockRefresh = jest.fn().mockResolvedValue(null);
    useSession.mockReturnValue({
      session: null,
      isPending: false,
      error: null,
      refreshSession: mockRefresh,
    });
    sessionStorage.removeItem("auth:last_status");

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mockRefresh).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    expect(mockRefresh).toHaveBeenCalledWith(true);
  });

  it("does NOT schedule refresh when oauthError is present", async () => {
    const mockRefresh = jest.fn().mockResolvedValue(null);
    useSession.mockReturnValue({
      session: null,
      isPending: false,
      error: null,
      refreshSession: mockRefresh,
    });

    render(
      <MemoryRouter initialEntries={["/login?error=access_denied"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("LoginPage — aria accessibility", () => {
  it('banner has role="status" and aria-live="polite"', () => {
    renderLoginPage({ search: "?error=test" });
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
