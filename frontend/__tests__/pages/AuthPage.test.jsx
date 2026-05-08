/**
 * Tests for src/pages/AuthPage.jsx
 *
 * Covers:
 *  - Shows loading state (ToxicBackground + "Loading...") while isLoading=true
 *  - Does NOT render Clerk SignIn while loading
 *  - Redirects to /home when already authenticated
 *  - Renders the Clerk <SignIn> component when unauthenticated
 *  - Renders the "or" divider
 *  - Renders the Telegram login button
 *  - Clicking Telegram button sets window.location.href to the OAuth URL
 *  - Back button renders and navigates to /
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

jest.mock('../../src/components/ToxicBackground.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="toxic-bg" />,
}));

jest.mock('@clerk/clerk-react', () => ({
  SignIn: () => <div data-testid="clerk-sign-in">Clerk SignIn</div>,
}));

jest.mock('../../src/lib/navigate', () => ({
  navigateToUrl: jest.fn(),
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuthContext: jest.fn(),
}));

import { useAuthContext } from '../../src/context/AuthContext';
import { navigateToUrl } from '../../src/lib/navigate';
import AuthPage from '../../src/pages/AuthPage.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderAuthPage({ isAuthenticated = false, isLoading = false } = {}) {
  useAuthContext.mockReturnValue({ isAuthenticated, isLoading });
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/login/*" element={<AuthPage />} />
        <Route path="/home" element={<div data-testid="home-page" />} />
        <Route path="/" element={<div data-testid="landing-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Loading state ──────────────────────────────────────────────────────────────

describe('AuthPage — loading state', () => {
  it('shows "Loading..." text while isLoading is true', () => {
    renderAuthPage({ isLoading: true });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders ToxicBackground while loading', () => {
    renderAuthPage({ isLoading: true });
    expect(screen.getByTestId('toxic-bg')).toBeInTheDocument();
  });

  it('does NOT render the Clerk SignIn component while loading', () => {
    renderAuthPage({ isLoading: true });
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });

  it('does NOT render the Telegram button while loading', () => {
    renderAuthPage({ isLoading: true });
    expect(
      screen.queryByRole('button', { name: /telegram/i }),
    ).not.toBeInTheDocument();
  });
});

// ── Already authenticated ──────────────────────────────────────────────────────

describe('AuthPage — already authenticated', () => {
  it('redirects to /home when isAuthenticated is true', () => {
    renderAuthPage({ isAuthenticated: true, isLoading: false });
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('does not render the auth card when authenticated', () => {
    renderAuthPage({ isAuthenticated: true, isLoading: false });
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });
});

// ── Unauthenticated render ─────────────────────────────────────────────────────

describe('AuthPage — unauthenticated', () => {
  it('renders the Clerk SignIn component', () => {
    renderAuthPage();
    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
  });

  it('renders the "or" divider between Clerk and Telegram', () => {
    renderAuthPage();
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('renders the "Continue with Telegram" button', () => {
    renderAuthPage();
    expect(
      screen.getByRole('button', { name: /continue with telegram/i }),
    ).toBeInTheDocument();
  });

  it('renders the back button', () => {
    renderAuthPage();
    expect(
      screen.getByRole('button', { name: /back/i }),
    ).toBeInTheDocument();
  });

  it('clicking back button navigates to /', () => {
    renderAuthPage();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });
});

// ── Telegram button ────────────────────────────────────────────────────────────

describe('AuthPage — Telegram login', () => {
  it('clicking Telegram button calls navigateToUrl with the Telegram OAuth URL', () => {
    renderAuthPage();
    fireEvent.click(screen.getByRole('button', { name: /continue with telegram/i }));
    expect(navigateToUrl).toHaveBeenCalledTimes(1);
    expect(navigateToUrl.mock.calls[0][0]).toMatch(/\/accounts\/telegram\/login\//);
  });

  it('Telegram OAuth URL contains the configured API base URL', () => {
    renderAuthPage();
    fireEvent.click(screen.getByRole('button', { name: /continue with telegram/i }));
    expect(navigateToUrl.mock.calls[0][0]).toContain('slopit-api.fly.dev');
  });
});
