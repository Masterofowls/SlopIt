import React from 'react';
import Card from '../ui/Card';
import './Post.css';

const Post = ({ post }) => {
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="post">
      <div className="post-header">
        <div className="post-author">
          <img 
            src={post.author.avatar} 
            alt={post.author.username}
            className="author-avatar"
          />
          <div className="author-info">
            <span className="author-username">{post.author.username}</span>
            <span className="post-timestamp">{formatTimestamp(post.timestamp)}</span>
          </div>
        </div>
      </div>

      <div className="post-content">
        {post.content && <p className="post-text">{post.content}</p>}
      </div>

      <div className="post-footer">
        <button className="post-action">
          <span className="action-icon">❤️</span>
          <span className="action-count">{post.likes}</span>
        </button>
        <button className="post-action">
          <span className="action-icon">💬</span>
          <span className="action-count">{post.comments}</span>
        </button>
        <button className="post-action">
          <span className="action-icon">🔄</span>
        </button>
        <button className="post-action">
          <span className="action-icon">🔗</span>
        </button>
      </div>
    </Card>
  );
};

export default Post;
