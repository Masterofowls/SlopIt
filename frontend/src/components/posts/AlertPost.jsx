import React from "react";
import "./AlertPost.css";

const LEVELS = {
  info: { label: "INFO", cls: "alert--info" },
  warn: { label: "WARN", cls: "alert--warn" },
  warning: { label: "WARN", cls: "alert--warn" },
  danger: { label: "DANGER", cls: "alert--danger" },
  error: { label: "ERROR", cls: "alert--danger" },
};

const AlertPost = ({ post }) => {
  const level = post.template_data?.level || "info";
  const { label, cls } = LEVELS[level] ?? LEVELS.info;

  return (
    <div className={`alert-root ${cls}`}>
      <span className="alert-badge">{label}</span>
      {post.title && <p className="alert-title">{post.title}</p>}
      {(post.body_markdown || post.body_html) && (
        <p className="alert-body">{post.body_markdown || ""}</p>
      )}
    </div>
  );
};

export default AlertPost;
