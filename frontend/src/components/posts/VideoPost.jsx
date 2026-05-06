import React, { useState, useRef, useEffect } from "react";
import Post from "./Post";
import "./VideoPost.css";

const VideoPost = ({ post }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (isPlaying && videoRef.current && post.videoUrl) {
      videoRef.current.src = post.videoUrl;
    }
  }, [isPlaying, post.videoUrl]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  return (
    <Post post={post}>
      <div className="post-video-container">
        {isPlaying ? (
          <video ref={videoRef} className="post-video" controls autoPlay />
        ) : (
          <div className="video-thumbnail" onClick={handlePlay}>
            <img
              src={post.thumbnailUrl}
              alt="Video thumbnail"
              className="thumbnail-image"
            />
            <div className="play-button">
              <div className="play-icon">▶</div>
            </div>
          </div>
        )}
      </div>
    </Post>
  );
};

export default VideoPost;
