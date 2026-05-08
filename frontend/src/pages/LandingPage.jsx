import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, SignInButton } from "@clerk/clerk-react";
import Button from "../components/ui/Button";
import ToxicBackground from "../components/ToxicBackground.jsx";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
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
    "also try Minecraft",
    "or maybe Terraria",
    "hello sloprld",
    "'thIs MeSsAgE aPpEaRs WiTh A 4.35% cHaNcE'",
    "gloomy gloppy glopster",
    "s10p1t",
    "слопИт",
    "...",
    "who cares about the slop",
    "fluffy slop",
    "black humor",
    "PARENTAL ADVISORY: explicit content",
    "slop it, slop it, slop it, slop it",
    "wwwwwwwwwwwwww",
    "w slop",
    "epilepsy warning as you can see",
    "just slop it!",
    "some posts may lead to nuclear war!",
    "100% sugar free",
    "ai is guilty",
    "sleepy",
    "straight to the slop",
    "bon appétit",
    "IM RGB",
    "slop 2 soon",
    "CRIME SCENE * DO NOT ENTER",
    "caution wet web",
    "mind your posts",
    "boo",
    "warning... thanks for the warning",
    "this message is blocked in your country",
    "your ad could be here",
    "memes",
    "give me money",
    "congrats! you found an easter egg",
    "to the Earth",
    "wow",
    "since 2026",
    "post something",
    "afk",
    "404 slop not found",
    "real",
    "your connection is unstable or am i trippin",
  ];

  // Calculate random index ONCE when component function runs
  const [randomSubtitle] = useState(() => {
    const randomIndex = Math.floor(Math.random() * randomSubtitles.length);
    return randomSubtitles[randomIndex];
  });

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/home", { replace: true });
    }
  }, [isSignedIn, isLoaded, navigate]);

  if (!isLoaded) {
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
            <SignInButton mode="redirect" redirectUrl="/home">
              <Button variant="primary" size="large" className="landing-button">
                Get Started
              </Button>
            </SignInButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
