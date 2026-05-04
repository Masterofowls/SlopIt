import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession.js";
import Button from "../components/ui/Button";
import FrogBackground from "../components/FrogBackground";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) {
      navigate("/home", { replace: true });
    }
  }, [session, isPending, navigate]);

  if (isPending) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="landing-page">
      <FrogBackground />
      <div className="landing-container">
        <div className="landing-content">
          <div className="landing-header">
            <h1 className="landing-title">Welcome to SlopIt</h1>
            <p className="landing-subtitle">
              It doesn't matter when it was posted, it's now right here, for
              you.
            </p>
          </div>

          <div className="landing-features">
            <div className="feature-card">
              <div className="feature-icon">🐸</div>
              <h3>Jump Into Action</h3>
              <p>
                Explore a world of possibilities with our intuitive platform
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Connect & Share</h3>
              <p>Share your thoughts and connect with like-minded people</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏱️</div>
              <h3>Travel through time...</h3>
              <p>Who knows where you might end up!</p>
            </div>
          </div>

          <div className="landing-actions">
            <Button
              variant="primary"
              size="large"
              onClick={() => navigate("/login")}
              className="landing-button"
            >
              Get Started
            </Button>
            <Button
              variant="outline"
              size="large"
              onClick={() => navigate("/signup")}
              className="landing-button"
            >
              Create Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
