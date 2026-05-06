import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession.js";
import Button from "../components/ui/Button";
import ToxicBackground from "../components/ToxicBackground.jsx";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { session, isPending } = useSession();
  const randomSubtitles = [
    "you're a pleb",
    "slopit or dropit",
    "the",
    "67676767676767676",
    "i guess we really are... slopit",
    "t-thank you... slop it...",
    "you dont deserve good things",
    "come get your slop lmao",
    "look upon me, ye mighty",
    "#freeXXXtentacionXXX",
    "first slopcoded website",
    "man oh man am I hungry",
  ];

  // Calculate random index ONCE when component function runs
  const [randomSubtitle] = useState(() => {
    const randomIndex = Math.floor(Math.random() * randomSubtitles.length);
    return randomSubtitles[randomIndex];
  });

  useEffect(() => {
    if (!isPending && session) {
      console.info("[auth] LandingPage:session-present-redirect-home", {
        username: session?.user?.username,
      });
      navigate("/home", { replace: true });
    }
  }, [session, isPending, navigate]);

  if (isPending) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="landing-page">
      <ToxicBackground />
      <div className="landing-container">
        <div className="landing-content">
          <div className="landing-header">
            <h1 className="landing-title">Welcome to SlopIt</h1>
            <p className="landing-subtitle">{randomSubtitle}</p>
          </div>

          <div className="landing-features">
            <div className="window-card">
              <div className="window-header">
                <div className="window-controls">
                  <div className="window-btn close"></div>
                  <div className="window-btn min"></div>
                  <div className="window-btn max"></div>
                </div>
                <div className="window-title">sys_action.exe</div>
              </div>
              <div className="window-body">
                <div className="feature-icon">:3</div>
                <h3>eat endless supply of slop</h3>
                <p>
                  we don't care when it was posted, consume it like the pleb you
                  are
                </p>
              </div>
            </div>

            <div className="window-card">
              <div className="window-header">
                <div className="window-controls">
                  <div className="window-btn close"></div>
                  <div className="window-btn min"></div>
                  <div className="window-btn max"></div>
                </div>
                <div className="window-title">connect_share.dat</div>
              </div>
              <div className="window-body">
                <div className="feature-icon">{">->"}</div>
                <h3>post your own stuff</h3>
                <p>
                  basically ur either like the piggy or the guy who feeds the
                  piggies
                </p>
              </div>
            </div>

            <div className="window-card">
              <div className="window-header">
                <div className="window-controls">
                  <div className="window-btn close"></div>
                  <div className="window-btn min"></div>
                  <div className="window-btn max"></div>
                </div>
                <div className="window-title">time_travel.sys</div>
              </div>
              <div className="window-body">
                <div className="feature-icon">:0</div>
                <h3>reuse old content</h3>
                <p>making new stuff is hard and noone does it anyways</p>
              </div>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
