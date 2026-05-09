import React, { useEffect, useRef, useCallback } from "react";
import PostFactory from "./PostFactory";
import "./PostFeed.css";

const PostFeed = ({
  posts,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}) => {
  const sentinelRef = useRef(null);

  const handleIntersect = useCallback(
    ([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore && onLoadMore) {
        onLoadMore();
      }
    },
    [hasMore, loadingMore, onLoadMore],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, {
      threshold: 0.1,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  return (
    <div className="post-feed">
      {posts.length === 0 && !loadingMore && (
        <div className="empty-feed">
          <p>No posts yet. Be the first to share something!</p>
        </div>
      )}

      {posts.map((post) => (
        <div key={post.id}>
          <PostFactory post={post} />
        </div>
      ))}

      {/* Sentinel — triggers onLoadMore when scrolled into view */}
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />

      {loadingMore && (
        <div className="loading-more">
          <div className="spinner"></div>
          <p>Loading more posts...</p>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="end-of-feed">
          <p>You&apos;ve reached the end of the feed</p>
        </div>
      )}
    </div>
  );
};

export default PostFeed;
