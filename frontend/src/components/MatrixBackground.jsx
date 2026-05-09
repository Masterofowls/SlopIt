import React, { useEffect, useRef } from "react";
import "./MatrixBackground.css";

const MatrixBackground = () => {
  const canvasRef = useRef(null);

  // Subtle CRT noise animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    let animationId;
    let lastTimestamp = 0;

    const drawSubtleNoise = (timestamp) => {
      if (!ctx || !canvas) return;

      // Update noise every 5 frames (slower = more subtle)
      if (timestamp - lastTimestamp > 100) {
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const noise = Math.random() * 20; // Lower intensity
          data[i] = noise * 0.5; // R
          data[i + 1] = noise * 1.2; // G (more green)
          data[i + 2] = noise * 0.3; // B
          data[i + 3] = 15; // Very subtle
        }

        ctx.putImageData(imageData, 0, 0);
        lastTimestamp = timestamp;
      }

      animationId = requestAnimationFrame(drawSubtleNoise);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    animationId = requestAnimationFrame(drawSubtleNoise);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <>
      <div className="toxic-base"></div>
      <div className="toxic-cyber-grid"></div>
      <div className="toxic-scanlines"></div>
      <canvas ref={canvasRef} className="toxic-noise"></canvas>
      <div className="toxic-hazard-top"></div>
      <div className="toxic-hazard-bottom"></div>
      <div className="toxic-glow-pulse"></div>
    </>
  );
};

export default MatrixBackground;
