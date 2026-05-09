import React, { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useProtectedApi } from "../hooks/useProtectedApi";
import FrogBackground from "../components/ToxicBackground";
import "./ProfilePage.css";

/* ── Strip Clerk raw IDs from display names ─────────────────────────────── */
const cleanName = (name) =>
  name ? name.replace(/^(clerk_)?user_[a-z0-9]{6,}$/i, "") || null : null;

const ProfilePage = () => {
  const { user, isLoaded } = useUser();
  const { get } = useProtectedApi();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setLoadingProfile(true);
    get("/me/")
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, get]);

  useEffect(() => {
    if (!profile?.username) return;
    let cancelled = false;
    setLoadingPosts(true);
    get(`/users/${profile.username}/posts/`)
      .then((data) => {
        if (!cancelled)
          setPosts(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingPosts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.username, get]);

  useEffect(() => {
    if (activeTab !== "bookmarks") return;
    if (bookmarks.length) return; // already loaded
    let cancelled = false;
    setLoadingBookmarks(true);
    get("/me/bookmarks/")
      .then((data) => {
        if (!cancelled)
          setBookmarks(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingBookmarks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, get, bookmarks.length]);

  const cleanUsername = cleanName(profile?.username);
  const displayName =
    cleanName(user?.fullName) ||
    cleanName(user?.username) ||
    cleanUsername ||
    "ANON";

  const avatarUrl = profile?.avatar_url || user?.imageUrl || null;
  const joinYear = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : user?.createdAt
      ? new Date(user.createdAt).getFullYear()
      : "—";

  if (!isLoaded) {
    return (
      <div className="pp-page">
        <FrogBackground />
        <p className="pp-status">// LOADING…</p>
      </div>
    );
  }

  return (
    <div className="pp-page">
      <FrogBackground />
      <div className="pp-container">
        {/* ── Header card ─────────────────────────────────────────────── */}
        <div className="pp-card pp-header-card">
          <div className="pp-avatar-wrap">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="pp-avatar" />
            ) : (
              <div className="pp-avatar-placeholder">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="pp-avatar-glow" />
          </div>

          <div className="pp-identity">
            <h1 className="pp-displayname">{displayName}</h1>
            {cleanUsername && <p className="pp-username">@{cleanUsername}</p>}
            {profile?.bio && <p className="pp-bio">{profile.bio}</p>}
            {profile?.website_url && (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="pp-website"
              >
                {profile.website_url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          <div className="pp-stats">
            <div className="pp-stat">
              <span className="pp-stat-val">
                {loadingPosts ? "…" : posts.length}
              </span>
              <span className="pp-stat-label">posts</span>
            </div>
            <div className="pp-stat">
              <span className="pp-stat-val">{joinYear}</span>
              <span className="pp-stat-label">joined</span>
            </div>
            {profile?.karma_score != null && (
              <div className="pp-stat pp-stat--karma">
                <span className="pp-stat-val">{profile.karma_score}</span>
                <span className="pp-stat-label">reputation</span>
              </div>
            )}
          </div>

          <div className="pp-clerk-btn">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>

        {/* ── Tab selector ────────────────────────────────────────────── */}
        <div className="pp-tabs">
          <button
            className={`pp-tab${activeTab === "posts" ? " pp-tab--active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            // POSTS
          </button>
          <button
            className={`pp-tab${activeTab === "bookmarks" ? " pp-tab--active" : ""}`}
            onClick={() => setActiveTab("bookmarks")}
          >
            ★ SAVED
          </button>
        </div>

        {/* ── Posts grid ──────────────────────────────────────────────── */}
        {activeTab === "posts" && (
          <div className="pp-section">
            {loadingPosts ? (
              <p className="pp-status">loading posts…</p>
            ) : posts.length === 0 ? (
              <p className="pp-status">no posts yet</p>
            ) : (
              <div className="pp-posts-grid">
                {posts.map((p) => (
                  <div
                    key={p.id}
                    className="pp-post-card"
                    onClick={() => p.slug && navigate(`/post/${p.slug}`)}
                    style={{ cursor: p.slug ? "pointer" : "default" }}
                  >
                    {p.media?.[0]?.file && (
                      <div className="pp-post-thumb-wrap">
                        <img
                          src={p.media[0].file}
                          alt={p.title}
                          className="pp-post-thumb"
                        />
                      </div>
                    )}
                    <div className="pp-post-info">
                      <span className={`pp-post-kind pp-kind--${p.kind}`}>
                        {p.kind}
                      </span>
                      <p className="pp-post-title">{p.title}</p>
                      <p className="pp-post-meta">
                        {p.reaction_counts?.like || 0} ↑ &nbsp;·&nbsp;{" "}
                        {p.comment_count || 0} 💬
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bookmarks grid ────────────────────────────────────────────── */}
        {activeTab === "bookmarks" && (
          <div className="pp-section">
            {loadingBookmarks ? (
              <p className="pp-status">loading saved posts…</p>
            ) : bookmarks.length === 0 ? (
              <p className="pp-status">no saved posts yet</p>
            ) : (
              <div className="pp-posts-grid">
                {bookmarks.map((b) => {
                  const p = b.post ?? b;
                  return (
                    <div
                      key={b.id}
                      className="pp-post-card"
                      onClick={() => p.slug && navigate(`/post/${p.slug}`)}
                      style={{ cursor: p.slug ? "pointer" : "default" }}
                    >
                      {p.media?.[0]?.file && (
                        <div className="pp-post-thumb-wrap">
                          <img
                            src={p.media[0].file}
                            alt={p.title}
                            className="pp-post-thumb"
                          />
                        </div>
                      )}
                      <div className="pp-post-info">
                        <span className={`pp-post-kind pp-kind--${p.kind}`}>
                          {p.kind}
                        </span>
                        <p className="pp-post-title">{p.title}</p>
                        <p className="pp-post-meta">
                          {p.reaction_counts?.like || 0} ↑ &nbsp;·&nbsp;{" "}
                          {p.comment_count || 0} 💬
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
