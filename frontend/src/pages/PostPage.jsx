import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProtectedApi } from "../hooks/useProtectedApi";
import Navigation from "../components/layout/Navigation";
import PostFactory from "../components/posts/PostFactory";
import PageMeta from "../components/seo/PageMeta.jsx";
import {
  DEFAULT_OG_IMAGE,
  truncateDescription,
  resolveMediaUrl,
} from "../lib/seo.js";
import "./PostPage.css";

function postOgImage(post) {
  const visual = post?.media?.find(
    (item) => item.kind === "image" || item.kind === "gif",
  );
  return resolveMediaUrl(visual?.file) || DEFAULT_OG_IMAGE;
}

const PostPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { get } = useProtectedApi();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    get(`/posts/by-slug/${slug}/`)
      .then((data) => {
        if (cancelled) return;
        setPost(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status ?? err?.status;
        if (status === 404) {
          setError("Post not found.");
        } else {
          setError("Failed to load post. Try again later.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const postTitle = post?.title || "Post";
  const postDescription = post
    ? truncateDescription(post.body_markdown || post.title)
    : "Loading post on SlopIt.";
  const postPath = slug ? `/post/${slug}` : "/post";

  return (
    <div className="post-page">
      <PageMeta
        title={postTitle}
        description={postDescription}
        path={postPath}
        image={post ? postOgImage(post) : DEFAULT_OG_IMAGE}
        type={post ? "article" : "website"}
      />
      <Navigation />
      <div className="post-page__content">
        {loading && (
          <div className="post-page__loading">
            <span className="post-page__loading-text">LOADING_POST...</span>
          </div>
        )}

        {error && !loading && (
          <div className="post-page__error">
            <p className="post-page__error-text">{error}</p>
            <button
              className="post-page__back-btn"
              onClick={() => navigate(-1)}
            >
              ← BACK
            </button>
          </div>
        )}

        {post && !loading && (
          <>
            <button
              className="post-page__back-btn"
              onClick={() => navigate(-1)}
            >
              ← BACK
            </button>
            <PostFactory post={post} />
          </>
        )}
      </div>
    </div>
  );
};

export default PostPage;
