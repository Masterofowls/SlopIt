import React, { useState, useCallback, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuthContext } from "../context/AuthContext";
import { PostFeed } from "../components/posts/index.js";
import PostCreateModal from "../components/posts/PostCreateModal";
import { useProtectedApi } from "../hooks/useProtectedApi";
import Navigation from "../components/layout/Navigation";
import "./HomePage.css";

const HomePage = () => {
  const { user: clerkUser } = useUser();
  const { telegramUser, provider } = useAuthContext();
  const { get } = useProtectedApi();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch real feed on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get("/feed/?cursor=0&limit=25")
      .then((data) => {
        if (!cancelled) {
          setPosts(Array.isArray(data) ? data : (data.results ?? []));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFeedError(err?.response?.data?.detail || "Failed to load feed.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [get]);

  const handlePostCreated = useCallback((newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  }, []);

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
