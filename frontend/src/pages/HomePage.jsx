import React, { useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../hooks/useSession.js";
import { PostCreator, PostFeed } from "../components/posts/index.js";
import { dummyPosts } from "../config/dummyPosts.js";
import Navigation from "../components/layout/Navigation";
import "./HomePage.css";

const HomePage = () => {
  const location = useLocation();
  const { session, isPending } = useSession();
  const [posts, setPosts] = useState(dummyPosts);

  const authBanner = useMemo(() => {
    const fromState = location.state;
    const lastStatus = sessionStorage.getItem("auth:last_status");

    if (fromState?.authStatus === "success") {
      return {
        type: "success",
        message: fromState.authMessage || "Authentication successful.",
      };
    }

    if (lastStatus === "success") {
      sessionStorage.removeItem("auth:last_status");
      return {
        type: "success",
        message: "Authentication successful. You are now signed in.",
      };
    }

    return null;
  }, [location.state]);

  console.debug("[auth] HomePage:render", {
    isPending,
    hasSession: Boolean(session),
    username: session?.user?.username,
    authStatus: location.state?.authStatus,
  });

  const handleCreatePost = useCallback(
    (newPost) => {
      const postWithAuthor = {
        ...newPost,
        id: Date.now(),
        author: {
          id: session?.user?.id || 1,
          username: session?.user?.username || "current_user",
          avatar: "/frog.png",
        },
        likes: 0,
        comments: 0,
      };
      setPosts((prev) => [postWithAuthor, ...prev]);
    },
    [session],
  );

  return (
    <div className="page home-page">
      <Navigation />
      {authBanner ? (
        <div
          style={{
            margin: "16px auto 0",
            width: "min(980px, calc(100vw - 32px))",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #62d982",
            background: "#d8ffe1",
            color: "#0f5a22",
            fontWeight: 600,
          }}
          role="status"
          aria-live="polite"
        >
          {authBanner.message}
        </div>
      ) : null}
      <div className="home-container">
        <PostCreator onCreatePost={handleCreatePost} />
        <PostFeed posts={posts} />
      </div>
    </div>
  );
};

export default HomePage;
