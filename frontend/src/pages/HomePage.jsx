import React, { useState, useCallback, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuthContext } from "../context/AuthContext";
import { PostFeed } from "../components/posts/index.js";
import PostCreateModal from "../components/posts/PostCreateModal";
import { useProtectedApi } from "../hooks/useProtectedApi";
import { dummyPosts } from "../config/dummyPosts";
import Navigation from "../components/layout/Navigation";
import TrendingTags from "../components/layout/TrendingTags";
import MatrixRain from "../components/MatrixRain";
import { useIdle } from "../hooks/useIdle";
import "./HomePage.css";

const HomePage = () => {
  const { user: clerkUser } = useUser();
  const { telegramUser, provider, isLoading: authLoading } = useAuthContext();
  const { get } = useProtectedApi();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  // Cursor-based pagination state for the /feed/ endpoint
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  /**
   * Merge two post arrays, deduplicate by id, sort newest-first.
   * Handles both numeric ids and string ids safely.
   */
  const mergePosts = useCallback((a, b) => {
    const seen = new Set();
    return [...a, ...b]
      .filter((p) => {
        const key = String(p.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((x, y) => {
        const tx = new Date(x.created_at || x.timestamp || 0).getTime();
        const ty = new Date(y.created_at || y.timestamp || 0).getTime();
        return ty - tx;
      });
  }, []);

  /**
   * Fetch the social feed AND the current user's own posts, then merge them.
   * Own posts come from GET /posts/ (the same base resource used to create).
   * The /feed/ endpoint is typically a "following" feed that excludes self.
   */
  const fetchFeed = useCallback(
    (signal) => {
      setLoading(true);
      setFeedError(null);

      const feedReq = get("/feed/?cursor=0&limit=25").catch(() => []);
      const ownReq = get("/posts/?ordering=-created_at&limit=25").catch(
        () => [],
      );

      return Promise.all([feedReq, ownReq])
        .then(([feedData, ownData]) => {
          if (signal?.aborted) return;

          const feedPosts = Array.isArray(feedData)
            ? feedData
            : (feedData?.results ?? []);
          const ownPosts = Array.isArray(ownData)
            ? ownData
            : (ownData?.results ?? []);

          const merged = mergePosts(feedPosts, ownPosts);
          setPosts(merged.length > 0 ? merged : dummyPosts);

          // Persist cursor for infinite-scroll load-more
          setFeedCursor(feedData?.next_cursor ?? null);
          setFeedHasMore(feedData?.has_more ?? false);
        })
        .catch((err) => {
          if (signal?.aborted) return;
          setFeedError(err?.response?.data?.detail || "Failed to load feed.");
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [get, mergePosts],
  );

  /** Fetch the next cursor page from /feed/ and append to posts. */
  const loadMoreFeed = useCallback(async () => {
    if (loadingMore || !feedHasMore || feedCursor === null) return;
    setLoadingMore(true);
    try {
      const data = await get(`/feed/?cursor=${feedCursor}&limit=25`);
      const newPosts = Array.isArray(data) ? data : (data?.results ?? []);
      setPosts((prev) => mergePosts(prev, newPosts));
      setFeedCursor(data?.next_cursor ?? null);
      setFeedHasMore(data?.has_more ?? false);
    } catch {
      // silently absorb — user can scroll again to retry
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, feedHasMore, feedCursor, get, mergePosts]);

  // Initial load — wait for auth to settle first
  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    fetchFeed(controller.signal);
    return () => controller.abort();
  }, [fetchFeed, authLoading]);

  const handlePostCreated = useCallback(
    (newPost) => {
      // Optimistic insert so the post appears immediately
      setPosts((prev) => mergePosts([newPost], prev));
      // Re-fetch in the background so the backend state is confirmed
      fetchFeed();
    },
    [fetchFeed, mergePosts],
  );

  const isIdle = useIdle(100_000); // 100 seconds

  return (
    <div className="page home-page">
      {isIdle && <MatrixRain />}
      <Navigation />
      <div className="home-layout">
        <div className="home-container">
          <div className="home-toolbar">
            <button className="new-post-btn" onClick={() => setShowModal(true)}>
              + Post
            </button>
          </div>
          {loading && <p className="feed-status">loading feed…</p>}
          {feedError && <p className="feed-status feed-error">{feedError}</p>}
          {!loading && (
            <PostFeed
              posts={posts}
              onLoadMore={loadMoreFeed}
              hasMore={feedHasMore}
              loadingMore={loadingMore}
            />
          )}
        </div>
        <TrendingTags />
      </div>
      {showModal && (
        <PostCreateModal
          onClose={() => setShowModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}
    </div>
  );
};;

export default HomePage;
