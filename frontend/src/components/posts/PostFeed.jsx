import React, { useState, useEffect, useCallback, useRef } from "react";
import PostFactory from "./PostFactory";
import "./PostFeed.css";

const PostFeed = ({ posts, onLoadMore, hasMore = true }) => {
  const [visiblePosts, setVisiblePosts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef(null);
  const lastPostRef = useRef(null);

  const loadMore = {};

  const loadMorePosts = useCallback(() => {
    if (loading || !hasMore) return;

    setLoading(true);

    setTimeout(() => {
      const startIndex = page * 5;
      const endIndex = startIndex + 5;
      const newPosts = posts.slice(startIndex, endIndex);

      setVisiblePosts((prev) => [...prev, ...newPosts]);
      setPage((prev) => prev + 1);
      setLoading(false);

      if (onLoadMore) {
        onLoadMore();
      }
    }, 500);
  }, [page, loading, hasMore, posts, onLoadMore]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 },
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, loading, hasMore]);

  // Observe the last post element
  useEffect(() => {
    if (lastPostRef.current && observerRef.current) {
      observerRef.current.observe(lastPostRef.current);
    }

    return () => {
      if (lastPostRef.current && observerRef.current) {
        observerRef.current.unobserve(lastPostRef.current);
      }
    };
  }, [visiblePosts]);

  // Load initial posts
  useEffect(() => {
    const initialPosts = posts.slice(0, 10);
    setVisiblePosts(initialPosts);
  }, [posts]);

  return (
    <div className="post-feed">
      {visiblePosts.map((post, index) => (
        <div
          key={post.id}
          ref={index === visiblePosts.length - 1 ? lastPostRef : null}
        >
          <PostFactory post={post} />
        </div>
      ))}

      {loading && (
        <div className="loading-more">
          <div className="spinner"></div>
          <p>Loading more posts...</p>
        </div>
      )}

      {!hasMore && visiblePosts.length > 0 && (
        <div className="end-of-feed">
          <p>You've reached the end of the feed</p>
        </div>
      )}

      {visiblePosts.length === 0 && !loading && (
        <div className="empty-feed">
          <p>No posts yet. Be the first to share something!</p>
        </div>
      )}
    </div>
  );
};

export default PostFeed;
