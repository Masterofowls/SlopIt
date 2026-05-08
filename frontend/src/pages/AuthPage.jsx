import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn } from "@clerk/clerk-react";
import ToxicBackground from "../components/ToxicBackground.jsx";
import { useAuthContext } from "../context/AuthContext";
import { navigateToUrl } from "../lib/navigate";
import "./AuthPage.css";

const API_URL = import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev";

const AuthPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthContext();

  // Already signed in (Clerk or Telegram) — skip straight to feed
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/home", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  function handleTelegramLogin() {
    navigateToUrl(`${API_URL}/accounts/telegram/login/`);
  }

  if (isLoading) {
    return (
      <div className="auth-page">
        <ToxicBackground />
        <div className="auth-page-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <ToxicBackground />

      <div className="auth-page-container">
        <div className="auth-page-header">
          <button
            className="auth-page-back"
            onClick={() => navigate("/")}
            aria-label="Back to home"
          >
            ← back
          </button>
          <h1 className="auth-page-title">SlopIt</h1>
        </div>

        <div className="auth-page-card">
          <SignIn
            routing="hash"
            afterSignInUrl="/home"
            afterSignUpUrl="/home"
            appearance={{
              variables: {
                colorPrimary: "#00ff00",
                colorBackground: "#001400",
                colorText: "#00ff00",
                colorTextSecondary: "#00cc00",
                colorInputBackground: "#002200",
                colorInputText: "#00ff00",
                colorNeutral: "#00aa00",
                borderRadius: "4px",
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: "14px",
              },
              elements: {
                card: "slop-clerk-card",
                headerTitle: "slop-clerk-title",
                headerSubtitle: "slop-clerk-subtitle",
                socialButtonsBlockButton: "slop-clerk-social-btn",
                formButtonPrimary: "slop-clerk-submit-btn",
                footerActionLink: "slop-clerk-footer-link",
                formFieldInput: "slop-clerk-input",
                dividerLine: "slop-clerk-divider",
                dividerText: "slop-clerk-divider-text",
              },
            }}
          />

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button
            className="auth-telegram-btn"
            onClick={handleTelegramLogin}
            type="button"
          >
            <svg
              className="auth-telegram-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Continue with Telegram
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
