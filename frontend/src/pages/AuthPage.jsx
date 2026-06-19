import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignIn } from "@clerk/clerk-react";
import ToxicBackground from "../components/ToxicBackground.jsx";
import { navigateToUrl } from "../lib/navigate";
import { api } from "../lib/api";
import { useAuthContext } from "../context/AuthContext";
import "./AuthPage.css";

const API_URL = import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev";

function formatApiError(err) {
  const data = err?.response?.data;
  if (!data) return err?.message || "Something went wrong.";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data)) return data.join(" ");
  const parts = [];
  for (const [key, value] of Object.entries(data)) {
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    parts.push(key === "detail" ? text : `${key}: ${text}`);
  }
  return parts.join(" ") || "Something went wrong.";
}

const AuthPage = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuthContext();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleTelegramLogin() {
    navigateToUrl(`${API_URL}/accounts/telegram/login/`);
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.get("/auth/csrf/");
      const path = mode === "register" ? "/auth/register/" : "/auth/login/";
      const payload =
        mode === "register"
          ? {
              name: name.trim(),
              password,
              ...(email.trim() ? { email: email.trim() } : {}),
              ...(username.trim() ? { username: username.trim() } : {}),
            }
          : { login: login.trim(), password };
      await api.post(path, payload);
      await refreshSession();
      navigate("/home");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
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
          <div className="auth-password-panel">
            <div className="auth-password-tabs">
              <button
                type="button"
                className={
                  mode === "login" ? "auth-password-tab active" : "auth-password-tab"
                }
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={
                  mode === "register"
                    ? "auth-password-tab active"
                    : "auth-password-tab"
                }
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create account
              </button>
            </div>

            <form className="auth-password-form" onSubmit={handlePasswordSubmit}>
              {mode === "register" && (
                <>
                  <label className="auth-password-field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                      maxLength={100}
                      placeholder="Your display name"
                    />
                  </label>

                  <label className="auth-password-field">
                    <span>Username (optional)</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      maxLength={150}
                      placeholder="Pick a login name"
                    />
                  </label>

                  <label className="auth-password-field">
                    <span>Email (optional)</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </label>
                </>
              )}

              {mode === "login" && (
                <label className="auth-password-field">
                  <span>Username or email</span>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    autoComplete="username"
                    required
                    placeholder="username or you@example.com"
                  />
                </label>
              )}

              <label className="auth-password-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                />
              </label>

              {error ? <p className="auth-password-error">{error}</p> : null}

              <button
                type="submit"
                className="auth-password-submit"
                disabled={submitting}
              >
                {submitting
                  ? "Please wait…"
                  : mode === "register"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          </div>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

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
