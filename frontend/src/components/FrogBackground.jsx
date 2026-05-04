import "./FrogBackground.css";
import Video from "./Video";

const FrogBackground = () => {
  return (
    <div className="video-container">
      <Video
        src="../../../dist/moving-car-at-starry-night.1920x1080.mp4"
        isMuted={true}
      />
    </div>
  );
};

export default FrogBackground;
