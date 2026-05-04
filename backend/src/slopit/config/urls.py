"""Root URL configuration. Stage 6 — sitemap + Unfold admin."""

from __future__ import annotations

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import (
    SpectacularAPIView,
)


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


class FrontendRedirectView(RedirectView):
    """Redirect HTML login forms to frontend SPA. Backend is API-only."""

    permanent = False

    def get_redirect_url(self, *args: object, **kwargs: object) -> str:
        from django.conf import settings

        return settings.FRONTEND_URL


urlpatterns = [
    path("", system_status, name="root-status"),
    path("admin/", admin.site.urls),
    path("accounts/login/", FrontendRedirectView.as_view(), name="allauth-html-login"),
    path("accounts/", include("allauth.urls")),
    path("api/v1/_allauth/", include("allauth.headless.urls")),
    path("api/v1/system/status", system_status, name="system-status"),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/", include("apps.api.urls")),
]

from django.conf import settings as _settings  # noqa: E402

if getattr(_settings, "RQ_QUEUES", {}) and any(
    "URL" in q or not q.get("IS_ASYNC", True) for q in _settings.RQ_QUEUES.values() if "URL" in q
):
    urlpatterns += [path("django-rq/", include("django_rq.urls"))]
