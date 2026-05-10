import React from 'react';
import Post from './Post';

const TextPost = ({ post }) => {
  const mediaImages = post.media?.filter((m) => m.kind === "image") ?? [];
  return (
    <Post post={post}>
      {mediaImages.length > 0 && (
        <div className="post-media">
          {mediaImages.map((m) => (
            <img
              key={m.id}
              src={m.file}
              alt=""
              className="post-media-image"
              loading="lazy"
            />
          ))}
        </div>
      )}
    </Post>
  );
};

export default TextPost;
