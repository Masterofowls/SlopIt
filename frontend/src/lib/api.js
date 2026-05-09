import axios from "axios";
import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev";

/**
 * Axios instance used for all API calls.
 * - Sends session cookies (withCredentials) so Telegram sessions work.
 * - CSRF interceptor reads the csrftoken cookie and adds it to mutating
 *   requests so Django's CSRF protection is satisfied for Telegram sessions.
 * - Clerk Bearer token is attached separately via useClerkInterceptor().
 */
export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Read a cookie by name
function getCookie(name) {
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

// Attach X-CSRFToken to all mutating requests (needed for Telegram/session auth)
api.interceptors.request.use((config) => {
  const safeMethods = ["get", "head", "options", "trace"];
  if (!safeMethods.includes((config.method ?? "get").toLowerCase())) {
    const csrf = getCookie("csrftoken");
    if (csrf) config.headers["X-CSRFToken"] = csrf;
  }
  return config;
});

/**
 * Mount this hook once inside <ClerkProvider> to attach the Clerk Bearer
 * token to every api request when the user is signed in via Clerk.
 * When the user is signed in via Telegram instead, getToken() returns null
 * and no Authorization header is added — the session cookie handles auth.
 */
export function useClerkInterceptor() {
  const { getToken } = useAuth();

  useEffect(() => {
    const id = api.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    });
    return () => api.interceptors.request.eject(id);
  }, [getToken]);
}

/** Standalone helper — pass token explicitly (for non-hook contexts). */
export async function apiFetchWithToken(path, token, init = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}
