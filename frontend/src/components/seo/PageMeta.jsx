import { useEffect } from "react";
import {
  DEFAULT_SEO,
  SITE_NAME,
  buildCanonicalUrl,
  buildPageTitle,
} from "../../lib/seo.js";

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

function applyPageMeta({
  title,
  description,
  path,
  image,
  type,
}) {
  const pageTitle = buildPageTitle(title);
  const canonical = buildCanonicalUrl(path);

  document.title = pageTitle;
  upsertMeta("name", "description", description);
  upsertLink("canonical", canonical);

  upsertMeta("property", "og:title", pageTitle);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:site_name", SITE_NAME);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", pageTitle);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", image);
}

export default function PageMeta({
  title = DEFAULT_SEO.title,
  description = DEFAULT_SEO.description,
  path = DEFAULT_SEO.path,
  image = DEFAULT_SEO.image,
  type = DEFAULT_SEO.type,
}) {
  useEffect(() => {
    applyPageMeta({ title, description, path, image, type });

    return () => {
      applyPageMeta(DEFAULT_SEO);
    };
  }, [title, description, path, image, type]);

  return null;
}
