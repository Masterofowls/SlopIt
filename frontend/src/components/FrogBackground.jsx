import "./FrogBackground.css";

const FrogBackground = () => {
  return (
    <div className="video-container">
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="../../dist/frog/frog.png"
        className="background-video"
      >
        <source
          src="../../dist/moving-car-at-starry-night.1920x1080.mp4"
          type="video/mp4"
        />
      </video>
    </div>
  );
};

export default FrogBackground;
