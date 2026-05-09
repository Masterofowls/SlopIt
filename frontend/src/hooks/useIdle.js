import { useEffect, useRef, useState } from 'react';

const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

/**
 * Returns true when the user has been idle for `timeout` milliseconds.
 * @param {number} timeout - idle threshold in ms (default 100 000 = 100 s)
 */
export function useIdle(timeout = 100_000) {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    function reset() {
      setIsIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsIdle(true), timeout);
    }

    reset(); // start timer immediately

    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeout]);

  return isIdle;
}
