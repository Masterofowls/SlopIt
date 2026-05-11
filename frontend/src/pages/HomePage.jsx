import React, { useState, useCallback, useEffect, useRef } from "react";
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
import MatrixBackground from "../components/MatrixBackground.jsx";
import "./HomePage.css";
import { MAX_FILE_BYTES } from "../lib/uploadMedia.js";

const HomePage = () => {
  const { user: clerkUser } = useUser();
  const { telegramUser, provider, isLoading: authLoading } = useAuthContext();
  const { get, post } = useProtectedApi();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const mergePosts = useCallback((a, b) => {
    const seen = new Set();
    const result = [];
    for (const p of [...a, ...b]) {
      const key = String(p.id);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
    return result;
  }, []);


  const fetchFeed = useCallback(
    (signal) => {
      setLoading(true);
      setFeedError(null);

      // Refresh snapshot once per browser session via sessionStorage flag.
      // Reload → same shuffled order. New tab/window → new shuffle.
      const alreadyShuffled = sessionStorage.getItem('feedShuffled') === '1';
      const refreshStep = alreadyShuffled
        ? Promise.resolve()
        : post('/feed/refresh/')
            .catch(() => null)
            .then(() => sessionStorage.setItem('feedShuffled', '1'));

      const feedReq = refreshStep.then(() =>
        get('/feed/?cursor=0&limit=25').catch(() => []),
      );
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
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, feedHasMore, feedCursor, get, mergePosts]);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    fetchFeed(controller.signal);
    return () => controller.abort();
  }, [fetchFeed, authLoading]);

  const handlePostCreated = useCallback(
    (newPost) => {
      setPosts((prev) => mergePosts([newPost], prev));
      fetchFeed();
    },
    [fetchFeed, mergePosts],
  );

  const isIdle = useIdle(100_000);

  // ── Scroll position tracking ──────────────────────────────────────────────
  // Save the ID of the post currently in the center of the viewport.
  // On reload the feed is restored to that post automatically.
  const scrollRestoredRef = useRef(false);

  // Track which post is visible: debounce to avoid hammering sessionStorage.
  useEffect(() => {
    let timer = null;
    const handleScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const el = document.elementFromPoint(
          window.innerWidth / 2,
          window.innerHeight / 2,
        );
        const postEl = el?.closest('[data-post-id]');
        if (postEl) {
          sessionStorage.setItem('feedLastPostId', postEl.dataset.postId);
        }
      }, 150);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, []);

  // After posts render, scroll once to the saved post (only on first load).
  useEffect(() => {
    if (loading || posts.length === 0 || scrollRestoredRef.current) return;
    const savedId = sessionStorage.getItem('feedLastPostId');
    if (!savedId) return;
    // rAF ensures layout is complete before scrollIntoView.
    requestAnimationFrame(() => {
      const target = document.querySelector(`[data-post-id="${savedId}"]`);
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      scrollRestoredRef.current = true;
    });
  }, [loading, posts]);
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="page home-page">
      {isIdle && <MatrixRain />}
      <Navigation />
      <MatrixBackground />
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
};

export default HomePage;
