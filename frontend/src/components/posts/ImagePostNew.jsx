import React, { useState } from "react";
import Post from "./Post";
import "./ImagePost.css";

const ImagePost = ({ post }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Backend returns post.media = [{id, kind, file, ...}]; legacy dummy data uses
  // post.images (string[]) or post.imageUrl (string).
  const images =
    post.media?.length > 0
      ? post.media.map((m) => m.file)
      : post.images || (post.imageUrl ? [post.imageUrl] : []);
  const hasMultipleImages = images.length > 1;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <Post post={post}>
      <div className="post-image-container">
        <img
          src={images[currentIndex]}
          alt={`Post image ${currentIndex + 1}`}
          className="post-image"
        />

        {hasMultipleImages && (
          <>
            <button
              className="image-nav-button prev"
              onClick={goToPrevious}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              className="image-nav-button next"
              onClick={goToNext}
              aria-label="Next image"
            >
              ›
            </button>
            <div className="image-indicator">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    </Post>
  );
};;

export default ImagePost;
