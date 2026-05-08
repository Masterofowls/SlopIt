import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";
import Button from "../components/ui/Button";
import ToxicBackground from "../components/ToxicBackground.jsx";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthContext();
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
    "#freeXXXtentacion",
    "first slopcoded website",
    "man oh man am I hungry",
    "Also try Minecraft!",
    "Or maybe Terraria?",
    "Hello sloprld",
    "ThIs MeSsAgE aPpEaRs WiTh A 4.35% cHaNcE!",
    "Gloomy gloppy glopster",
    "S10p1t",
    "СлопИт",
    "...",
    "Who cares about the slop?",
    "Fluffy slop",
    "Black humor!",
    "PARENTAL ADVISORY: explicit content",
    "Slop it, slop it, slop it, slop it",
    "wwwwwwwwwwwwww",
    "W slop",
    "epilepsy warning as you can see",
    "Just slop it!",
    "Some posts may lead to nuclear war!",
    "100% sugar free",
    "Ai is guilty",
    "Sleepy",
    "Straight to the slop",
    "Bon appétit!",
    "IM RGB!",
    "Slop 2 soon",
    "CRIME SCENE * DO NOT ENTER",
    "Caution wet web",
    "Mind your posts",
    "Boo!",
    "Warning! Thanks for the warning!",
    "This message is blocked in your country",
    "Your ad could have been here",
    "Memes",
    "Give me money",
    "Congrats! You found the easter egg!",
    "To the Earth!",
    "Wow",
    "since 2026",
    "Post something",
    "Afk",
    "404 slop not found",
    "Real",
    "Your connection is unstable or am i trippin?",
  ];

  // Calculate random index ONCE when component function runs
  const [randomSubtitle] = useState(() => {
    const randomIndex = Math.floor(Math.random() * randomSubtitles.length);
    return randomSubtitles[randomIndex];
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/home", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
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
              className="landing-button"
              onClick={() => navigate("/home")}
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
