/**
 * Tests for src/pages/AuthPage.jsx
 *
 * AuthPage is a pure UI component — auth guards live in ProtectedRoute.
 *
 * Covers:
 *  - Renders the Clerk <SignIn> component
 *  - Renders the "or" divider
 *  - Renders the Telegram login button
 *  - Clicking Telegram button calls navigateToUrl with the OAuth URL
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

import { navigateToUrl } from '../../src/lib/navigate';
import AuthPage from '../../src/pages/AuthPage.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderAuthPage() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/home" element={<AuthPage />} />
        <Route path="/" element={<div data-testid="landing-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Render ─────────────────────────────────────────────────────────────────────

describe('AuthPage — render', () => {
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
