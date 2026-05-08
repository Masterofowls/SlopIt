import React, { useState, useCallback, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuthContext } from "../context/AuthContext";
import { PostFeed } from "../components/posts/index.js";
import PostCreateModal from "../components/posts/PostCreateModal";
import { useProtectedApi } from "../hooks/useProtectedApi";
import { dummyPosts } from "../config/dummyPosts";
import Navigation from "../components/layout/Navigation";
import "./HomePage.css";

const HomePage = () => {
  const { user: clerkUser } = useUser();
  const { telegramUser, provider, isLoading: authLoading } = useAuthContext();
  const { get } = useProtectedApi();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [showModal, setShowModal] = useState(false);

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

  return (
    <div className="page home-page">
      {/* <div className="radioactive-fog-container">
        <svg
          className="fog-svg fog-1"
          viewBox="0 0 1920 600"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fog-outline"
            d="M0,300 Q200,250 400,300 T800,300 T1200,300 T1600,300 T1920,300"
            fill="none"
            stroke="#00ff00"
            strokeWidth="4"
          />
          <path
            className="fog-fill"
            d="M0,300 Q200,250 400,300 T800,300 T1200,300 T1600,300 T1920,300 L1920,600 L0,600 Z"
            fill="rgba(0,255,0,0.2)"
          />
        </svg>
        <svg
          className="fog-svg fog-2"
          viewBox="0 0 1920 600"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fog-outline"
            d="M0,350 Q250,280 500,350 T1000,350 T1500,350 T1920,350"
            fill="none"
            stroke="#00ff00"
            strokeWidth="4"
          />
          <path
            className="fog-fill"
            d="M0,350 Q250,280 500,350 T1000,350 T1500,350 T1920,350 L1920,600 L0,600 Z"
            fill="rgba(0,255,100,0.15)"
          />
        </svg>
        <svg
          className="fog-svg fog-3"
          viewBox="0 0 1920 600"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="fog-outline"
            d="M0,280 Q300,220 600,280 T1200,280 T1800,280 T1920,280"
            fill="none"
            stroke="#00ff00"
            strokeWidth="4"
          />
          <path
            className="fog-fill"
            d="M0,280 Q300,220 600,280 T1200,280 T1800,280 T1920,280 L1920,600 L0,600 Z"
            fill="rgba(100,255,0,0.1)"
          />
        </svg>
      </div> */}
      <Navigation />
      <div className="home-container">
        <div className="home-toolbar">
          <button className="new-post-btn" onClick={() => setShowModal(true)}>
            + Post
          </button>
        </div>
        {loading && <p className="feed-status">loading feed…</p>}
        {feedError && <p className="feed-status feed-error">{feedError}</p>}
        {!loading && <PostFeed posts={posts} />}
      </div>
      {showModal && (
        <PostCreateModal
          onClose={() => setShowModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}
    </div>
  );
};

export default HomePage;
