/**
 * Tests for src/components/ProtectedRoute.jsx
 *
 * Covers:
 *  - Shows "Loading..." while isLoading is true
 *  - Renders AuthPage inline (at same URL) when not authenticated
 *  - Renders children when isAuthenticated is true
 *  - Does NOT show children when unauthenticated
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

jest.mock("../../src/context/AuthContext", () => ({
  useAuthContext: jest.fn(),
}));

// Mock AuthPage so ProtectedRoute tests stay isolated from AuthPage's deps
jest.mock("../../src/pages/AuthPage.jsx", () => ({
  __esModule: true,
  default: () => <div data-testid="auth-page">Auth Page</div>,
}));

import { useAuthContext } from "../../src/context/AuthContext";
import { ProtectedRoute } from "../../src/components/ProtectedRoute.jsx";

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderProtected({
  isAuthenticated = false,
  isLoading = false,
  initialPath = "/protected",
} = {}) {
  useAuthContext.mockReturnValue({ isAuthenticated, isLoading });

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
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProtectedRoute — loading state", () => {
  it("shows Loading... while isLoading is true", () => {
    renderProtected({ isLoading: true, isAuthenticated: false });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("does not render children while loading", () => {
    renderProtected({ isLoading: true, isAuthenticated: false });
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute — unauthenticated", () => {
  it("renders AuthPage inline when not authenticated", () => {
    renderProtected({ isLoading: false, isAuthenticated: false });
    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute — authenticated", () => {
  it("renders children when isAuthenticated is true", () => {
    renderProtected({ isLoading: false, isAuthenticated: true });
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByText("Secret Content")).toBeInTheDocument();
  });

  it("does NOT navigate to login when authenticated", () => {
    renderProtected({ isLoading: false, isAuthenticated: true });
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
