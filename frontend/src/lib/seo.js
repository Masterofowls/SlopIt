export const SITE_URL =
  import.meta.env.VITE_SITE_URL || "https://peaceful-flower-536.fly.dev";

export const SITE_NAME = "SlopIt";

export const DEFAULT_DESCRIPTION =
  "SlopIt is a chaotic social feed where users post, react, and browse trending slop.";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/icons.svg`;

export const DEFAULT_SEO = {
  title: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
  path: "/",
  image: DEFAULT_OG_IMAGE,
  type: "website",
};

export function buildPageTitle(title) {
  if (!title || title === SITE_NAME) return SITE_NAME;
  return `${title} | ${SITE_NAME}`;
}

export function buildCanonicalUrl(path = "/") {
  if (!path || path === "/") return `${SITE_URL}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function truncateDescription(text, maxLen = 160) {
  if (!text) return DEFAULT_DESCRIPTION;
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

export function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const apiBase = import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev";
  return url.startsWith("/") ? `${apiBase}${url}` : `${apiBase}/${url}`;
}
