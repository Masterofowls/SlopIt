import { useEffect } from "react";
import {
  DEFAULT_SEO,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_URL,
  buildCanonicalUrl,
  buildPageTitle,
  buildDefaultSchemaGraph,
} from "../../lib/seo.js";

const JSON_LD_ID = "slopit-json-ld";

function upsertMeta(attr, key, content) {
  if (content == null || content === "") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(schema) {
  let el = document.getElementById(JSON_LD_ID);
  if (!schema) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = JSON_LD_ID;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(schema);
}

function applyPageMeta({
  title,
  description,
  path,
  image,
  type,
  robots,
  keywords,
  schema,
}) {
  const pageTitle = buildPageTitle(title);
  const canonical = buildCanonicalUrl(path);
  const ogImage = image || DEFAULT_SEO.image;
  const ogImageType = /\.png(\?|$)/i.test(ogImage)
    ? "image/png"
    : /\.jpe?g(\?|$)/i.test(ogImage)
      ? "image/jpeg"
      : OG_IMAGE_TYPE;

  document.title = pageTitle;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", robots);
  upsertMeta("name", "keywords", keywords);
  upsertLink("canonical", canonical);

  upsertMeta("property", "og:title", pageTitle);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:image", ogImage);
  upsertMeta("property", "og:image:secure_url", ogImage);
  upsertMeta("property", "og:image:type", ogImageType);
  upsertMeta("property", "og:image:alt", `${SITE_NAME} social preview`);
  upsertMeta("property", "og:image:width", String(OG_IMAGE_WIDTH));
  upsertMeta("property", "og:image:height", String(OG_IMAGE_HEIGHT));
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:locale", "en_US");

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:site", "@slopit");
  upsertMeta("name", "twitter:title", pageTitle);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", ogImage);
  upsertMeta("name", "twitter:image:alt", `${SITE_NAME} social preview`);

  upsertLink("apple-touch-icon", `${SITE_URL}/icons/apple-touch-icon.png`);

  upsertJsonLd(schema ?? buildDefaultSchemaGraph());
}

export default function PageMeta({
  title = DEFAULT_SEO.title,
  description = DEFAULT_SEO.description,
  path = DEFAULT_SEO.path,
  image = DEFAULT_SEO.image,
  type = DEFAULT_SEO.type,
  robots = DEFAULT_SEO.robots,
  keywords = DEFAULT_SEO.keywords,
  schema,
}) {
  useEffect(() => {
    applyPageMeta({
      title,
      description,
      path,
      image,
      type,
      robots,
      keywords,
      schema,
    });

    return () => {
      applyPageMeta({ ...DEFAULT_SEO, schema: buildDefaultSchemaGraph() });
    };
  }, [title, description, path, image, type, robots, keywords, schema]);

  return null;
}
