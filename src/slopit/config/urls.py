"""Root URL configuration."""

from __future__ import annotations

from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponse, JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView

from apps.pages.sitemaps import StaticPageSitemap, StaticViewSitemap

_VERSION = "0.7.0-stage7"


def system_status(_request: object) -> JsonResponse:
    """Health-check endpoint (Fly.io healthcheck + frontend readiness probe)."""
    from django.conf import settings

    return JsonResponse(
        {
            "ok": not settings.MAINTENANCE_MODE,
            "maintenance": settings.MAINTENANCE_MODE,
            "version": _VERSION,
        },
        status=503 if settings.MAINTENANCE_MODE else 200,
    )


def api_landing(request: object) -> HttpResponse:
    """Minimal landing page — quick visual check that the API is alive."""
    from django.conf import settings

    ok = not settings.MAINTENANCE_MODE
    status_label = "🟢 running" if ok else "🔴 maintenance"
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SlopIt API</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:system-ui,sans-serif;background:#0f0f0f;color:#e8e8e8;
        display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}}
  .card{{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;
         padding:2rem 2.5rem;max-width:480px;width:100%}}
  h1{{font-size:1.6rem;font-weight:700;margin-bottom:.25rem}}
  .ver{{font-size:.8rem;color:#666;margin-bottom:1.5rem}}
  .status{{display:inline-block;font-size:.9rem;background:#111;
           border:1px solid #333;border-radius:6px;padding:.3rem .75rem;margin-bottom:1.5rem}}
  ul{{list-style:none;display:flex;flex-direction:column;gap:.4rem}}
  li a{{color:#7eb8f7;text-decoration:none;font-size:.875rem;font-family:monospace}}
  li a:hover{{text-decoration:underline}}
  .label{{color:#666;font-size:.75rem;margin-right:.5rem}}
</style>
</head>
<body>
<div class="card">
  <h1>SlopIt API</h1>
  <div class="ver">v{_VERSION}</div>
  <div class="status">{status_label}</div>
  <ul>
    <li><span class="label">health</span><a href="/api/v1/system/status">/api/v1/system/status</a></li>
    <li><span class="label">schema</span><a href="/api/v1/schema/">/api/v1/schema/</a></li>
    <li><span class="label">redoc</span><a href="/api/v1/redoc/">/api/v1/redoc/</a></li>
    <li><span class="label">admin</span><a href="/admin/">/admin/</a></li>
    <li><span class="label">feed</span><a href="/api/v1/feed/">/api/v1/feed/</a></li>
    <li><span class="label">posts</span><a href="/api/v1/posts/">/api/v1/posts/</a></li>
    <li><span class="label">tags</span><a href="/api/v1/tags/">/api/v1/tags/</a></li>
    <li><span class="label">me</span><a href="/api/v1/me/">/api/v1/me/</a></li>
    <li><span class="label">auth</span><a href="/api/v1/auth/session/">/api/v1/auth/session/</a></li>
  </ul>
</div>
</body>
</html>"""
    return HttpResponse(html, content_type="text/html; charset=utf-8",
                        status=503 if not ok else 200)


_sitemaps = {
    "static-pages": StaticPageSitemap,
    "static-views": StaticViewSitemap,
}

urlpatterns = [
    # Root + docs landing
    path("", api_landing, name="landing"),
    path("api/v1/docs/", api_landing, name="api-landing"),
    # Admin
    path("admin/", admin.site.urls),
    # OAuth — AllAuth handles Google / GitHub / Telegram callbacks.
    path("accounts/", include("allauth.urls")),
    # AllAuth headless API (WebAuthn passkey registration + TOTP).
    path("api/v1/_allauth/", include("allauth.headless.urls")),
    # System / health-check
    path("api/v1/system/status", system_status, name="system-status"),
    # OpenAPI schema + redoc (Swagger UI removed — use redoc or curl the schema)
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
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
