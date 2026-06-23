#!/usr/bin/env node
/**
 * Build-time sitemap generator: static routes + published post slugs from API.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "public", "sitemap.xml");

const SITE_URL =
  process.env.VITE_SITE_URL || "https://peaceful-flower-536.fly.dev";
const API_URL =
  process.env.VITE_API_URL || "https://slopit-api.fly.dev";

const STATIC_ROUTES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/home", changefreq: "hourly", priority: "0.9" },
  { loc: "/search", changefreq: "daily", priority: "0.7" },
];

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchPublishedSlugs() {
  const slugs = [];
  let page = 1;

  while (page <= 50) {
    const url = `${API_URL}/api/v1/posts/?limit=100&page=${page}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn(`sitemap: posts API returned ${res.status}, skipping posts`);
      break;
    }

    const data = await res.json();
    for (const post of data.results ?? []) {
      if (post.slug) slugs.push(post.slug);
    }

    if (!data.next) break;
    page += 1;
  }

  return slugs;
}

function buildXml(urls) {
  const body = urls
    .map(
      (entry) => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

async function main() {
  const urls = STATIC_ROUTES.map((route) => ({
    loc: `${SITE_URL}${route.loc === "/" ? "/" : route.loc}`,
    changefreq: route.changefreq,
    priority: route.priority,
  }));

  try {
    const slugs = await fetchPublishedSlugs();
    for (const slug of slugs) {
      urls.push({
        loc: `${SITE_URL}/post/${encodeURIComponent(slug)}`,
        changefreq: "weekly",
        priority: "0.8",
      });
    }
    console.log(`sitemap: ${urls.length} URLs (${slugs.length} posts)`);
  } catch (err) {
    console.warn("sitemap: failed to fetch posts, using static routes only", err);
  }

  writeFileSync(OUT_PATH, buildXml(urls), "utf8");
  console.log(`wrote ${OUT_PATH}`);
}

main();
