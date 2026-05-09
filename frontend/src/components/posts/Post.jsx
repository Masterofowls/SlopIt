import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useUser } from "@clerk/clerk-react";
import Card from "../ui/Card";
import CommentSection from "./CommentSection";
import { useProtectedApi } from "../../hooks/useProtectedApi";
import { useAuthContext } from "../../context/AuthContext";
import "./Post.css";

/**
 * Return the best available display name for a post author.
 * Clerk users may have their internal ID (user_xxxx) stored as `username`
 * when no real username has been set — skip those and fall back to name fields.
 */
function resolveAuthorName(author) {
  if (!author) return "anon";
  const isClerkId = (s) =>
    typeof s === "string" && /^user_[a-z0-9]{10,}$/i.test(s);

  if (author.display_name && !isClerkId(author.display_name))
    return author.display_name;
  if (author.full_name && !isClerkId(author.full_name)) return author.full_name;

  const nameParts = [author.first_name, author.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (nameParts) return nameParts;

  if (author.username && !isClerkId(author.username)) return author.username;
  if (author.name && !isClerkId(author.name)) return author.name;
  if (author.email) return author.email.split("@")[0];

  return "anon";
}

const Post = ({ post }) => {
  const { post: apiPost } = useProtectedApi();
  const { user: clerkUser } = useUser();
  const { telegramUser } = useAuthContext();
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState([]);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [showComments, setShowComments] = useState(false);

  // Support both real API format and legacy dummy-data format
  const likeCount = post.reaction_counts?.like ?? post.likes ?? 0;
  const commentCount = post.comment_count ?? post.comments ?? 0;

  const [localLikeCount, setLocalLikeCount] = useState(likeCount);
  const [userReaction, setUserReaction] = useState(post.user_reaction ?? null);
  const liked = userReaction === "like";

  const bodyText = post.body_markdown || post.content || "";
  const bodyHtml = post.body_html || null;
  const postContent = post.title
    ? { title: post.title, body: bodyText, bodyHtml, kind: post.kind }
    : { title: null, body: bodyText, bodyHtml: null, kind: "text" };

  // Debug: log post body so images/markdown issues are visible in browser console
  if (bodyText && bodyText.includes("![")) {
    console.log(
      "[Post] body_markdown with image →",
      post.id,
      JSON.stringify(bodyText),
    );
  }

  const authorName = resolveAuthorName(post.author);

  // Detect if this post belongs to the currently logged-in user.
  const isCurrentUsersPost =
    (clerkUser &&
      (post.author?.clerk_id === clerkUser.id ||
        post.author?.username === clerkUser.username)) ||
    (telegramUser && String(post.author?.id) === String(telegramUser.id));
  const authAvatar = clerkUser?.imageUrl || telegramUser?.avatarUrl || null;
  const authorAvatar =
    post.author?.avatar_url ||
    post.author?.avatar ||
    (isCurrentUsersPost ? authAvatar : null) ||
    "/frog.png";
  const createdAt =
    post.created_at || post.timestamp || new Date().toISOString();

  const handleLikeClick = async () => {
    if (isAnimating) return;

    const wasLiked = liked;

    // Optimistic update — toggle
    if (wasLiked) {
      setUserReaction(null);
      setLocalLikeCount((n) => Math.max(0, n - 1));
    } else {
      setUserReaction("like");
      setLocalLikeCount((n) => n + 1);
      setIsAnimating(true);
      // Particle animation only when adding a like
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
    }

    // Call real API if post has a server id
    if (post.id && !String(post.id).startsWith("dummy")) {
      try {
        const res = await apiPost(`/posts/${post.id}/react/`, { kind: "like" });
        // Sync with server's authoritative counts
        if (res?.reaction_counts) {
          setLocalLikeCount(res.reaction_counts.like ?? 0);
        }
        if ("user_reaction" in (res ?? {})) {
          setUserReaction(res.user_reaction);
        }
      } catch {
        // Revert optimistic update on failure
        setUserReaction(wasLiked ? "like" : null);
        setLocalLikeCount((n) => (wasLiked ? n + 1 : Math.max(0, n - 1)));
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
          <div className="post-text post-markdown">
            <ReactMarkdown
              components={{
                // Open links in new tab; block navigation away
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                // Constrain images to the card width
                img: ({ src, alt }) => {
                  if (!src) return null;
                  return (
                    <img
                      src={src}
                      alt={alt || ""}
                      className="post-md-image"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        console.warn("[Post] Image failed to load:", src);
                      }}
                    />
                  );
                },
                // Unwrap paragraphs that contain only an image so the img
                // is not nested inside <p> (avoids invalid HTML + layout quirks)
                p: ({ children }) => {
                  const arr = React.Children.toArray(children);
                  if (arr.length === 1 && arr[0]?.type === "img") {
                    return <>{children}</>;
                  }
                  return <p>{children}</p>;
                },
              }}
            >
              {postContent.body}
            </ReactMarkdown>
          </div>
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
        <button
          className={`post-action${liked ? " liked" : ""}`}
          onClick={handleLikeClick}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <span className="action-icon">{liked ? "❤️" : "🤍"}</span>
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
