import { useEffect, useRef } from 'react';
import './MatrixRain.css';

/* Katakana + latin + digits character pool */
const CHARS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';

const FONT_SIZE = 14;
const RAIN_COLOR = '#00ff41'; // classic matrix green
const HEAD_COLOR = '#ccffcc'; // brighter leading char

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

export default function MatrixRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animId;
    let columns = 0;
    let drops = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / FONT_SIZE);
      // preserve existing drop positions; extend or shrink the array
      drops = Array.from({ length: columns }, (_, i) => drops[i] ?? Math.random() * -50);
    }

    function draw() {
      // semi-transparent black fade creates the trailing effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${FONT_SIZE}px monospace`;

      for (let i = 0; i < columns; i++) {
        const y = drops[i] * FONT_SIZE;

        // Bright head character
        ctx.fillStyle = HEAD_COLOR;
        ctx.fillText(randomChar(), i * FONT_SIZE, y);

        // Trailing character (one above)
        ctx.fillStyle = RAIN_COLOR;
        ctx.fillText(randomChar(), i * FONT_SIZE, y - FONT_SIZE);

        // Reset drop randomly once it passes the bottom
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.5 + Math.random() * 0.5;
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="matrix-rain-overlay" role="presentation" aria-hidden="true">
      <canvas ref={canvasRef} className="matrix-rain-canvas" />
      <div className="matrix-rain-hint">
        <span className="matrix-rain-hint-text">MOVE MOUSE TO RESUME</span>
      </div>
    </div>
  );
}
