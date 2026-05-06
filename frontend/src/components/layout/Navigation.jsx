import React from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../hooks/useSession.js";
import "./Navigation.css";

const Navigation = () => {
  const navigate = useNavigate();
  const { session, logout } = useSession();

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => navigate("/home")}>
          <h1>slop.it</h1>
        </div>

        <div>placeholder for search tab</div>

        <div className="nav-user">
          {session?.user ? (
            <>
              <div className="user-info" onClick={handleProfileClick}>
                <img src="/frog.png" alt="Profile" className="user-avatar" />
                <span className="username">{session.user.username}</span>
              </div>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </>
          ) : (
            <button onClick={() => navigate("/login")} className="login-button">
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
