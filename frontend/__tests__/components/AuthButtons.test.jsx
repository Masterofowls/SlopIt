/**
 * Tests for src/components/auth/auth_buttons.jsx
 *
 * Covers:
 *  - Shows loading state while fetching providers
 *  - Shows "No auth providers" message when list is empty
 *  - Renders a button per provider
 *  - Clicking a provider button triggers loginWithProvider
 *  - Provider icons/labels render for known providers (github, google, telegram)
 *  - Unknown provider falls back gracefully
 *  - No console.error during normal render
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("../../src/api/auth.js", () => ({
  getProviders: jest.fn(),
  loginWithProvider: jest.fn(),
}));

import { getProviders, loginWithProvider } from "../../src/api/auth.js";
import AuthButtons from "../../src/components/auth/auth_buttons.jsx";

const PROVIDERS = [
  { id: "github", name: "GitHub", login_url: "/accounts/github/login/" },
  { id: "google", name: "Google", login_url: "/accounts/google/login/" },
  { id: "telegram", name: "Telegram", login_url: "/accounts/telegram/login/" },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AuthButtons — loading state", () => {
  it("shows loading spinner while providers are being fetched", () => {
    getProviders.mockReturnValue(new Promise(() => {})); // never resolves

    render(<AuthButtons />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

describe("AuthButtons — empty providers", () => {
  it('shows "No auth providers configured" when provider list is empty', async () => {
    getProviders.mockResolvedValue([]);

    render(<AuthButtons />);
    await waitFor(() =>
      expect(
        screen.getByText(/no auth providers configured/i),
      ).toBeInTheDocument(),
    );
  });
});

describe("AuthButtons — provider buttons", () => {
  it("renders one button per provider", async () => {
    getProviders.mockResolvedValue(PROVIDERS);

    render(<AuthButtons />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /github/i }),
      ).toBeInTheDocument(),
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it('renders "Continue with GitHub" label', async () => {
    getProviders.mockResolvedValue([PROVIDERS[0]]);

    render(<AuthButtons />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /continue with github/i }),
      ).toBeInTheDocument(),
    );
  });

  it('renders "Continue with Google" label', async () => {
    getProviders.mockResolvedValue([PROVIDERS[1]]);

    render(<AuthButtons />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /continue with google/i }),
      ).toBeInTheDocument(),
    );
  });

  it('renders "Continue with Telegram" label', async () => {
    getProviders.mockResolvedValue([PROVIDERS[2]]);

    render(<AuthButtons />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /continue with telegram/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders unknown provider with fallback styling", async () => {
    getProviders.mockResolvedValue([
      {
        id: "custom-sso",
        name: "Custom SSO",
        login_url: "/accounts/custom-sso/login/",
      },
    ]);

    render(<AuthButtons />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /continue with custom sso/i }),
      ).toBeInTheDocument(),
    );
  });
});

describe("AuthButtons — click behaviour", () => {
  it("calls loginWithProvider with correct providerId and login_url on click", async () => {
    getProviders.mockResolvedValue([PROVIDERS[0]]);

    render(<AuthButtons />);
    const btn = await screen.findByRole("button", {
      name: /continue with github/i,
    });

    fireEvent.click(btn);

    expect(loginWithProvider).toHaveBeenCalledTimes(1);
    expect(loginWithProvider).toHaveBeenCalledWith(
      "github",
      "/accounts/github/login/",
    );
  });

  it("calls loginWithProvider independently for each provider", async () => {
    getProviders.mockResolvedValue(PROVIDERS);

    render(<AuthButtons />);
    await screen.findByRole("button", { name: /continue with github/i });

    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(loginWithProvider).toHaveBeenCalledWith(
      "google",
      "/accounts/google/login/",
    );
    expect(loginWithProvider).toHaveBeenCalledTimes(1);
  });
});

describe("AuthButtons — no console errors", () => {
  it("renders without any console.error during normal operation", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    getProviders.mockResolvedValue(PROVIDERS);

    render(<AuthButtons />);
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(3));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
