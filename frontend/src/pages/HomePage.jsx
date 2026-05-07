import React, { useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { PostCreator, PostFeed } from "../components/posts/index.js";
import { dummyPosts } from "../config/dummyPosts.js";
import Navigation from "../components/layout/Navigation";
import "./HomePage.css";

const HomePage = () => {
  const { user } = useUser();
  const [posts, setPosts] = useState(dummyPosts);

  const handleCreatePost = useCallback(
    (newPost) => {
      const postWithAuthor = {
        ...newPost,
        id: Date.now(),
        author: {
          id: user?.id || "unknown",
          username: user?.username || user?.firstName || "current_user",
          avatar: user?.imageUrl || "/frog.png",
        },
        likes: 0,
        comments: 0,
      };
      setPosts((prev) => [postWithAuthor, ...prev]);
    },
    [user],
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
