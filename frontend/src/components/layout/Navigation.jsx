import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAuth,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";
import { clerkAppearance } from "../../lib/clerkAppearance.js";
import PostCreateModal from "../posts/PostCreateModal";
import "./Navigation.css";

const Navigation = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [showPostModal, setShowPostModal] = useState(false);
  const searchRef = useRef(null);

  const ADMIN_URL =
    (import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev") + "/admin/";

  function renderAuthArea() {
    if (!isLoaded) {
      return null;
    }

    if (isSignedIn) {
      return (
        <>
          <button className="new-post-btn" onClick={() => setShowPostModal(true)}>
            + Post
          </button>
          <div className="nav-user-actions">
            <a
              href={ADMIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="manage-button"
              aria-label="Manage"
            >
              <span className="manage-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="manage-label">Manage</span>
            </a>
            <UserButton
              afterSignOutUrl="/"
              appearance={clerkAppearance}
              userProfileMode="modal"
            />
            <button className="nav-profile" onClick={() => navigate("/profile")}>
              Profile
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <SignInButton
          mode="modal"
          forceRedirectUrl="/home"
          fallbackRedirectUrl="/home"
          appearance={clerkAppearance}
        >
          <button className="login-button" type="button">
            Login
          </button>
        </SignInButton>
        <SignUpButton
          mode="modal"
          forceRedirectUrl="/home"
          fallbackRedirectUrl="/home"
          appearance={clerkAppearance}
        >
          <button className="signup-button" type="button">
            Sign up
          </button>
        </SignUpButton>
        <button className="nav-profile" onClick={() => navigate("/profile")}>
          Profile
        </button>
      </>
    );
  }

  return (
    <>
      <nav className="navigation">
        <div className="nav-container">
          <div className="nav-brand" onClick={() => navigate("/home")}>
            <h1>slopit</h1>
          </div>

          <form
            className="nav-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchRef.current?.value.trim();
              if (q) {
                navigate(`/home?q=${encodeURIComponent(q)}`);
              } else {
                navigate("/home");
              }
              searchRef.current?.blur();
            }}
          >
            <input
              ref={searchRef}
              className="nav-search-input"
              type="search"
              placeholder="search posts or authors…"
              aria-label="Search posts"
              onChange={(e) => {
                if (!e.target.value) {
                  navigate("/home");
                }
              }}
            />
            <button className="nav-search-btn" type="submit">
              🔍
            </button>
          </form>

          <div className="nav-user">{renderAuthArea()}</div>
        </div>
      </nav>

      {showPostModal && (
        <PostCreateModal onClose={() => setShowPostModal(false)} />
      )}
    </>
  );
};

export default Navigation;
