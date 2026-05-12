import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import PostFeed from '../components/posts/PostFeed';
import './SearchPage.css';

const PAGE_SIZE = 25;

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';

  const [posts, setPosts] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async (url) => {
    try {
      const res = await api.get(url);
      return res.data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Fresh search whenever query changes
  useEffect(() => {
    if (!query) {
      setPosts([]);
      setNextUrl(null);
      setTotal(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPosts([]);
    setNextUrl(null);

    fetchPosts(`/posts/?search=${encodeURIComponent(query)}&limit=${PAGE_SIZE}`)
      .then((data) => {
        if (cancelled) return;
        setPosts(data.results ?? []);
        setNextUrl(data.next ?? null);
        setTotal(data.count ?? 0);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load results. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [query, fetchPosts]);

  const handleLoadMore = useCallback(async () => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    try {
      // nextUrl is an absolute URL from DRF — strip to relative path + query
      const url = new URL(nextUrl);
      const data = await fetchPosts(url.pathname + url.search);
      setPosts((prev) => [...prev, ...(data.results ?? [])]);
      setNextUrl(data.next ?? null);
    } catch {
      // silent — user can scroll up and try again
    } finally {
      setLoadingMore(false);
    }
  }, [nextUrl, loadingMore, fetchPosts]);

  return (
    <div className="search-page">
      <div className="search-page-header">
        {query ? (
          <>
            <h2 className="search-page-title">
              search: <span className="search-query">{query}</span>
            </h2>
            {total !== null && !loading && (
              <p className="search-count">
                {total === 0
                  ? 'no results'
                  : `${total} result${total === 1 ? '' : 's'}`}
              </p>
            )}
          </>
        ) : (
          <h2 className="search-page-title">type something to search</h2>
        )}
      </div>

      {loading && (
        <div className="search-loading">
          <span className="search-loading-dots">searching</span>
        </div>
      )}

      {error && <p className="search-error">{error}</p>}

      {!loading && !error && query && (
        <PostFeed
          posts={posts}
          onLoadMore={handleLoadMore}
          hasMore={Boolean(nextUrl)}
          loadingMore={loadingMore}
        />
      )}
    </div>
  );
}
