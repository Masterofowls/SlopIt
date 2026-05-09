import React, { useState, useCallback, useRef } from "react";
import "./GiphyPicker.css";

const GIPHY_API_KEY =
  import.meta.env.VITE_GIPHY_API_KEY || "whgAeYFKkKMTgtPHXms13jmULWdxN6g7";

/**
 * GiphyPicker — modal panel to search Giphy and pick a GIF.
 *
 * Props:
 *   onSelect(gifUrl: string) — called with the original GIF URL
 *   onClose()               — called when the picker should close
 */
const GiphyPicker = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = new URL("https://api.giphy.com/v1/gifs/search");
      url.searchParams.set("api_key", GIPHY_API_KEY);
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "20");
      url.searchParams.set("rating", "g");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Giphy error ${res.status}`);
      const data = await res.json();
      setResults(data.data || []);
    } catch (err) {
      setError("Search failed. Try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 450);
  };

  const handleSelect = (gif) => {
    const url =
      gif.images?.original?.url ||
      gif.images?.fixed_height?.url ||
      gif.images?.downsized?.url;
    if (url) {
      onSelect(url);
    }
    onClose();
  };

  return (
    <div
      className="gp-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="GIF picker"
    >
      <div className="gp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="gp-header">
          <input
            className="gp-search"
            type="search"
            value={query}
            onChange={handleChange}
            placeholder="Search GIFs…"
            autoFocus
            aria-label="Search GIFs"
          />
          <button
            className="gp-close"
            onClick={onClose}
            aria-label="Close GIF picker"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="gp-body">
          {loading && <p className="gp-status">searching…</p>}
          {error && <p className="gp-status gp-error">{error}</p>}

          {!loading && results.length > 0 && (
            <div className="gp-grid">
              {results.map((gif) => {
                const thumb =
                  gif.images?.fixed_height_small?.url ||
                  gif.images?.fixed_height?.url;
                return (
                  <button
                    key={gif.id}
                    className="gp-thumb-btn"
                    type="button"
                    onClick={() => handleSelect(gif)}
                    aria-label={gif.title || "GIF"}
                  >
                    <img
                      className="gp-thumb"
                      src={thumb}
                      alt={gif.title || ""}
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && !error && (
            <p className="gp-status">no results for "{query}"</p>
          )}

          {!query.trim() && (
            <p className="gp-status">type something to search GIFs</p>
          )}
        </div>

        <p className="gp-powered">Powered by GIPHY</p>
      </div>
    </div>
  );
};

export default GiphyPicker;
