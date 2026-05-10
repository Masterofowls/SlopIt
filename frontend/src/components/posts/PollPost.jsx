import React, { useState } from "react";
import { useProtectedApi } from "../../hooks/useProtectedApi";
import Post from "./Post";
import "./PollPost.css";

/**
 * PollPost — renders a poll with voting.
 * Props:
 *   post {object}  full post object with template_data.options
 */
const PollPost = ({ post }) => {
  const { post: apiPost } = useProtectedApi();

  const [templateData, setTemplateData] = useState(
    post.template_data ?? { options: [] },
  );
  const [userVote, setUserVote] = useState(post.user_vote ?? null);
  const [loading, setLoading] = useState(false);

  const options = templateData.options ?? [];
  const totalVotes = options.reduce((sum, o) => sum + (o.votes ?? 0), 0);

  const handleVote = async (idx) => {
    if (loading) return;
    if (!post.id || String(post.id).startsWith("dummy")) return;

    setLoading(true);
    try {
      const res = await apiPost(`/posts/${post.id}/vote/`, {
        option_index: idx,
      });
      if (res?.template_data) setTemplateData(res.template_data);
      setUserVote(res?.user_vote ?? null);
    } catch {
      // silently ignore — optimistic not needed for polls
    } finally {
      setLoading(false);
    }
  };

  const mediaImages = post.media?.filter((m) => m.kind === "image") ?? [];

  return (
    <Post post={post}>
      {mediaImages.length > 0 && (
        <div className="poll-media">
          {mediaImages.map((m) => (
            <img key={m.id} src={m.file} alt="" className="poll-media-image" />
          ))}
        </div>
      )}
      {post.title && <p className="poll-question">{post.title}</p>}
      <ul className="poll-options">
        {options.map((opt, idx) => {
          const votes = opt.votes ?? 0;
          const pct =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isVoted = userVote === idx;

          return (
            <li key={idx} className="poll-option">
              <button
                className={`poll-btn${isVoted ? " poll-btn--voted" : ""}`}
                onClick={() => handleVote(idx)}
                disabled={loading}
              >
                <span className="poll-label">{opt.text}</span>
                <div
                  className="poll-bar"
                  style={{ "--pct": `${pct}%` }}
                  aria-hidden="true"
                />
                <span className="poll-pct">{pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="poll-total">
        {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
      </p>
    </Post>
  );
};

export default PollPost;
