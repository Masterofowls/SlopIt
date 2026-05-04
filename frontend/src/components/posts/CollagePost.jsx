import React from 'react';
import Post from './Post';
import './CollagePost.css';

const CollagePost = ({ post }) => {
  const getGridClass = (imageCount) => {
    switch(imageCount) {
      case 2:
        return 'collage-grid-2';
      case 3:
        return 'collage-grid-3';
      case 4:
        return 'collage-grid-4';
      default:
        return 'collage-grid-default';
    }
  };

  return (
    <Post post={post}>
      <div className={`post-collage ${getGridClass(post.images.length)}`}>
        {post.images.map((image, index) => (
          <img
            key={index}
            src={image}
            alt={`Collage image ${index + 1}`}
            className="collage-image"
          />
        ))}
      </div>
    </Post>
  );
};

export default CollagePost;
