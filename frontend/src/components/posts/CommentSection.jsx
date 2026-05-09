import React, { useCallback, useEffect, useRef, useState } from "react";
import { useProtectedApi } from "../../hooks/useProtectedApi";
import "./CommentSection.css";

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const formatTime = (iso) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/* ── Reaction bar ──────────────────────────────────────────────────────────── */
const ReactionBar = ({
  commentId,
  likeCount,
  dislikeCount,
  userReaction,
  onReact,
}) => {
  const [optimistic, setOptimistic] = useState({
    like: likeCount,
    dislike: dislikeCount,
    mine: userReaction,
  });

  useEffect(() => {
    setOptimistic({
      like: likeCount,
      dislike: dislikeCount,
      mine: userReaction,
    });
  }, [likeCount, dislikeCount, userReaction]);

  const handleClick = async (kind) => {
    // Optimistic update
    const prev = { ...optimistic };
    const isSame = optimistic.mine === kind;
    const newMine = isSame ? null : kind;
    setOptimistic((o) => {
      const next = { ...o, mine: newMine };
      if (isSame) next[kind] = Math.max(0, o[kind] - 1);
      else {
        next[kind] = o[kind] + 1;
        if (o.mine) next[o.mine] = Math.max(0, o[o.mine] - 1);
      }
      return next;
    });
    try {
      const res = await onReact(commentId, kind);
      setOptimistic({
        like: res.like_count,
        dislike: res.dislike_count,
        mine: res.user_reaction,
      });
    } catch {
      setOptimistic(prev);
    }
  };

  return (
    <div className="cs-reactions">
      <button
        className={`cs-react-btn${optimistic.mine === "like" ? " cs-react-active" : ""}`}
        onClick={() => handleClick("like")}
        title="Like"
      >
        ↑ {optimistic.like || 0}
      </button>
      <button
        className={`cs-react-btn${optimistic.mine === "dislike" ? " cs-react-active cs-react-dislike" : ""}`}
        onClick={() => handleClick("dislike")}
        title="Dislike"
      >
        ↓ {optimistic.dislike || 0}
      </button>
    </div>
  );
};

