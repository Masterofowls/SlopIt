from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BASE_DIR.parent.parent

env = environ.Env()
env_file = PROJECT_ROOT / ".env"
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-key-change-me")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS: list[str] = [
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    "unfold.contrib.inlines",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "django.contrib.postgres",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.github",
    "allauth.socialaccount.providers.telegram",
    "allauth.mfa",
    "allauth.headless",
    "django_rq",
    "django_extensions",
    "apps.accounts",
    "apps.posts",
    "apps.comments",
    "apps.reactions",
    "apps.feed",
    "apps.api",
    "apps.bot",
]

SITE_ID = 1
AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE: list[str] = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": env.db_url(
        "DATABASE_URL",
        default="postgres://postgres:postgres@localhost:5432/slopit",
    ),
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("DJANGO_TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = PROJECT_ROOT / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = PROJECT_ROOT / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

FEED_DEFAULT_LIFETIME_HOURS = env.int("FEED_DEFAULT_LIFETIME_HOURS", default=10)
FEED_MIN_LIFETIME_HOURS = env.int("FEED_MIN_LIFETIME_HOURS", default=10)
FEED_MAX_LIFETIME_HOURS = env.int("FEED_MAX_LIFETIME_HOURS", default=48)
FEED_PAGE_SIZE = env.int("FEED_PAGE_SIZE", default=25)


def _origin_from_url(url: str) -> str:
    parts = urlsplit(url)
    if parts.scheme and parts.netloc:
        return f"{parts.scheme}://{parts.netloc}"
    return url


FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")
FRONTEND_ORIGIN = _origin_from_url(FRONTEND_URL)
CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN]
if FRONTEND_ORIGIN not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_ORIGIN)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"]
CORS_ALLOWED_HEADERS = ["accept", "authorization", "content-type", "x-csrftoken"]

# ─── Clerk ───────────────────────────────────────────────────────────────────
# Public values — also set in fly.toml [env] (safe to commit).
CLERK_PUBLISHABLE_KEY = env("CLERK_PUBLISHABLE_KEY", default="")
CLERK_FRONTEND_API_URL = env("CLERK_FRONTEND_API_URL", default="")
CLERK_JWKS_URL = env(
    "CLERK_JWKS_URL",
    default="https://quick-bulldog-91.clerk.accounts.dev/.well-known/jwks.json",
)
# Secret — set via: flyctl secrets set CLERK_SECRET_KEY=sk_test_...
CLERK_SECRET_KEY = env("CLERK_SECRET_KEY", default="")

# ─── Telegram ────────────────────────────────────────────────────────────────
# Public values — also set in fly.toml [env] (safe to commit).
TELEGRAM_CLIENT_ID = env("TELEGRAM_CLIENT_ID", default="8728778322")
TELEGRAM_BOT_NAME = env("TELEGRAM_BOT_NAME", default="slopitbot")
TELEGRAM_REDIRECT_URI = env(
    "TELEGRAM_REDIRECT_URI",
    default="https://slopit-api.fly.dev/accounts/telegram/login/callback/",
)
# Secrets — set via: flyctl secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CLIENT_SECRET=...
TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")
TELEGRAM_CLIENT_SECRET = env("TELEGRAM_CLIENT_SECRET", default="")

ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "username*", "password1*"]
ACCOUNT_LOGIN_BY_CODE_ENABLED = False
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True
SOCIALACCOUNT_LOGIN_ON_GET = True
LOGIN_REDIRECT_URL = FRONTEND_URL
ACCOUNT_LOGOUT_REDIRECT_URL = FRONTEND_URL

MFA_TOTP_ISSUER = "SlopIt"
MFA_TOTP_PERIOD = 30
MFA_TOTP_DIGITS = 6
MFA_WEBAUTHN_ALLOW_INSECURE_ORIGIN = False

HEADLESS_ONLY = False
HEADLESS_TOKEN_STRATEGY = "allauth.headless.tokens.sessions"
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": f"{FRONTEND_URL}/auth/verify-email/{{key}}",
    "account_reset_password": f"{FRONTEND_URL}/auth/reset-password",
    "account_reset_password_from_key": f"{FRONTEND_URL}/auth/reset-password/{{key}}",
    "account_signup": f"{FRONTEND_URL}/auth/signup",
    "socialaccount_login_error": f"{FRONTEND_URL}/auth/provider/callback",
}

ACCOUNT_DEFAULT_HTTP_PROTOCOL = "http"
SOCIALACCOUNT_ADAPTER = "apps.accounts.adapter.SocialAccountAdapter"

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": env("GOOGLE_OAUTH_CLIENT_ID", default=""),
            "secret": env("GOOGLE_OAUTH_CLIENT_SECRET", default=""),
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "OAUTH_PKCE_ENABLED": True,
    },
    "github": {
        "APP": {
            "client_id": env("GITHUB_OAUTH_CLIENT_ID", default=""),
            "secret": env("GITHUB_OAUTH_CLIENT_SECRET", default=""),
        },
        "SCOPE": ["user:email"],
    },
    "telegram": {
        "APP": {
            "client_id": env("TELEGRAM_OAUTH_CLIENT_ID", default=""),
            "secret": env("TELEGRAM_OAUTH_CLIENT_SECRET", default=""),
        },
        "BOT_TOKEN": env("TELEGRAM_BOT_TOKEN", default=""),
        "BOT_USERNAME": env("TELEGRAM_BOT_USERNAME", default=""),
    },
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # Clerk JWT first — used by the React SPA with Bearer tokens.
        "apps.accounts.clerk_auth.ClerkJWTAuthentication",
        # Session fallback — used by Django admin and the DRF browsable API.
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.CursorPagination",
    "PAGE_SIZE": env.int("FEED_PAGE_SIZE", default=25),
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "600/min",
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.api.exceptions.problem_json_exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SlopIt API",
    "DESCRIPTION": "Reddit-inspired social network with 3-level random feed algorithm.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
}


