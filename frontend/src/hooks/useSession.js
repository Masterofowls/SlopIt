import { useState, useEffect, useCallback } from "react";
import { getSession, logout as authLogout } from "../api/auth.js";

export function useSession() {
  const [session, setSession] = useState(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState(null);

  const refreshSession = useCallback(async () => {
    console.debug("[auth] refreshSession:start", {
      path: window.location.pathname,
      href: window.location.href,
    });

    try {
      const data = await getSession();
      const hasUser = Boolean(data?.authenticated && data?.user);
      const nextSession = hasUser ? data : null;

      setSession(nextSession);
      setError(null);

      if (nextSession) {
        sessionStorage.setItem("auth:last_status", "success");
        console.info("[auth] refreshSession:authenticated", {
          username: nextSession.user?.username,
          userId: nextSession.user?.id,
        });
      } else {
        sessionStorage.setItem("auth:last_status", "unauthenticated");
        console.warn("[auth] refreshSession:unauthenticated", { data });
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
