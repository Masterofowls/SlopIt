import { useState, useEffect, useCallback } from "react";
import { getSession, logout as authLogout } from "../api/auth.js";

const SESSION_CACHE_MS = 4000;
let sharedSession = null;
let sharedFetchedAt = 0;
let sharedRefreshPromise = null;

function normalizeSession(raw) {
  const payload = raw?.data ?? raw;
  const user =
    payload?.user ?? payload?.session?.user ?? payload?.account?.user ?? null;
  const authFlag =
    payload?.authenticated ??
    payload?.isAuthenticated ??
    payload?.session?.authenticated;
  const hasUser = Boolean(user);
  const isAuthenticated =
    typeof authFlag === "boolean" ? authFlag : Boolean(hasUser);

  return isAuthenticated && hasUser ? { ...payload, user } : null;
}

async function fetchSharedSession() {
  if (!sharedRefreshPromise) {
    sharedRefreshPromise = (async () => {
      const raw = await getSession();
      const nextSession = normalizeSession(raw);

      sharedSession = nextSession;
      sharedFetchedAt = Date.now();

      return { raw, nextSession };
    })().finally(() => {
      sharedRefreshPromise = null;
    });
  }

  return sharedRefreshPromise;
}

export function useSession() {
  const [session, setSession] = useState(sharedSession);
  const [isPending, setIsPending] = useState(() => !sharedFetchedAt);
  const [error, setError] = useState(null);

  const refreshSession = useCallback(async (force = false) => {
    console.debug("[auth] refreshSession:start", {
      path: window.location.pathname,
      href: window.location.href,
      force,
    });

    const cacheAge = Date.now() - sharedFetchedAt;
    if (!force && sharedFetchedAt && cacheAge < SESSION_CACHE_MS) {
      setSession(sharedSession);
      setError(null);
      setIsPending(false);
      console.debug("[auth] refreshSession:cache-hit", {
        cacheAge,
        hasSession: Boolean(sharedSession),
      });
      return sharedSession;
    }

    try {
      const { raw, nextSession } = await fetchSharedSession();

      setSession(nextSession);
      setError(null);

      if (nextSession) {
        sessionStorage.setItem("auth:last_status", "success");
        console.info("[auth] refreshSession:authenticated", {
          username: nextSession.user?.username,
          userId: nextSession.user?.id,
          raw,
        });
      } else {
        sessionStorage.setItem("auth:last_status", "unauthenticated");
        console.warn("[auth] refreshSession:unauthenticated", { raw });
      }

      return nextSession;
    } catch (err) {
      setError(err);
      setSession(null);
      sessionStorage.setItem("auth:last_status", "error");
      console.error("[auth] refreshSession:error", err);
      return null;
    } finally {
      setIsPending(false);
      console.debug("[auth] refreshSession:done");
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (credentials) => {
    console.debug("[auth] login:manual-login-not-configured", {
      hasCredentials: Boolean(credentials),
    });
    return refreshSession();
  };

  const logout = async () => {
    console.debug("[auth] logout:start");
    await authLogout();
    sharedSession = null;
    sharedFetchedAt = Date.now();
    setSession(null);
    sessionStorage.setItem("auth:last_status", "logged_out");
    console.info("[auth] logout:success");
  };

  return {
    session,
    isPending,
    error,
    login,
    logout,
    refreshSession,
  };
}
