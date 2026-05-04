import React, { useState, useCallback } from 'react';
import { useSession } from '../hooks/useSession.js';
import { PostCreator, PostFeed } from '../components/posts/index.js';
import { dummyPosts } from '../config/dummyPosts.js';
import Navigation from '../components/layout/Navigation';
import './HomePage.css';

const HomePage = () => {
  const { session, isPending } = useSession();
  const [posts, setPosts] = useState(dummyPosts);

  const handleCreatePost = useCallback((newPost) => {
    const postWithAuthor = {
      ...newPost,
      id: Date.now(),
      author: {
        id: session?.user?.id || 1,
        username: session?.user?.username || 'current_user',
        avatar: '/frog.png'
      },
      likes: 0,
      comments: 0
    };
    setPosts(prev => [postWithAuthor, ...prev]);
  }, [session]);

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
