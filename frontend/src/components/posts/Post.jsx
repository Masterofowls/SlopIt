import React, { useState } from "react";
import Card from "../ui/Card";
import "./Post.css";

const Post = ({ post }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState([]);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });

  const handleLikeClick = (e) => {
    if (isAnimating) return; // Prevent animation interruption

    setIsAnimating(true);

    // Generate random particles
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      angle: (Math.PI * 2 * i) / 12,
      distance: 40 + Math.random() * 30,
      size: 8 + Math.random() * 8,
      delay: Math.random() * 0.1,
    }));
    setParticles(newParticles);

    // Randomize text position with larger range
    setTextPosition({
      x: -60 + Math.random() * 120,
      y: -20 - Math.random() * 40,
    });

    setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 1000);
  };
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
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
            <span className="post-timestamp">
              {formatTimestamp(post.timestamp)}
            </span>
          </div>
        </div>
      </div>

      <div className="post-content">
        {post.content && <p className="post-text">{post.content}</p>}
      </div>

      <div className="post-footer">
        <button className="post-action" onClick={handleLikeClick}>
          <span className="action-icon">❤️!!!!!!</span>
          <span className="action-count">{post.likes}</span>
          {isAnimating && (
            <>
              <span
                className="slopped-text"
                style={{
                  left: `calc(50% + ${textPosition.x}px)`,
                  top: `${textPosition.y}px`,
                }}
              >
                slopped
              </span>
              {particles.map((particle) => (
                <span
                  key={particle.id}
                  className="slop-particle"
                  style={{
                    "--angle": `${particle.angle}rad`,
                    "--distance": `${particle.distance}px`,
                    "--size": `${particle.size}px`,
                    "--delay": `${particle.delay}s`,
                  }}
                />
              ))}
            </>
          )}
        </button>
        <button className="post-action">
          <span className="action-icon">💬???????</span>
          <span className="action-count">{post.comments}</span>
        </button>
        <button className="post-action">
          <span className="action-icon">🔄:3</span>
        </button>
        <button className="post-action">
          <span className="action-icon">🔗344322523</span>
        </button>
      </div>
    </Card>
  );
};

export default Post;