FEED_DEFAULT_LIFETIME_HOURS = env.int("FEED_DEFAULT_LIFETIME_HOURS", default=10)
FEED_MIN_LIFETIME_HOURS = env.int("FEED_MIN_LIFETIME_HOURS", default=10)
FEED_MAX_LIFETIME_HOURS = env.int("FEED_MAX_LIFETIME_HOURS", default=48)
FEED_PAGE_SIZE = env.int("FEED_PAGE_SIZE", default=25)
FEED_BUCKET_COUNT = 256

_REDIS_URL = env("REDIS_URL", default="")
_queue_defaults: dict = {"HOST": "localhost", "PORT": 6379, "DB": 0}
if _REDIS_URL:
    _queue_defaults = {"URL": _REDIS_URL}
else:
    _queue_defaults = {"HOST": "localhost", "PORT": 6379, "DB": 0, "IS_ASYNC": False}

RQ_QUEUES = {
    "default": _queue_defaults,
    "high": _queue_defaults,
    "low": _queue_defaults,
}

MAINTENANCE_MODE = env.bool("MAINTENANCE_MODE", default=False)

UNFOLD = {
    "SITE_TITLE": "SlopIt Admin",
    "SITE_HEADER": "SlopIt",
    "SITE_URL": "/",
    "SITE_ICON": None,
    "SITE_SYMBOL": "lightning_bolt",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "SHOW_BACK_BUTTON": True,
    "BORDER_RADIUS": "6px",
    "COLORS": {
        # Neutral grey scale (required since unfold 0.64 / Tailwind 4)
        "base": {
            "50": "oklch(98.5% .002 247.839)",
            "100": "oklch(96.7% .003 264.542)",
            "200": "oklch(92.8% .006 264.531)",
            "300": "oklch(87.2% .01 258.338)",
            "400": "oklch(70.7% .022 261.325)",
            "500": "oklch(55.1% .027 264.364)",
            "600": "oklch(44.6% .03 256.802)",
            "700": "oklch(37.3% .034 259.733)",
            "800": "oklch(27.8% .033 256.848)",
            "900": "oklch(21% .034 264.665)",
            "950": "oklch(13% .028 261.692)",
        },
        # Brand purple (violet Tailwind scale in oklch — matches original intent)
        "primary": {
            "50": "oklch(97.7% .014 308.299)",
            "100": "oklch(94.6% .033 307.174)",
            "200": "oklch(90.2% .063 306.703)",
            "300": "oklch(82.7% .119 306.383)",
            "400": "oklch(71.4% .203 305.504)",
            "500": "oklch(62.7% .265 303.9)",
            "600": "oklch(55.8% .288 302.321)",
            "700": "oklch(49.6% .265 301.924)",
            "800": "oklch(43.8% .218 303.724)",
            "900": "oklch(38.1% .176 304.987)",
            "950": "oklch(29.1% .149 302.717)",
        },
        # Semantic font aliases (required since unfold 0.64)
        "font": {
            "subtle-light": "var(--color-base-500)",
            "subtle-dark": "var(--color-base-400)",
            "default-light": "var(--color-base-600)",
            "default-dark": "var(--color-base-300)",
            "important-light": "var(--color-base-900)",
            "important-dark": "var(--color-base-100)",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "Content",
                "separator": False,
                "items": [
                    {"title": "Posts", "icon": "article", "link": "/admin/posts/post/"},
                    {"title": "Tags", "icon": "tag", "link": "/admin/posts/tag/"},
                    {"title": "Media", "icon": "image", "link": "/admin/posts/media/"},
                    {"title": "Comments", "icon": "chat", "link": "/admin/comments/comment/"},
                    {
                        "title": "Reactions",
                        "icon": "thumb_up",
                        "link": "/admin/reactions/reaction/",
                    },
                ],
            },
            {
                "title": "Users",
                "separator": True,
                "items": [
                    {"title": "Users", "icon": "person", "link": "/admin/accounts/user/"},
                    {"title": "Profiles", "icon": "badge", "link": "/admin/accounts/profile/"},
                    {"title": "Passkeys", "icon": "key", "link": "/admin/accounts/passkey/"},
                    {
                        "title": "Passphrases",
                        "icon": "lock",
                        "link": "/admin/accounts/passphrase/",
                    },
                ],
            },
            {
                "title": "Feed",
                "separator": True,
                "items": [
                    {
                        "title": "Preferences",
                        "icon": "tune",
                        "link": "/admin/feed/feedpreferences/",
                    },
                    {
                        "title": "Feed Meta (L1)",
                        "icon": "filter_1",
                        "link": "/admin/feed/postfeedmeta/",
                    },
                    {
                        "title": "Snapshots (L3)",
                        "icon": "filter_3",
                        "link": "/admin/feed/feedsnapshot/",
                    },
                ],
            },
        ],
    },
}
