/**
 * Tests for src/context/AuthContext.jsx
 *
 * Covers:
 *  - Clerk signed in  → provider='clerk', isAuthenticated=true, no Telegram call
 *  - Clerk not loaded → isLoading=true
 *  - Clerk loaded, not signed in, Telegram session found → provider='telegram'
 *  - Clerk loaded, not signed in, no Telegram session   → provider=null
 *  - Session API error → graceful null, no crash
 *  - logout() with Clerk    → calls clerkSignOut, does NOT call api.post
 *  - logout() with Telegram → calls api.post('/auth/logout/'), clears telegramUser
 *  - logout() swallows API errors (Telegram path)
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('@clerk/clerk-react', () => ({
  useUser: jest.fn(),
  useClerk: jest.fn(),
}));

jest.mock('../../src/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { useUser, useClerk } from '@clerk/clerk-react';
import { api } from '../../src/lib/api';
import { AuthProvider, useAuthContext } from '../../src/context/AuthContext';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TELEGRAM_SESSION = {
  authenticated: true,
  user: {
    id: 42,
    username: 'tg_user',
    email: 'tg@example.com',
    first_name: 'Telegram',
    last_name: 'User',
    avatar_url: null,
  },
};

const NO_SESSION = { authenticated: false, user: null };

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
  return ({ children }) => <AuthProvider>{children}</AuthProvider>;
}

function renderAuth() {
  return renderHook(() => useAuthContext(), { wrapper: makeWrapper() });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Clerk signed in ────────────────────────────────────────────────────────────

describe('AuthContext — Clerk signed in', () => {
  beforeEach(() => {
    useUser.mockReturnValue({ isSignedIn: true, isLoaded: true });
    useClerk.mockReturnValue({ signOut: jest.fn() });
  });

  it("sets provider to 'clerk'", async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.provider).toBe('clerk');
  });

  it('isAuthenticated is true', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('does NOT call the Telegram session endpoint', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.get).not.toHaveBeenCalled();
  });

  it('telegramUser is null', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.telegramUser).toBeNull();
  });
});

// ── Clerk loading ──────────────────────────────────────────────────────────────

describe('AuthContext — Clerk still loading', () => {
  it('isLoading is true while clerkLoaded is false', () => {
    useUser.mockReturnValue({ isSignedIn: false, isLoaded: false });
    useClerk.mockReturnValue({ signOut: jest.fn() });

    const { result } = renderAuth();
    expect(result.current.isLoading).toBe(true);
  });

  it('isAuthenticated is false while loading', () => {
    useUser.mockReturnValue({ isSignedIn: false, isLoaded: false });
    useClerk.mockReturnValue({ signOut: jest.fn() });

    const { result } = renderAuth();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ── Telegram session active ────────────────────────────────────────────────────

describe('AuthContext — Telegram session active', () => {
  beforeEach(() => {
    useUser.mockReturnValue({ isSignedIn: false, isLoaded: true });
    useClerk.mockReturnValue({ signOut: jest.fn() });
    api.get.mockResolvedValue({ data: TELEGRAM_SESSION });
  });

  it("sets provider to 'telegram'", async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.provider).toBe('telegram');
  });

  it('isAuthenticated is true', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('populates telegramUser with mapped fields', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.telegramUser).not.toBeNull());
    expect(result.current.telegramUser).toEqual({
      id: 42,
      username: 'tg_user',
      email: 'tg@example.com',
      firstName: 'Telegram',
      lastName: 'User',
      avatarUrl: null,
    });
  });

  it("calls GET '/auth/session/'", async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.get).toHaveBeenCalledWith('/auth/session/');
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

// ── No session ─────────────────────────────────────────────────────────────────

describe('AuthContext — no session (Clerk or Telegram)', () => {
  beforeEach(() => {
    useUser.mockReturnValue({ isSignedIn: false, isLoaded: true });
    useClerk.mockReturnValue({ signOut: jest.fn() });
    api.get.mockResolvedValue({ data: NO_SESSION });
  });

  it('provider is null', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.provider).toBeNull();
  });

  it('isAuthenticated is false', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('telegramUser stays null', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.telegramUser).toBeNull();
  });
});

// ── Session API error ──────────────────────────────────────────────────────────

describe('AuthContext — session API error', () => {
  beforeEach(() => {
    useUser.mockReturnValue({ isSignedIn: false, isLoaded: true });
    useClerk.mockReturnValue({ signOut: jest.fn() });
    api.get.mockRejectedValue(new Error('Network error'));
  });

  it('provider stays null — does not crash', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.provider).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('telegramUser stays null on error', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.telegramUser).toBeNull();
  });
});

// ── logout ─────────────────────────────────────────────────────────────────────

describe('AuthContext — logout()', () => {
  it('calls clerkSignOut when provider is clerk', async () => {
    const mockSignOut = jest.fn().mockResolvedValue(undefined);
    useUser.mockReturnValue({ isSignedIn: true, isLoaded: true });
    useClerk.mockReturnValue({ signOut: mockSignOut });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("calls api.post '/auth/logout/' and clears telegramUser", async () => {
    useUser.mockReturnValue({ isSignedIn: false, isLoaded: true });
    useClerk.mockReturnValue({ signOut: jest.fn() });
    api.get.mockResolvedValue({ data: TELEGRAM_SESSION });
    api.post.mockResolvedValue({});

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.telegramUser).not.toBeNull());

    await act(async () => {
      await result.current.logout();
    });

    expect(api.post).toHaveBeenCalledWith('/auth/logout/');
    expect(result.current.telegramUser).toBeNull();
    expect(result.current.provider).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('clears telegramUser even when api.post throws', async () => {
    useUser.mockReturnValue({ isSignedIn: false, isLoaded: true });
    useClerk.mockReturnValue({ signOut: jest.fn() });
    api.get.mockResolvedValue({ data: TELEGRAM_SESSION });
    api.post.mockRejectedValue(new Error('Network error'));

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.telegramUser).not.toBeNull());

    // Must not throw
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.telegramUser).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
