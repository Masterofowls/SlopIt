import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, SignIn } from "@clerk/clerk-react";
import { useAuthContext } from "../../context/AuthContext";
import "./Navigation.css";

const Navigation = () => {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const { isAuthenticated, isLoading, authLogs, logout } = useAuthContext();

  // Close the modal as soon as auth succeeds (handles the case where we're
  // already on /home so afterSignInUrl navigation is a no-op).
  React.useEffect(() => {
    if (isAuthenticated) setShowAuthModal(false);
  }, [isAuthenticated]);

  function renderUserArea() {
    if (isLoading) return null;
    if (!isAuthenticated) {
      return (
        <button className="login-button" onClick={() => setShowAuthModal(true)}>
          Login
        </button>
      );
    }
    return <UserButton afterSignOutUrl="/" />;
  }

  return (
    <>
      <nav className="navigation">
        <div className="nav-container">
          <div className="nav-brand" onClick={() => navigate("/home")}>
            <h1>slopit</h1>
          </div>

          <div>placeholder for search tab</div>

          <div className="nav-user">{renderUserArea()}</div>
        </div>
      </nav>

      {showAuthModal && (
        <div
          className="nav-auth-overlay"
          onClick={() => setShowAuthModal(false)}
        >
          <div className="nav-auth-modal" onClick={(e) => e.stopPropagation()}>
            <SignIn
              routing="virtual"
              fallbackRedirectUrl="/home"
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
                  rootBox: "nav-clerk-root",
                },
              }}
            />
            {/*
            <div className="nav-auth-divider">
              <span>or</span>
            </div> */}

            {/* <button
              className="nav-telegram-btn"
              onClick={handleTelegramLogin}
              type="button"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{ width: 20, height: 20, flexShrink: 0 }}
              >
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Continue with Telegram
            </button> */}
            <button
              className="nav-auth-close"
              onClick={() => setShowAuthModal(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Auth Debug Panel ── */}
      <div
        className="auth-debug-toggle"
        onClick={() => setShowDebug((v) => !v)}
      >
        🔍 auth
      </div>
      {showDebug && (
        <div className="auth-debug-panel">
          <div className="auth-debug-state">
            <strong>isLoading:</strong> {String(isLoading)} &nbsp;
            <strong>isAuthenticated:</strong> {String(isAuthenticated)} &nbsp;
          </div>
          <div className="auth-debug-logs">
            {(authLogs ?? []).length === 0 && (
              <div className="auth-debug-entry">No logs yet.</div>
            )}
            {(authLogs ?? []).map((log, i) => (
              <div key={i} className="auth-debug-entry">
                <span className="auth-debug-time">{log.t}</span>{" "}
                <span>{log.msg}</span>
                {log.data && <pre className="auth-debug-data">{log.data}</pre>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
