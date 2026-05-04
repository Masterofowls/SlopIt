"""Production settings — Fly.io + Supabase + GlitchTip."""

from __future__ import annotations

import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

from .base import *
from .base import env

DEBUG = False

# Hardened security
# HTTPS is enforced at the Fly.io edge (force_https = true in fly.toml).
# SECURE_SSL_REDIRECT must be False so internal health checks (HTTP on port
# 8000) are not redirected — Consul does not follow 301s.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# GlitchTip / Sentry SDK
GLITCHTIP_DSN = env("GLITCHTIP_DSN", default="")
if GLITCHTIP_DSN:
    sentry_sdk.init(
        dsn=GLITCHTIP_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "formatters": {
        "json": {
            "format": (
                '{"time":"%(asctime)s","level":"%(levelname)s",'
                '"name":"%(name)s","msg":"%(message)s"}'
            ),
        },
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
    },
}
