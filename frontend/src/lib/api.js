import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev";

/**
 * React hook — returns an apiFetch function with the Clerk Bearer token
 * automatically attached to every request.
 *
 * Usage:
 *   const apiFetch = useApi();
 *   const data = await apiFetch('/api/v1/me/');
 */
export function useApi() {
  const { getToken } = useAuth();

  return async function apiFetch(path, init = {}) {
    const token = await getToken();
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (!res.ok)
      throw await res.json().catch(() => ({ error: res.statusText }));
    return res.json();
  };
}

// Standalone helper for non-hook contexts (e.g. server actions).
// Requires a token to be passed explicitly.
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
