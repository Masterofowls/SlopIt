import axios from "axios";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";
const BASE = import.meta.env.VITE_API_BASE_URL ?? `${API_ORIGIN}/api/v1`;

const client = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

// ─── CSRF ─────────────────────────────────────────────────────────────────────

export async function fetchCsrf() {
  const { data } = await client.get("/auth/csrf/");
  const token = data.csrfToken;
  client.defaults.headers.common["X-CSRFToken"] = token;
  return token;
}

// ─── Session ──────────────────────────────────────────────────────────────────
// Returns: { authenticated: bool, user: null | { id, username, profile: {...} } }

export async function getSession() {
  try {
    const { data } = await client.get("/auth/session/");
    return data;
  } catch {
    return { authenticated: false, user: null };
  }
}

// ─── Providers ────────────────────────────────────────────────────────────────
// Returns: [ { id: 'google'|'github'|'telegram', name: string, login_url: string } ]

export async function getProviders() {
  try {
    const { data } = await client.get("/auth/providers/");
    return data.providers ?? [];
  } catch {
    return [];
  }
}

// ─── OAuth login ──────────────────────────────────────────────────────────────
// Redirect the full page to the backend OAuth entry point.
// After the OAuth callback AllAuth sets an HttpOnly session cookie
// and redirects back to FRONTEND_URL. The app then calls getSession()
// to hydrate auth state.

export function loginWithProvider(providerId) {
  window.location.href = `${API_ORIGIN}/accounts/${providerId}/login/`;
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout() {
  await fetchCsrf();
  await client.post("/auth/logout/");
}
