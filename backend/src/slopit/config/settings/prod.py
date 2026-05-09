"""Production settings — Fly.io + Supabase + GlitchTip."""

from __future__ import annotations

import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

from .base import *
from .base import env

DEBUG = False

ACCOUNT_DEFAULT_HTTP_PROTOCOL = "https"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
# Frontend and API run on different fly.dev hosts, so session auth requests
# from the SPA are cross-site and require SameSite=None cookies.
SESSION_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SAMESITE = "None"
WHITENOISE_MANIFEST_STRICT = False
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

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

# ---------------------------------------------------------------------------
# Supabase Storage — S3-compatible media backend
# Required env vars (set via fly secrets set):
#   SUPABASE_PROJECT_REF  — e.g. "abcdefghijklmnop" (from Supabase dashboard URL)
#   SUPABASE_STORAGE_KEY  — S3 access key (Supabase dashboard → Storage → S3 Access)
#   SUPABASE_STORAGE_SECRET — S3 secret key (same place)
#   SUPABASE_STORAGE_BUCKET — bucket name (default: slopit-media)
# ---------------------------------------------------------------------------
_supabase_ref = env("SUPABASE_PROJECT_REF", default="")
_supabase_bucket = env("SUPABASE_STORAGE_BUCKET", default="slopit-media")

if _supabase_ref:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": {
                "bucket_name": _supabase_bucket,
                "endpoint_url": (f"https://{_supabase_ref}.supabase.co/storage/v1/s3"),
                "access_key": env("SUPABASE_STORAGE_KEY", default=""),
                "secret_key": env("SUPABASE_STORAGE_SECRET", default=""),
                "region_name": "auto",
                "default_acl": "public-read",
                "file_overwrite": False,
                "querystring_auth": False,
                "custom_domain": (
                    f"{_supabase_ref}.supabase.co/storage/v1/object/public/{_supabase_bucket}"
                ),
            },
        },
        "staticfiles": {
            "BACKEND": ("whitenoise.storage.CompressedManifestStaticFilesStorage"),
        },
    }
    MEDIA_URL = f"https://{_supabase_ref}.supabase.co/storage/v1/object/public/{_supabase_bucket}/"
