import React from 'react';
import Post from './Post';
import './ImagePost.css';

const ImagePost = ({ post }) => {
  return (
    <Post post={post}>
      <div className="post-image-container">
        <img 
          src={post.imageUrl} 
          alt="Post image" 
          className="post-image"
        />
      </div>
    </Post>
  );
};

export default ImagePost;
