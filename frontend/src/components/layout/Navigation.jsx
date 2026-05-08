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
            <h1>slop.it</h1>
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
            <button
              className="nav-auth-close"
              onClick={() => setShowAuthModal(false)}
              aria-label="Close"
            >
              ✕
            </button>

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