/* ── Single comment ────────────────────────────────────────────────────────── */
const CommentItem = ({
  comment,
  currentUserId,
  depth = 0,
  onReact,
  onDelete,
  onEdit,
  onReply,
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body_markdown ?? "");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const isOwn = currentUserId && comment.author?.id === currentUserId;
  const hasReplies = (comment.reply_count || 0) > 0 || replies.length > 0;

  const loadReplies = async () => {
    if (loadingReplies) return;
    setLoadingReplies(true);
    try {
      const data = await onReply.fetch(comment.id);
      setReplies(Array.isArray(data) ? data : (data.results ?? []));
      setShowReplies(true);
    } finally {
      setLoadingReplies(false);
    }
  };

  const toggleReplies = () => {
    if (!showReplies) loadReplies();
    else setShowReplies(false);
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    const body = replyText.trim();
    if (!body) return;
    setReplySubmitting(true);
    try {
      const created = await onReply.post(comment.id, body);
      setReplies((prev) => [...prev, created]);
      setShowReplies(true);
      setReplyText("");
      setShowReplyForm(false);
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const body = editText.trim();
    if (!body) return;
    setEditSubmitting(true);
    try {
      await onEdit(comment.id, body);
      comment.body_markdown = body;
      setEditing(false);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this comment?")) return;
    await onDelete(comment.id);
    setDeleted(true);
  };

  if (deleted) return null;

  return (
    <li className={`cs-item${depth > 0 ? " cs-item--reply" : ""}`}>
      <div className="cs-meta">
        <span className="cs-author">
          {comment.author?.avatar_url && (
            <img src={comment.author.avatar_url} alt="" className="cs-avatar" />
          )}
          {comment.author?.display_name || comment.author?.username || "anon"}
        </span>
        <span className="cs-time">{formatTime(comment.created_at)}</span>
        {isOwn && !editing && (
          <span className="cs-own-actions">
            <button className="cs-action-btn" onClick={() => setEditing(true)}>
              edit
            </button>
            <button
              className="cs-action-btn cs-action-del"
              onClick={handleDelete}
            >
              del
            </button>
          </span>
        )}
      </div>

      {editing ? (
        <form className="cs-edit-form" onSubmit={handleEditSubmit}>
          <textarea
            className="cs-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={2}
            disabled={editSubmitting}
            autoFocus
          />
          <div className="cs-edit-actions">
            <button
              type="submit"
              className="cs-submit"
              disabled={editSubmitting || !editText.trim()}
            >
              {editSubmitting ? "saving…" : "save"}
            </button>
            <button
              type="button"
              className="cs-action-btn"
              onClick={() => setEditing(false)}
            >
              cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="cs-body">
          {comment.is_deleted ? (
            <em className="cs-deleted">[deleted]</em>
          ) : (
            (comment.body_markdown ?? comment.body)
          )}
        </p>
      )}

      <div className="cs-footer">
        <ReactionBar
          commentId={comment.id}
          likeCount={comment.like_count || 0}
          dislikeCount={comment.dislike_count || 0}
          userReaction={comment.user_reaction}
          onReact={onReact}
        />
        {depth === 0 && (
          <div className="cs-footer-right">
            {hasReplies && (
              <button className="cs-reply-toggle" onClick={toggleReplies}>
                {loadingReplies
                  ? "…"
                  : showReplies
                    ? "▲ hide"
                    : `▼ ${comment.reply_count || replies.length} replies`}
              </button>
            )}
            <button
              className="cs-action-btn"
              onClick={() => setShowReplyForm((v) => !v)}
            >
              reply
            </button>
          </div>
        )}
      </div>

      {showReplyForm && depth === 0 && (
        <form className="cs-reply-form" onSubmit={handleReplySubmit}>
          <textarea
            className="cs-textarea"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            disabled={replySubmitting}
            autoFocus
          />
          <button
            className="cs-submit"
            type="submit"
            disabled={replySubmitting || !replyText.trim()}
          >
            {replySubmitting ? "posting…" : "reply"}
          </button>
        </form>
      )}

      {showReplies && replies.length > 0 && (
        <ul className="cs-replies">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              currentUserId={currentUserId}
              depth={depth + 1}
              onReact={onReact}
              onDelete={onDelete}
              onEdit={onEdit}
              onReply={onReply}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

/* ── CommentSection root ───────────────────────────────────────────────────── */
const CommentSection = ({ postId, currentUserId }) => {
  const { get, post: apiPost, patch, del } = useProtectedApi();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get(`/posts/${postId}/comments/`)
      .then((data) => {
        if (!cancelled)
          setComments(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, get]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiPost("/comments/", {
        post: postId,
        body_markdown: body,
      });
      setComments((prev) => [...prev, created]);
      setText("");
    } catch (err) {
      setError(
        err?.response?.data?.body_markdown?.[0] ||
          err?.response?.data?.detail ||
          "Failed to post comment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReact = useCallback(
    async (commentId, kind) => {
      return apiPost(`/comments/${commentId}/react/`, { kind });
    },
    [apiPost],
  );

  const handleDelete = useCallback(
    async (commentId) => {
      await del(`/comments/${commentId}/`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [del],
  );

  const handleEdit = useCallback(
    async (commentId, body_markdown) => {
      await patch(`/comments/${commentId}/`, { body_markdown });
    },
    [patch],
  );

  const replyActions = {
    fetch: useCallback(
      async (commentId) => {
        return get(`/comments/${commentId}/replies/`);
      },
      [get],
    ),
    post: useCallback(
      async (parentId, body_markdown) => {
        return apiPost("/comments/", {
          post: postId,
          parent: parentId,
          body_markdown,
        });
      },
      [apiPost, postId],
    ),
  };

  return (
    <div className="cs-root">
      {loading ? (
        <p className="cs-status">loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="cs-status">no comments yet</p>
      ) : (
        <ul className="cs-list">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              depth={0}
              onReact={handleReact}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onReply={replyActions}
            />
          ))}
        </ul>
      )}

      <form className="cs-form" onSubmit={handleSubmit}>
        <textarea
          className="cs-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          disabled={submitting}
        />
        {error && <p className="cs-error">{error}</p>}
        <button
          type="submit"
          className="cs-submit"
          disabled={submitting || !text.trim()}
        >
          {submitting ? "posting…" : "comment"}
        </button>
      </form>
    </div>
  );
};

export default CommentSection;
