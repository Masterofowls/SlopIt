import React, { useEffect, useRef, useState } from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useProtectedApi } from "../hooks/useProtectedApi";
import FrogBackground from "../components/ToxicBackground";
import "./ProfilePage.css";

/* ── Strip Clerk raw IDs from display names ─────────────────────────────── */
const isClerkId = (s) =>
  typeof s === "string" && /^(clerk_|k_)?user_[a-z0-9]{6,}/i.test(s);
const isPlaceholder = (s) => typeof s === "string" && /^user\d+$/i.test(s);
const isSentinelEmail = (e) =>
  !e || e.endsWith("@no-email.local") || isClerkId(e.split("@")[0]);
const cleanName = (name) =>
  name && !isClerkId(name) && !isPlaceholder(name) ? name : null;

const ProfilePage = () => {
  const { user, isLoaded } = useUser();
  const { get, patch } = useProtectedApi();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");

  /* ── Edit state ──────────────────────────────────────────────────────── */
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const previewUrlRef = useRef(null);

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
    profile?.display_name ||
    cleanName(user?.fullName) ||
    cleanName(user?.username) ||
    cleanUsername ||
    "ANON";

  /* ── Edit helpers ────────────────────────────────────────────────────── */
  const revokePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const openEdit = () => {
    setEditName(profile?.display_name || "");
    setEditBio(profile?.bio || "");
    setEditAvatar(null);
    revokePreview();
    setAvatarPreview(null);
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditAvatar(null);
    revokePreview();
    setAvatarPreview(null);
  };

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    revokePreview();
    setEditAvatar(file);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setAvatarPreview(url);
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      let data;
      if (editAvatar) {
        data = new FormData();
        data.append("display_name", editName.trim());
        data.append("bio", editBio.trim());
        data.append("avatar", editAvatar);
      } else {
        data = { display_name: editName.trim(), bio: editBio.trim() };
      }
      const updated = await patch("/me/", data);
      setProfile(updated);
      setEditing(false);
      setEditAvatar(null);
      revokePreview();
      setAvatarPreview(null);
    } catch {
      setSaveError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };
  /* ─────────────────────────────────────────────────────────────────────── */

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
          <button
            className="pp-edit-toggle"
            onClick={editing ? cancelEdit : openEdit}
          >
            {editing ? "✕ CLOSE" : "✎ EDIT"}
          </button>
        </div>

        {/* ── Edit panel ──────────────────────────────────────────────── */}
        {editing && (
          <div className="pp-card pp-edit-panel">
            <h2 className="pp-edit-title">// EDIT PROFILE</h2>

            <div className="pp-edit-avatar-row">
              <div className="pp-edit-avatar-preview">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="preview" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" />
                ) : (
                  <div className="pp-edit-avatar-placeholder">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <label className="pp-edit-upload-btn">
                <span>CHOOSE AVATAR</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onAvatarChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            <div className="pp-edit-field">
              <label className="pp-edit-label">DISPLAY NAME</label>
              <input
                className="pp-edit-input"
                type="text"
                maxLength={100}
                placeholder="Enter your display name…"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="pp-edit-field">
              <label className="pp-edit-label">BIO</label>
              <textarea
                className="pp-edit-input pp-edit-textarea"
                maxLength={500}
                placeholder="Tell the world about yourself…"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
              />
            </div>

            {saveError && <p className="pp-save-error">{saveError}</p>}

            <div className="pp-edit-actions">
              <button
                className="pp-edit-btn pp-edit-btn--primary"
                onClick={saveProfile}
                disabled={saving}
              >
                {saving ? "SAVING…" : "SAVE"}
              </button>
              <button
                className="pp-edit-btn pp-edit-btn--cancel"
                onClick={cancelEdit}
                disabled={saving}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

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
