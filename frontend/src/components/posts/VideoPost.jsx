import React, { useState, useRef, useEffect } from "react";
import Post from "./Post";
import "./VideoPost.css";

const VideoPost = ({ post }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  // Backend: post.media = [{id, kind, file, ...}]; legacy: post.videoUrl
  const videoMedia = post.media?.find((m) => m.kind === "video");
  const videoUrl = videoMedia?.file || post.videoUrl;
  const thumbUrl = videoMedia?.thumbnail || post.thumbnailUrl;

  useEffect(() => {
    if (isPlaying && videoRef.current && videoUrl) {
      videoRef.current.src = videoUrl;
    }
  }, [isPlaying, videoUrl]);

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
              src={thumbUrl}
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
};;

export default VideoPost;
