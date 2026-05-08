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
      <Navigation />
      <div className="home-container">
        <PostCreator onCreatePost={handleCreatePost} />
        <PostFeed posts={posts} />
      </div>
    </div>
  );
};

export default HomePage;
