"""Sitemap classes for the pages app.

Registered in config/urls.py under /sitemap.xml.
See Django docs: https://docs.djangoproject.com/en/5.1/ref/contrib/sitemaps/
"""

from __future__ import annotations

from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from .models import StaticPage


class StaticPageSitemap(Sitemap):
    """Sitemap for CMS-managed static pages (landing, about, licenses, …)."""

    changefreq = "weekly"
    priority = 0.7
    protocol = "https"

    def items(self) -> object:
        return StaticPage.objects.filter(is_active=True).order_by("slug")

    def location(self, item: StaticPage) -> str:  # type: ignore[override]
        # The React SPA handles routing; we emit clean paths for crawlers.
        return f"/{item.slug}/"

    def lastmod(self, item: StaticPage) -> object:  # type: ignore[override]
        return item.updated_at


class StaticViewSitemap(Sitemap):
    """Sitemap for well-known Django-served routes (API schema, docs)."""

    changefreq = "monthly"
    protocol = "https"

    # Named URL → priority override
    _entries: list[tuple[str, float]] = [
        ("system-status", 0.1),
        ("swagger-ui", 0.4),
        ("redoc", 0.4),
    ]

    def items(self) -> list[str]:
        return [name for name, _ in self._entries]

    def location(self, item: str) -> str:  # type: ignore[override]
        return reverse(item)

    def priority(self, item: str) -> float:  # type: ignore[override]
        return dict(self._entries).get(item, 0.3)
