import React, { useState } from 'react';
import Post from './Post';
import './VideoPost.css';

const VideoPost = ({ post }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  return (
    <Post post={post}>
      <div className="post-video-container">
        {isPlaying ? (
          <video 
            className="post-video"
            controls
            autoPlay
            src={post.videoUrl}
          />
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
