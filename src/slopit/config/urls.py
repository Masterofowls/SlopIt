"""Root URL configuration. Stage 6 — sitemap + Unfold admin."""

from __future__ import annotations

from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.http import JsonResponse
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.pages.sitemaps import StaticPageSitemap, StaticViewSitemap


def system_status(_request: object) -> JsonResponse:
    """Health-check endpoint (Fly.io healthcheck + frontend readiness probe)."""
    from django.conf import settings

    return JsonResponse(
        {
            "ok": not settings.MAINTENANCE_MODE,
            "maintenance": settings.MAINTENANCE_MODE,
            "version": "0.7.0-stage7",
        },
        status=503 if settings.MAINTENANCE_MODE else 200,
    )


_sitemaps = {
    "static-pages": StaticPageSitemap,
    "static-views": StaticViewSitemap,
}

urlpatterns = [
    # Root → API docs
    path("", RedirectView.as_view(url="/api/v1/docs/", permanent=False)),
    # Admin
    path("admin/", admin.site.urls),
    # OAuth — AllAuth handles Google / GitHub / Telegram callbacks.
    path("accounts/", include("allauth.urls")),
    # AllAuth headless API (WebAuthn passkey registration + TOTP).
    # Mounted at /api/v1/_allauth/ — see allauth docs for endpoint details.
    path("api/v1/_allauth/", include("allauth.headless.urls")),
    # System / health-check
    path("api/v1/system/status", system_status, name="system-status"),
    # OpenAPI schema + docs
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Sitemap
    path(
        "sitemap.xml",
        sitemap,
        {"sitemaps": _sitemaps},
        name="django.contrib.sitemaps.views.sitemap",
    ),
    # Stage 4: API viewsets
    path("api/v1/", include("apps.api.urls")),
]

# Mount django-rq dashboard only when Redis is actually configured.
from django.conf import settings as _settings  # noqa: E402

if getattr(_settings, "RQ_QUEUES", {}) and any(
    "URL" in q or not q.get("IS_ASYNC", True) for q in _settings.RQ_QUEUES.values() if "URL" in q
):
    urlpatterns += [path("django-rq/", include("django_rq.urls"))]
