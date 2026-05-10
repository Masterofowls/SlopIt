import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProtectedApi } from "../hooks/useProtectedApi";
import Navigation from "../components/layout/Navigation";
import PostFactory from "../components/posts/PostFactory";
import "./PostPage.css";

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

  return (
    <div className="post-page">
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
