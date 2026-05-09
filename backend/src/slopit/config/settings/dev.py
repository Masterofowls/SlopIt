"""Development settings — overrides base."""

from __future__ import annotations

from .base import *
from .base import env

DEBUG = True
ALLOWED_HOSTS = ["*"]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "django.db.backends": {"handlers": ["console"], "level": "WARNING"},
    },
}

INTERNAL_IPS = ["127.0.0.1"]

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)

MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN = True
