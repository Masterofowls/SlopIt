import React from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, SignInButton, useAuth } from "@clerk/clerk-react";
import "./Navigation.css";

const Navigation = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => navigate("/home")}>
          <h1>slop.it</h1>
        </div>

        <div>placeholder for search tab</div>

        <div className="nav-user">
          {isLoaded &&
            (isSignedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <SignInButton mode="modal">
                <button className="login-button">Login</button>
              </SignInButton>
            ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
