import React, { useState } from "react";
import Card from "../ui/Card";
import CommentSection from "./CommentSection";
import { useProtectedApi } from "../../hooks/useProtectedApi";
import "./Post.css";

const Post = ({ post }) => {
  const { post: apiPost } = useProtectedApi();
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState([]);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [showComments, setShowComments] = useState(false);

  // Support both real API format and legacy dummy-data format
  const likeCount = post.reaction_counts?.like ?? post.likes ?? 0;
  const commentCount = post.comment_count ?? post.comments ?? 0;
  const bodyText = post.body_markdown || post.content || "";
  const bodyHtml = post.body_html || null;
  const postContent = post.title
    ? { title: post.title, body: bodyText, bodyHtml, kind: post.kind }
    : { title: null, body: bodyText, bodyHtml: null, kind: "text" };
  const authorName = post.author?.username || post.author?.name || "anon";
  const authorAvatar =
    post.author?.avatar_url || post.author?.avatar || "/frog.png";
  const createdAt =
    post.created_at || post.timestamp || new Date().toISOString();

  const [localLikeCount, setLocalLikeCount] = useState(likeCount);

  const handleLikeClick = async () => {
    if (isAnimating) return;

    setIsAnimating(true);

    // Optimistic update
    setLocalLikeCount((n) => n + 1);

    // Particle animation
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      angle: (Math.PI * 2 * i) / 12,
      distance: 40 + Math.random() * 30,
      size: 8 + Math.random() * 8,
      delay: Math.random() * 0.1,
    }));
    setParticles(newParticles);
    setTextPosition({
      x: -60 + Math.random() * 120,
      y: -20 - Math.random() * 40,
    });

    setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 1000);

    // Call real API if post has a numeric/string id from the server
    if (post.id && !String(post.id).startsWith("dummy")) {
      try {
        await apiPost(`/posts/${post.id}/react/`, { kind: "like" });
      } catch {
        // Silently revert optimistic update on failure
        setLocalLikeCount((n) => Math.max(0, n - 1));
      }
    }
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
          <img src={authorAvatar} alt={authorName} className="author-avatar" />
          <div className="author-info">
            <span className="author-username">{authorName}</span>
            <span className="post-timestamp">{formatTimestamp(createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="post-content">
        {postContent.title && <p className="post-title">{postContent.title}</p>}
        {postContent.bodyHtml ? (
          <div
            className="post-text"
            /* eslint-disable-next-line react/no-danger */
            dangerouslySetInnerHTML={{ __html: postContent.bodyHtml }}
          />
        ) : postContent.body ? (
          <p className="post-text">{postContent.body}</p>
        ) : null}
        {postContent.kind === "link" && post.link_url && (
          <a
            className="post-link"
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {post.link_url}
          </a>
        )}
      </div>

      <div className="post-footer">
        <button className="post-action" onClick={handleLikeClick}>
          <span className="action-icon">❤️</span>
          <span className="action-count">{localLikeCount}</span>
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
        <button
          className={`post-action${showComments ? " active" : ""}`}
          onClick={() => setShowComments((v) => !v)}
        >
          <span className="action-icon">💬</span>
          <span className="action-count">{commentCount}</span>
        </button>
        <button className="post-action">
          <span className="action-icon">🔄</span>
        </button>
        <button className="post-action">
          <span className="action-icon">🔗</span>
        </button>
      </div>

      {showComments && post.id && <CommentSection postId={post.id} />}
    </Card>
  );
};

export default Post;
