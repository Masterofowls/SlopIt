import React, { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useAuthContext } from "../context/AuthContext";
import {
  PENDING_FEED_REFRESH_KEY,
  useFeedRefresh,
} from "../context/FeedRefreshContext.jsx";
import { PostFeed } from "../components/posts/index.js";
import PostCreateModal from "../components/posts/PostCreateModal";
import { useProtectedApi } from "../hooks/useProtectedApi";
import { dummyPosts } from "../config/dummyPosts";
import Navigation from "../components/layout/Navigation";
import MatrixRain from "../components/MatrixRain";
import { useIdle } from "../hooks/useIdle";
import MatrixBackground from "../components/MatrixBackground.jsx";
import "./HomePage.css";
import { MAX_FILE_BYTES } from "../lib/uploadMedia.js";
import PageMeta from "../components/seo/PageMeta.jsx";
import { DEFAULT_DESCRIPTION, truncateDescription } from "../lib/seo.js";

const HomePage = () => {
  const { user: clerkUser } = useUser();
  const { isLoading: authLoading, isAuthenticated } = useAuthContext();
  const { registerRefreshHandler } = useFeedRefresh();
  const { get, post } = useProtectedApi();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get('q')?.trim() ?? '';
  const [searchPosts, setSearchPosts] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchTotal, setSearchTotal] = useState(null);
  const [searchNextUrl, setSearchNextUrl] = useState(null);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const feedRef = useRef(null);

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


  const applyFeedResponse = useCallback((feedData, ownData) => {
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
  }, [mergePosts]);

  const fetchFeed = useCallback(
    async (signal, { forceRefresh = false } = {}) => {
      setLoading(true);
      setFeedError(null);

      try {
        if (forceRefresh) {
          await post("/feed/refresh/");
        } else {
          const alreadyShuffled = sessionStorage.getItem("feedShuffled") === "1";
          if (!alreadyShuffled) {
            await post("/feed/refresh/").catch(() => null);
            sessionStorage.setItem("feedShuffled", "1");
          }
        }

        const [feedData, ownData] = await Promise.all([
          get("/feed/?cursor=0&limit=25").catch(() => []),
          get("/posts/?ordering=-created_at&limit=25").catch(() => []),
        ]);

        if (signal?.aborted) return;
        applyFeedResponse(feedData, ownData);
      } catch (err) {
        if (signal?.aborted) return;
        setFeedError(
          err?.response?.data?.detail || "Failed to load feed.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [applyFeedResponse, get, post],
  );

  const handleForceRefreshFeed = useCallback(async () => {
    if (loading || !isAuthenticated || searchQuery) return;

    setFeedError(null);
    scrollRestoredRef.current = true;

    try {
      await post("/feed/refresh/");
      const [feedData, ownData] = await Promise.all([
        get("/feed/?cursor=0&limit=25"),
        get("/posts/?ordering=-created_at&limit=25").catch(() => []),
      ]);
      applyFeedResponse(feedData, ownData);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFeedError(
        err?.response?.data?.detail || "Failed to shuffle feed.",
      );
    }
  }, [
    applyFeedResponse,
    get,
    isAuthenticated,
    loading,
    post,
    searchQuery,
  ]);

  useEffect(() => {
    return registerRefreshHandler(handleForceRefreshFeed);
  }, [registerRefreshHandler, handleForceRefreshFeed]);

  useEffect(() => {
    if (loading || authLoading || searchQuery) return;
    if (sessionStorage.getItem(PENDING_FEED_REFRESH_KEY) !== "1") return;
    sessionStorage.removeItem(PENDING_FEED_REFRESH_KEY);
    void handleForceRefreshFeed();
  }, [authLoading, handleForceRefreshFeed, loading, searchQuery]);


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

  const scrollRestoredRef = useRef(false);

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

  useEffect(() => {
    if (loading || posts.length === 0 || scrollRestoredRef.current) return;
    const savedId = sessionStorage.getItem('feedLastPostId');
    if (!savedId) return;
    requestAnimationFrame(() => {
      const target = document.querySelector(`[data-post-id="${savedId}"]`);
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      scrollRestoredRef.current = true;
    });
  }, [loading, posts]);

  const fetchSearch = useCallback(async (q, signal) => {
    setSearchLoading(true);
    setSearchError(null);
    setSearchPosts([]);
    setSearchNextUrl(null);
    try {
      const data = await get(`/posts/?search=${encodeURIComponent(q)}&limit=25`);
      if (signal?.aborted) return;
      setSearchPosts(data.results ?? []);
      setSearchNextUrl(data.next ?? null);
      setSearchTotal(data.count ?? 0);
    } catch {
      if (!signal?.aborted) setSearchError('Search failed. Please try again.');
    } finally {
      if (!signal?.aborted) setSearchLoading(false);
    }
  }, [get]);

  const loadMoreSearch = useCallback(async () => {
    if (searchLoadingMore || !searchNextUrl) return;
    setSearchLoadingMore(true);
    try {
      const url = new URL(searchNextUrl);
      const data = await get(url.pathname + url.search);
      setSearchPosts((prev) => [...prev, ...(data.results ?? [])]);
      setSearchNextUrl(data.next ?? null);
    } catch {
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchLoadingMore, searchNextUrl, get]);

  useEffect(() => {
    if (!searchQuery) return;
    const controller = new AbortController();
    fetchSearch(searchQuery, controller.signal).then(() => {
      requestAnimationFrame(() => {
        feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => controller.abort();
  }, [searchQuery, fetchSearch]);

  const seoPath = searchQuery
    ? `/home?q=${encodeURIComponent(searchQuery)}`
    : "/home";
  const seoTitle = searchQuery ? `Search: ${searchQuery}` : "Feed";
  const seoDescription = searchQuery
    ? truncateDescription(`Search results for "${searchQuery}" on SlopIt.`)
    : DEFAULT_DESCRIPTION;

  return (
    <div className="page home-page">
      <PageMeta
        title={seoTitle}
        description={seoDescription}
        path={seoPath}
      />
      {isIdle && <MatrixRain />}
      <Navigation />
      <MatrixBackground />
      <div className="home-layout">
        <div className="home-container" ref={feedRef}>
          {searchQuery ? (
            <>
              <div className="search-results-header">
                <span>search: <strong>{searchQuery}</strong></span>
                {searchTotal !== null && !searchLoading && (
                  <span className="search-results-count">
                    {searchTotal === 0
                      ? 'no results'
                      : `${searchTotal} result${searchTotal === 1 ? '' : 's'}`}
                  </span>
                )}
                <button
                  className="search-clear-btn"
                  onClick={() => navigate('/home')}
                >
                  ✕ clear
                </button>
              </div>
              {searchLoading && <p className="feed-status">searching…</p>}
              {searchError && <p className="feed-status feed-error">{searchError}</p>}
              {!searchLoading && (
                <PostFeed
                  posts={searchPosts}
                  onLoadMore={loadMoreSearch}
                  hasMore={Boolean(searchNextUrl)}
                  loadingMore={searchLoadingMore}
                />
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
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
