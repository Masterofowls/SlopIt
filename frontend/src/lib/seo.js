export const SITE_URL =
  import.meta.env.VITE_SITE_URL || "https://peaceful-flower-536.fly.dev";

export const SITE_NAME = "SlopIt";

export const SITE_TITLE =
  "SlopIt — Social Feed for Memes, Posts & Reactions";

export const DEFAULT_DESCRIPTION =
  "SlopIt is a chaotic social feed for posting memes, reacting with likes, browsing trending slop, polls, and community content. Join free.";

export const DEFAULT_KEYWORDS =
  "SlopIt, social feed, memes, posts, reactions, polls, community, trending content";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = "image/png";

export const DEFAULT_ROBOTS = "index, follow, max-image-preview:large";

export const DEFAULT_SEO = {
  title: SITE_TITLE,
  description: DEFAULT_DESCRIPTION,
  path: "/",
  image: DEFAULT_OG_IMAGE,
  type: "website",
  robots: DEFAULT_ROBOTS,
  keywords: DEFAULT_KEYWORDS,
};

export function buildPageTitle(pageTitle) {
  if (!pageTitle || pageTitle === SITE_NAME || pageTitle === SITE_TITLE) {
    return SITE_TITLE;
  }
  const suffix = ` | ${SITE_NAME}`;
  const combined = `${pageTitle}${suffix}`;
  if (combined.length <= 60) return combined;
  const trimmed = pageTitle.slice(0, Math.max(1, 60 - suffix.length - 1)).trim();
  return `${trimmed}${suffix}`;
}

export function buildCanonicalUrl(path = "/") {
  if (!path || path === "/") return `${SITE_URL}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function truncateDescription(text, maxLen = 160, minLen = 120) {
  if (!text) return DEFAULT_DESCRIPTION;
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  if (cleaned.length >= minLen && cleaned.length <= maxLen) return cleaned;
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

export function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const apiBase = import.meta.env.VITE_API_URL || "https://slopit-api.fly.dev";
  return url.startsWith("/") ? `${apiBase}${url}` : `${apiBase}/${url}`;
}

export function resolveOgImage(url) {
  if (!url) return DEFAULT_OG_IMAGE;
  const resolved = resolveMediaUrl(url);
  if (!resolved) return DEFAULT_OG_IMAGE;
  if (/\.(mp4|webm|mov|m4v|gif|svg)(\?|$)/i.test(resolved)) {
    return DEFAULT_OG_IMAGE;
  }
  return resolved;
}

export function resolvePostOgImage(post) {
  const visual = post?.media?.find(
    (item) => item.kind === "image" || item.kind === "gif",
  );
  if (visual?.file) {
    return resolveOgImage(visual.file);
  }
  return DEFAULT_OG_IMAGE;
}

export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "Web",
    description: DEFAULT_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE,
  };
}

export function buildArticleSchema({
  title,
  description,
  path,
  image,
  publishedAt,
  authorName,
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: title,
    description,
    url: buildCanonicalUrl(path),
    image,
    datePublished: publishedAt || undefined,
    author: {
      "@type": "Person",
      name: authorName || "SlopIt member",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: DEFAULT_OG_IMAGE,
      },
    },
    mainEntityOfPage: buildCanonicalUrl(path),
  };
}

export function buildDefaultSchemaGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationSchema(),
      buildWebsiteSchema(),
      buildWebApplicationSchema(),
    ],
  };
}

export function formatApiError(err, fallback = "Something went wrong. Please try again.") {
  const data = err?.response?.data;
  const detail = data?.detail;
  if (detail === "Not found." || detail === "Not found") {
    return fallback;
  }
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) {
    return data.non_field_errors[0];
  }
  if (data?.title?.[0]) return data.title[0];
  if (data?.body_markdown?.[0]) return data.body_markdown[0];
  return fallback;
}
