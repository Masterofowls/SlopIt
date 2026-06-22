import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const FeedRefreshContext = createContext(null);

export const PENDING_FEED_REFRESH_KEY = "pendingFeedRefresh";

export function FeedRefreshProvider({ children }) {
  const handlerRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const registerRefreshHandler = useCallback((handler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) {
        handlerRef.current = null;
      }
    };
  }, []);

  const refreshFeed = useCallback(async () => {
    const handler = handlerRef.current;
    if (!handler || isRefreshing) {
      return Boolean(handler);
    }

    setIsRefreshing(true);
    try {
      await handler();
      return true;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return (
    <FeedRefreshContext.Provider
      value={{ registerRefreshHandler, refreshFeed, isRefreshing }}
    >
      {children}
    </FeedRefreshContext.Provider>
  );
}

export function useFeedRefresh() {
  const ctx = useContext(FeedRefreshContext);
  if (!ctx) {
    throw new Error("useFeedRefresh must be used within FeedRefreshProvider");
  }
  return ctx;
}
