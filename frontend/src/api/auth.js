import axios from "axios";

const isLocalFrontend = ["localhost", "127.0.0.1"].includes(
  window.location.hostname,
);

const defaultApiOrigin = isLocalFrontend
  ? "http://127.0.0.1:8000"
  : "https://slopit-api.fly.dev";

const envApiOrigin = import.meta.env.VITE_API_ORIGIN?.trim();
const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const pointsToLocalBackend = (value) =>
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(value ?? "") ||
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/v1$/i.test(value ?? "");

const API_ORIGIN =
  envApiOrigin && !(pointsToLocalBackend(envApiOrigin) && !isLocalFrontend)
    ? envApiOrigin
    : defaultApiOrigin;

const BASE =
  envApiBaseUrl && !(pointsToLocalBackend(envApiBaseUrl) && !isLocalFrontend)
    ? envApiBaseUrl
    : `${API_ORIGIN}/api/v1`;

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
    console.debug("[auth] getProviders:success", {
      count: data.providers?.length ?? 0,
      providerIds: (data.providers ?? []).map((provider) => provider.id),
    });
    return data.providers ?? [];
  } catch (error) {
    console.error("[auth] getProviders:error", error);
    return [];
  }
}

// ─── OAuth login ──────────────────────────────────────────────────────────────
// Redirect the full page to the backend OAuth entry point.
// After the OAuth callback AllAuth sets an HttpOnly session cookie
// and redirects back to FRONTEND_URL. The app then calls getSession()
// to hydrate auth state.

export function loginWithProvider(providerId) {
  const oauthUrl = `${API_ORIGIN}/accounts/${providerId}/login/`;
  console.info("[auth] loginWithProvider:redirect", {
    providerId,
    oauthUrl,
    currentUrl: window.location.href,
  });
  window.location.href = oauthUrl;
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout() {
  await fetchCsrf();
  await client.post("/auth/logout/");
}
