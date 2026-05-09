import { useState } from "react";
import { useProtectedApi } from "../../hooks/useProtectedApi";
import { useToast } from "../../context/ToastContext";
import "./BookmarkButton.css";

export default function BookmarkButton({ postId, initialBookmarked = false }) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);
  const { post, del } = useProtectedApi();
  const { addToast } = useToast();

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (bookmarked) {
        await del(`/posts/${postId}/bookmark/`);
        setBookmarked(false);
        addToast("Post removed from bookmarks.", "warn");
      } else {
        await post(`/posts/${postId}/bookmark/`);
        setBookmarked(true);
        addToast("Post saved to bookmarks.", "success");
      }
    } catch {
      addToast("Failed to update bookmark.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`bookmark-btn${bookmarked ? " bookmark-btn--saved" : ""}`}
      onClick={toggle}
      disabled={loading}
      title={bookmarked ? "Remove bookmark" : "Save post"}
      aria-label={bookmarked ? "Remove bookmark" : "Save post"}
    >
      {bookmarked ? "★ SAVED" : "☆ SAVE"}
    </button>
  );
}
