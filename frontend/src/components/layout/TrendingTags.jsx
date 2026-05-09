import { useEffect, useState } from "react";
import { useProtectedApi } from "../../hooks/useProtectedApi";
import "./TrendingTags.css";

export default function TrendingTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const { get } = useProtectedApi();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await get("/trending-tags/");
        if (!cancelled && Array.isArray(data)) {
          setTags(data.slice(0, 10));
        }
      } catch {
        /* silently degrade */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [get]);

  if (loading) {
    return (
      <aside className="trending-tags trending-tags--loading">
        <h3 className="trending-tags-title">▶ TRENDING</h3>
        <p className="trending-tags-scanning">SCANNING NETWORK...</p>
      </aside>
    );
  }

  if (!tags.length) return null;

  const maxCount = tags[0]?.count ?? 1;

  return (
    <aside className="trending-tags">
      <h3 className="trending-tags-title">▶ TRENDING</h3>
      <ul className="trending-tags-list">
        {tags.map(({ tag, count }, i) => {
          const intensity = Math.round((count / maxCount) * 100);
          return (
            <li
              key={tag}
              className="trending-tag-item"
              style={{ "--intensity": `${intensity}%` }}
            >
              <span className="trending-tag-rank">#{i + 1}</span>
              <span className="trending-tag-name">{tag}</span>
              <span className="trending-tag-count">({count})</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
