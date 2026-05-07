import axios from "axios";

const isLocalFrontend = ["localhost", "127.0.0.1"].includes(
  window.location.hostname,
);

const defaultApiOrigin = isLocalFrontend
  ? "http://127.0.0.1:8000"
  : window.location.origin;

const envApiOrigin = import.meta.env.VITE_API_ORIGIN?.trim();
const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const pointsToLocalBackend = (value) =>
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(value ?? "") ||
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/v1$/i.test(value ?? "");

const isInsecureHttpUrl = (value) => {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value, window.location.origin);
    return (
      parsed.protocol === "http:" &&
      window.location.protocol === "https:" &&
      !isLocalFrontend
    );
  } catch {
    return false;
  }
};

const shouldUseEnvApiOrigin =
  Boolean(envApiOrigin) &&
  !(pointsToLocalBackend(envApiOrigin) && !isLocalFrontend) &&
  !isInsecureHttpUrl(envApiOrigin);

const API_ORIGIN =
  shouldUseEnvApiOrigin ? envApiOrigin : defaultApiOrigin;

const shouldUseEnvApiBaseUrl =
  Boolean(envApiBaseUrl) &&
  !(pointsToLocalBackend(envApiBaseUrl) && !isLocalFrontend) &&
  !isInsecureHttpUrl(envApiBaseUrl);

const BASE =
  shouldUseEnvApiBaseUrl ? envApiBaseUrl : `${API_ORIGIN}/api/v1`;

if ((envApiOrigin && !shouldUseEnvApiOrigin) || (envApiBaseUrl && !shouldUseEnvApiBaseUrl)) {
  console.warn("[auth] Ignoring insecure API env URL on HTTPS page", {
    envApiOrigin,
    envApiBaseUrl,
    resolvedBaseUrl: BASE,
  });
}

const client = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

export async function fetchCsrf() {
  const { data } = await client.get("/auth/csrf/");
  const token = data.csrfToken;
  client.defaults.headers.common["X-CSRFToken"] = token;
  return token;
}

export async function getSession() {
  try {
    const { data } = await client.get("/auth/session/");
    return data;
  } catch {
    return { authenticated: false, user: null };
  }
}


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


export function loginWithProvider(providerId, providerLoginUrl) {
  let oauthUrl = `${API_ORIGIN}/accounts/${providerId}/login/`;

  if (providerLoginUrl?.trim()) {
    try {
      const parsed = new URL(providerLoginUrl.trim());
      oauthUrl = `${window.location.origin}${parsed.pathname}${parsed.search}`;
    } catch {
      oauthUrl = providerLoginUrl.trim();
    }
  }

  console.info("[auth] loginWithProvider:redirect", {
    providerId,
    providerLoginUrl,
    oauthUrl,
    currentUrl: window.location.href,
  });
  window.location.href = oauthUrl;
}


export async function logout() {
  await fetchCsrf();
  await client.post("/auth/logout/");
}
