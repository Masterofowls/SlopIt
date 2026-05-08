import React, { useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuthContext } from "../context/AuthContext";
import { PostCreator, PostFeed } from "../components/posts/index.js";
import { dummyPosts } from "../config/dummyPosts.js";
import Navigation from "../components/layout/Navigation";
import "./HomePage.css";

const HomePage = () => {
  const { user: clerkUser } = useUser();
  const { telegramUser, provider } = useAuthContext();
  const [posts, setPosts] = useState(dummyPosts);

  // Resolve current user from whichever auth provider is active
  const currentUser =
    provider === "telegram"
      ? {
          id: String(telegramUser?.id ?? "unknown"),
          username:
            telegramUser?.username || telegramUser?.firstName || "current_user",
          avatar: telegramUser?.avatarUrl || "/frog.png",
        }
      : {
          id: clerkUser?.id || "unknown",
          username:
            clerkUser?.username || clerkUser?.firstName || "current_user",
          avatar: clerkUser?.imageUrl || "/frog.png",
        };

  const handleCreatePost = useCallback(
    (newPost) => {
      const postWithAuthor = {
        ...newPost,
        id: Date.now(),
        author: currentUser,
        likes: 0,
        comments: 0,
      };
      setPosts((prev) => [postWithAuthor, ...prev]);
    },
    [currentUser],
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
        {/* <PostCreator onCreatePost={handleCreatePost} /> */}
        <PostFeed posts={posts} />
      </div>
    </div>
  );
};

export default HomePage;
