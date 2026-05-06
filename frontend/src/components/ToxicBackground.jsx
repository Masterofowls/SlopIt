import React, { useEffect, useState } from "react";
import "./ToxicBackground.css";

const ToxicBackground = () => {
  const [bubbles, setBubbles] = useState([]);

  useEffect(() => {
    const createBubble = () => {
      const newBubble = {
        id: Date.now() + Math.random(),
        size: Math.random() * 20 + 10,
        left: Math.random() * 100,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 2,
      };

      setBubbles((prevBubbles) => [...prevBubbles, newBubble]);

      setTimeout(
        () => {
          setBubbles((prevBubbles) =>
            prevBubbles.filter((b) => b.id !== newBubble.id),
          );
        },
        (newBubble.duration + newBubble.delay) * 1000,
      );
    };

    for (let i = 0; i < 10; i++) {
      setTimeout(createBubble, i * 300);
    }

    const intervalId = setInterval(createBubble, 800);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="toxic">
      <div className="bubbles">
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="bubble"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              left: `${bubble.left}%`,
              animationDuration: `${bubble.duration}s`,
              animationDelay: `${bubble.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="wave-container">
        <svg
          className="wave-svg"
          viewBox="0 24 150 28"
          preserveAspectRatio="none"
        >
          <defs>
            <path
              id="gentle-wave"
              d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"
            />
          </defs>
          <g className="wave-path">
            <use
              xlinkHref="#gentle-wave"
              x="48"
              y="0"
              fill="rgba(0, 255, 106, 0.7)"
            />
            <use
              xlinkHref="#gentle-wave"
              x="48"
              y="3"
              fill="rgba(0, 255, 106, 0.5)"
            />
            <use
              xlinkHref="#gentle-wave"
              x="48"
              y="5"
              fill="rgba(0, 255, 106, 0.3)"
            />
            <use
              xlinkHref="#gentle-wave"
              x="48"
              y="7"
              fill="rgba(64, 255, 0, 1)"
            />
          </g>
        </svg>
        <svg
          className="wave-svg wave-svg-2"
          viewBox="0 24 150 28"
          preserveAspectRatio="none"
        >
          <defs>
            <path
              id="gentle-wave"
              d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"
            />
          </defs>
          <g className="wave-path wave-path-2">
            <use
              xlinkHref="#gentle-wave"
              x="48"
              y="0"
              fill="rgba(0, 255, 106, 0.7)"
            />
            <use
              xlinkHref="#gentle-wave"
              x="48"
              y="3"
              fill="rgba(0, 255, 106, 0.5)"
            />
            <use
              xlinkHref="#gentle-wave"
              x="48"
              y="5"
              fill="rgba(0, 255, 106, 0.3)"
            />
            <use
              xlinkHref="#gentle-wave"
              x="48"
              y="7"
              fill="rgba(64, 255, 0, 1)"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default ToxicBackground;
