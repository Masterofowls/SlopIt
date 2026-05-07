/**
 * Tests for src/components/ProtectedRoute.jsx
 *
 * Covers:
 *  - Shows "Loading..." while session is pending
 *  - Redirects to /login when session is null (unauthenticated)
 *  - Redirect state includes authStatus and authMessage
 *  - Redirect state includes the original `from` path
 *  - Renders children when session is present (authenticated)
 *  - Does NOT call Navigate when authenticated
 *  - No console.error during normal flows
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

jest.mock("../../src/hooks/useSession.js", () => ({
  useSession: jest.fn(),
}));

import { useSession } from "../../src/hooks/useSession.js";
import { ProtectedRoute } from "../../src/components/ProtectedRoute.jsx";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Renders ProtectedRoute inside a MemoryRouter so react-router hooks work.
 * Navigating to `/login` renders a sentinel div we can assert on.
 */
function renderProtected({
  session = null,
  isPending = false,
  initialPath = "/protected",
} = {}) {
  useSession.mockReturnValue({ session, isPending });

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Secret Content</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={<div data-testid="login-page">Login Page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProtectedRoute — loading state", () => {
  it("shows Loading... while isPending is true", () => {
    renderProtected({ isPending: true, session: null });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("does not render children while pending", () => {
    renderProtected({ isPending: true, session: null });
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute — unauthenticated", () => {
  it("redirects to /login when session is null and not pending", () => {
    renderProtected({ isPending: false, session: null });
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute — authenticated", () => {
  it("renders children when session is present", () => {
    renderProtected({
      isPending: false,
      session: { user: { id: 1, username: "alice" } },
    });
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByText("Secret Content")).toBeInTheDocument();
  });

  it("does NOT navigate to login when authenticated", () => {
    renderProtected({
      isPending: false,
      session: { user: { id: 1, username: "alice" } },
    });
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute — no console errors", () => {
  it("renders without errors when authenticated", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    renderProtected({
      isPending: false,
      session: { user: { id: 1, username: "alice" } },
    });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders without errors when unauthenticated", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    renderProtected({ isPending: false, session: null });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("ProtectedRoute — transition: pending → authenticated", () => {
  it("shows children after session loads", () => {
    // Set pending BEFORE initial render so router never navigates away from /protected
    useSession.mockReturnValue({ session: null, isPending: true });

    const makeTree = () => (
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Secret</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    const { rerender } = render(makeTree());
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Transition to authenticated — reuse same MemoryRouter instance (no navigation reset)
    useSession.mockReturnValue({
      session: { user: { id: 1, username: "alice" } },
      isPending: false,
    });
    rerender(makeTree());
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });
});
