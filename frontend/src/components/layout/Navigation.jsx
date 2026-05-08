import React from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, SignInButton } from "@clerk/clerk-react";
import { useAuthContext } from "../../context/AuthContext";
import "./Navigation.css";

const Navigation = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, provider, telegramUser, logout } =
    useAuthContext();

  function renderUserArea() {
    if (isLoading) return null;
    if (!isAuthenticated) {
      return (
        <SignInButton mode="modal">
          <button className="login-button">Login</button>
        </SignInButton>
      );
    }
    if (provider === "clerk") {
      return <UserButton afterSignOutUrl="/" />;
    }
    // Telegram session
    return (
      <div className="nav-telegram-user">
        <span className="nav-telegram-name">
          {telegramUser?.firstName || telegramUser?.username || "User"}
        </span>
        <button className="logout-button" onClick={logout}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => navigate("/home")}>
          <h1>slop.it</h1>
        </div>

        <div>placeholder for search tab</div>

        <div className="nav-user">{renderUserArea()}</div>
      </div>
    </nav>
  );
};

export default Navigation;
