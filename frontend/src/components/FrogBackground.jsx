import React, { useEffect, useRef } from "react";
import "./FrogBackground.css";

const FrogBackground = () => {
  return (
    <div className="video-container">
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="../../public/frog/frog.png"
        className="background-video"
      >
        <source
          src="../../public/moving-car-at-starry-night.1920x1080.mp4"
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default FrogBackground;
