"""Root URL configuration."""

from __future__ import annotations

from apps.accounts.telegram_auth import telegram_callback, telegram_login_redirect
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView

from config.smoke_tests import smoke_test_view


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


urlpatterns = [
    path("", system_status, name="root-status"),
    path("admin/", admin.site.urls),
    path("tests", smoke_test_view, name="smoke-tests"),
    path("accounts/telegram/login/", telegram_login_redirect, name="telegram-login"),
    path("accounts/telegram/login/callback/", telegram_callback, name="telegram-callback"),
    path("api/v1/system/status", system_status, name="system-status"),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/", include("apps.api.urls")),
]

from django.conf import settings as _settings  # noqa: E402

if getattr(_settings, "RQ_QUEUES", {}) and any(
    "URL" in q or not q.get("IS_ASYNC", True) for q in _settings.RQ_QUEUES.values() if "URL" in q
):
    urlpatterns += [path("django-rq/", include("django_rq.urls"))]
