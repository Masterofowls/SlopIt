import React, { useState } from 'react';

const BASE_URL = window.location.origin;

/**
 * ShareButton — uses Web Share API with clipboard fallback.
 * Props:
 *   slug  {string}  post slug for URL
 *   title {string}  post title for share sheet
 */
const ShareButton = ({ slug, title }) => {
  const [copied, setCopied] = useState(false);

  const shareUrl = slug ? `${BASE_URL}/post/${slug}` : BASE_URL;
  const shareText = title || 'Check this out on SlopIt';

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy link:', shareUrl);
    }
  };

  return (
    <button
      className="post-action"
      onClick={handleShare}
      aria-label="Share post"
      title={copied ? 'Copied!' : 'Share'}
    >
      <span className="action-icon">{copied ? '✅' : '🔗'}</span>
      {copied && <span className="action-count">copied!</span>}
    </button>
  );
};

export default ShareButton;
