import React, { useRef, useEffect } from "react";

export default function Video({ src, isMuted }) {
  const refVideo = useRef(null);

  useEffect(() => {
    if (!refVideo.current) {
      return;
    }

    if (isMuted) {
      refVideo.current.defaultMuted = true;
      refVideo.current.muted = true;
    }

    refVideo.current.src = src;
  }, [src]);

  return (
    <video
      ref={refVideo}
      autoPlay
      playsInline
    />
  );
}
