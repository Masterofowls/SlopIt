import React, { useEffect, useState } from 'react';
import { useProtectedApi } from '../../hooks/useProtectedApi';
import './CommentSection.css';

const CommentSection = ({ postId }) => {
  const { get, post: apiPost } = useProtectedApi();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get(`/posts/${postId}/comments/`)
      .then((data) => {
        if (!cancelled) {
          // API may return { results: [...] } (paginated) or plain array
          setComments(Array.isArray(data) ? data : (data.results ?? []));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [postId, get]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await apiPost('/comments/', {
        post: postId,
        body_markdown: body,
      });
      setComments((prev) => [...prev, created]);
      setText('');
    } catch (err) {
      setError(
        err?.response?.data?.body_markdown?.[0] ||
          err?.response?.data?.detail ||
          'Failed to post comment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
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
            <li key={c.id} className="cs-item">
              <span className="cs-author">
                {c.author?.avatar_url && (
                  <img src={c.author.avatar_url} alt="" className="cs-avatar" />
                )}
                {c.author?.display_name || c.author?.username || "anon"}
              </span>
              <span className="cs-time">{formatTime(c.created_at)}</span>
              <p className="cs-body">{c.body_markdown ?? c.body}</p>
            </li>
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
