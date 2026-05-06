import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession.js";
import Button from "../components/ui/Button";
import ToxicBackground from "../components/ToxicBackground.jsx";
import WindowCard from "../components/ui/WindowCard.jsx"; // Import the new component
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { session, isPending } = useSession();
  const randomSubtitles = [
    "you're a pleb",
    "slopit or dropit",
    "the",
    "6767676767676767",
    "i guess we really are... slopit",
    "t-thank you... slop it...",
    "you dont deserve good things",
    "come get your slop lmao",
    "look upon me, ye mighty",
    "#freeXXXtentacion",
    "first slopcoded website",
    "man oh man am I hungry",
    "kuplinov games",
    "click here to download sexy minecraft Luna skin",
    "frogjuice",
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
            <h1 className="landing-title">welcome to slop.it</h1>
            <p className="landing-subtitle">{randomSubtitle}</p>
          </div>

          <div className="landing-features">
            <WindowCard
              title="sys_action.exe"
              icon=":3"
              heading="eat endless supply of slop"
              text="we don't care when it was posted, consume it like the pleb you are"
            />
            <WindowCard
              title="connect_share.dat"
              icon=">->"
              heading="post your own stuff"
              text="basically ur either like the piggy or the guy who feeds the piggies"
            />
            <WindowCard
              title="time_travel.sys"
              icon=":0"
              heading="reuse old content"
              text="making new stuff is hard and noone does it anyways"
            />
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
