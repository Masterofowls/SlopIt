"""Stage 3 — Native OAuth checklist: Google / GitHub / Telegram.

All tests are pure import / unit / settings checks — no DB or HTTP required.
"""

from __future__ import annotations

import django

django.setup()


# ─── Provider installation ────────────────────────────────────────────────────


class TestOAuthInstalledApps:
    def test_google_provider_installed(self) -> None:
        from django.conf import settings

        assert "allauth.socialaccount.providers.google" in settings.INSTALLED_APPS

    def test_github_provider_installed(self) -> None:
        from django.conf import settings

        assert "allauth.socialaccount.providers.github" in settings.INSTALLED_APPS

    def test_telegram_provider_installed(self) -> None:
        from django.conf import settings

        assert "allauth.socialaccount.providers.telegram" in settings.INSTALLED_APPS

    def test_allauth_headless_installed(self) -> None:
        from django.conf import settings

        assert "allauth.headless" in settings.INSTALLED_APPS

    def test_django_sites_installed(self) -> None:
        from django.conf import settings

        assert "django.contrib.sites" in settings.INSTALLED_APPS
        assert settings.SITE_ID == 1


# ─── Provider credentials ────────────────────────────────────────────────────


class TestOAuthProviderConfig:
    def test_google_has_app_section(self) -> None:
        from django.conf import settings

        google = settings.SOCIALACCOUNT_PROVIDERS["google"]
        assert "APP" in google, "Google APP block missing — set GOOGLE_OAUTH_CLIENT_ID/SECRET"
        assert "client_id" in google["APP"]
        assert "secret" in google["APP"]

    def test_google_pkce_enabled(self) -> None:
        from django.conf import settings

        google = settings.SOCIALACCOUNT_PROVIDERS["google"]
        assert google.get("OAUTH_PKCE_ENABLED") is True

    def test_google_requests_profile_and_email_scope(self) -> None:
        from django.conf import settings

        scopes = settings.SOCIALACCOUNT_PROVIDERS["google"]["SCOPE"]
        assert "profile" in scopes
        assert "email" in scopes

    def test_github_has_app_section(self) -> None:
        from django.conf import settings

        github = settings.SOCIALACCOUNT_PROVIDERS["github"]
        assert "APP" in github, "GitHub APP block missing — set GITHUB_OAUTH_CLIENT_ID/SECRET"
        assert "client_id" in github["APP"]
        assert "secret" in github["APP"]

    def test_github_requests_email_scope(self) -> None:
        from django.conf import settings

        scopes = settings.SOCIALACCOUNT_PROVIDERS["github"]["SCOPE"]
        assert "user:email" in scopes

    def test_telegram_has_bot_token_key(self) -> None:
        from django.conf import settings

        telegram = settings.SOCIALACCOUNT_PROVIDERS["telegram"]
        assert "BOT_TOKEN" in telegram, "TELEGRAM_BOT_TOKEN env var not wired"
        assert "BOT_USERNAME" in telegram, "TELEGRAM_BOT_USERNAME env var not wired"


# ─── Adapter ─────────────────────────────────────────────────────────────────


class TestSocialAccountAdapter:
    def test_adapter_setting_configured(self) -> None:
        from django.conf import settings

        assert settings.SOCIALACCOUNT_ADAPTER == "apps.accounts.adapter.SocialAccountAdapter"

    def test_adapter_importable(self) -> None:
        from apps.accounts.adapter import SocialAccountAdapter

        assert SocialAccountAdapter is not None

    def test_adapter_subclasses_default(self) -> None:
        from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
        from apps.accounts.adapter import SocialAccountAdapter

        assert issubclass(SocialAccountAdapter, DefaultSocialAccountAdapter)

    def test_adapter_redirect_returns_frontend_url(self) -> None:
        from unittest.mock import MagicMock

        from apps.accounts.adapter import SocialAccountAdapter
        from django.conf import settings

        adapter = SocialAccountAdapter()
        redirect = adapter.get_login_redirect_url(MagicMock())
        assert redirect == settings.FRONTEND_URL

    def test_adapter_syncs_google_avatar(self) -> None:
        from unittest.mock import MagicMock, patch

        from apps.accounts.adapter import SocialAccountAdapter

        account = MagicMock()
        account.provider = "google"
        account.extra_data = {"picture": "https://lh3.googleusercontent.com/photo.jpg"}
        sociallogin = MagicMock()
        sociallogin.account = account
        user = MagicMock()
        user.pk = 42

        adapter = SocialAccountAdapter()
        with patch("apps.accounts.adapter.Profile") as mock_profile:
            adapter._sync_avatar(sociallogin, user=user)
            mock_profile.objects.filter.assert_called_once_with(user_id=42)
            mock_profile.objects.filter.return_value.update.assert_called_once_with(
                social_avatar_url="https://lh3.googleusercontent.com/photo.jpg"
            )

    def test_adapter_syncs_github_avatar(self) -> None:
        from unittest.mock import MagicMock, patch

        from apps.accounts.adapter import SocialAccountAdapter

        account = MagicMock()
        account.provider = "github"
        account.extra_data = {"avatar_url": "https://avatars.githubusercontent.com/u/1"}
        sociallogin = MagicMock()
        sociallogin.account = account
        user = MagicMock()
        user.pk = 7

        adapter = SocialAccountAdapter()
        with patch("apps.accounts.adapter.Profile") as mock_profile:
            adapter._sync_avatar(sociallogin, user=user)
            mock_profile.objects.filter.return_value.update.assert_called_once_with(
                social_avatar_url="https://avatars.githubusercontent.com/u/1"
            )

    def test_adapter_syncs_telegram_avatar(self) -> None:
        from unittest.mock import MagicMock, patch

        from apps.accounts.adapter import SocialAccountAdapter

        account = MagicMock()
        account.provider = "telegram"
        account.extra_data = {"photo_url": "https://t.me/i/userpic/photo.jpg"}
        sociallogin = MagicMock()
        sociallogin.account = account
        user = MagicMock()
        user.pk = 3

        adapter = SocialAccountAdapter()
        with patch("apps.accounts.adapter.Profile") as mock_profile:
            adapter._sync_avatar(sociallogin, user=user)
            mock_profile.objects.filter.return_value.update.assert_called_once_with(
                social_avatar_url="https://t.me/i/userpic/photo.jpg"
            )

    def test_adapter_skips_sync_when_no_avatar_key(self) -> None:
        from unittest.mock import MagicMock, patch

        from apps.accounts.adapter import SocialAccountAdapter

        account = MagicMock()
        account.provider = "google"
        account.extra_data = {}
        sociallogin = MagicMock()
        sociallogin.account = account
        user = MagicMock()
        user.pk = 1

        adapter = SocialAccountAdapter()
        with patch("apps.accounts.adapter.Profile") as mock_profile:
            adapter._sync_avatar(sociallogin, user=user)
            mock_profile.objects.filter.assert_not_called()

    def test_adapter_get_app_falls_back_when_multiple_apps_found(self) -> None:
        from types import SimpleNamespace
        from unittest.mock import patch

        from apps.accounts.adapter import SocialAccountAdapter
        from django.core.exceptions import MultipleObjectsReturned

        adapter = SocialAccountAdapter()
        db_old = SimpleNamespace(pk=1, settings={})
        db_new = SimpleNamespace(pk=9, settings={})
        settings_app = SimpleNamespace(pk=None, settings={})

        with (
            patch(
                "allauth.socialaccount.adapter.DefaultSocialAccountAdapter.get_app",
                side_effect=MultipleObjectsReturned,
            ),
            patch.object(adapter, "list_apps", return_value=[settings_app, db_old, db_new]),
        ):
            selected = adapter.get_app(request=None, provider="github")

        assert selected is db_new

    def test_adapter_get_app_ignores_hidden_entries_in_fallback(self) -> None:
        from types import SimpleNamespace
        from unittest.mock import patch

        from apps.accounts.adapter import SocialAccountAdapter
        from django.core.exceptions import MultipleObjectsReturned

        adapter = SocialAccountAdapter()
        hidden = SimpleNamespace(pk=7, settings={"hidden": True})
        visible = SimpleNamespace(pk=3, settings={})

        with (
            patch(
                "allauth.socialaccount.adapter.DefaultSocialAccountAdapter.get_app",
                side_effect=MultipleObjectsReturned,
            ),
            patch.object(adapter, "list_apps", return_value=[hidden, visible]),
        ):
            selected = adapter.get_app(request=None, provider="github")

        assert selected is visible


# ─── Auth settings ────────────────────────────────────────────────────────────


class TestOAuthAuthSettings:
    def test_login_redirect_url_equals_frontend_url(self) -> None:
        from django.conf import settings

        assert settings.LOGIN_REDIRECT_URL == settings.FRONTEND_URL

    def test_logout_redirect_url_equals_frontend_url(self) -> None:
        from django.conf import settings

        assert settings.ACCOUNT_LOGOUT_REDIRECT_URL == settings.FRONTEND_URL

    def test_email_auto_connect_enabled(self) -> None:
        from django.conf import settings

        assert settings.SOCIALACCOUNT_EMAIL_AUTHENTICATION is True
        assert settings.SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT is True

    def test_headless_frontend_urls_has_social_error(self) -> None:
        from django.conf import settings

        assert "socialaccount_login_error" in settings.HEADLESS_FRONTEND_URLS

    def test_headless_token_strategy_is_sessions(self) -> None:
        from django.conf import settings

        assert settings.HEADLESS_TOKEN_STRATEGY == "allauth.headless.tokens.sessions"  # noqa: S105

    def test_cors_allows_credentials(self) -> None:
        from django.conf import settings

        assert settings.CORS_ALLOW_CREDENTIALS is True

    def test_session_cookie_httponly(self) -> None:
        from django.conf import settings

        assert settings.SESSION_COOKIE_HTTPONLY is True


# ─── URL wiring ───────────────────────────────────────────────────────────────


class TestOAuthURLWiring:
    def test_allauth_account_login_resolves(self) -> None:
        from django.urls import reverse

        url = reverse("account_login")
        assert url.startswith("/accounts/")

    def test_google_login_url_resolves(self) -> None:
        from django.urls import reverse

        url = reverse("google_login")
        assert url == "/accounts/google/login/"

    def test_github_login_url_resolves(self) -> None:
        from django.urls import reverse

        url = reverse("github_login")
        assert url == "/accounts/github/login/"

    def test_telegram_login_url_resolves(self) -> None:
        from django.urls import reverse

        url = reverse("telegram_login")
        assert url == "/accounts/telegram/login/"

    def test_headless_api_url_resolves(self) -> None:
        from django.urls import reverse

        url = reverse("headless:browser:account:login")
        assert url.startswith("/api/v1/_allauth/")

    def test_auth_providers_endpoint_lists_all_three(self) -> None:
        from unittest.mock import MagicMock

        from apps.accounts.auth_views import AuthProvidersView
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.get("/api/v1/auth/providers/")
        request.user = MagicMock(is_authenticated=False)
        response = AuthProvidersView.as_view()(request)

        assert response.status_code == 200
        provider_ids = {p["id"] for p in response.data["providers"]}
        assert "google" in provider_ids
        assert "github" in provider_ids
        assert "telegram" in provider_ids


# ─── Profile model ────────────────────────────────────────────────────────────


class TestProfileSocialAvatarField:
    def test_profile_has_social_avatar_url_field(self) -> None:
        from apps.accounts.models import Profile

        field = Profile._meta.get_field("social_avatar_url")
        assert field is not None
        assert field.blank is True

    def test_serializer_exposes_social_avatar_url(self) -> None:
        from apps.accounts.serializers import ProfileSerializer

        assert "social_avatar_url" in ProfileSerializer().fields

    def test_serializer_avatar_url_falls_back_to_social(self) -> None:
        from unittest.mock import MagicMock

        from apps.accounts.serializers import ProfileSerializer

        profile = MagicMock()
        profile.avatar = None
        profile.social_avatar_url = "https://example.com/avatar.jpg"

        serializer = ProfileSerializer(profile, context={"request": None})
        assert serializer.get_avatar_url(profile) == "https://example.com/avatar.jpg"

    def test_serializer_avatar_url_prefers_uploaded_file(self) -> None:
        from unittest.mock import MagicMock

        from apps.accounts.serializers import ProfileSerializer

        request = MagicMock()
        request.build_absolute_uri.return_value = "https://cdn.example.com/avatars/a.jpg"

        profile = MagicMock()
        profile.avatar = MagicMock()
        profile.avatar.url = "/media/avatars/a.jpg"
        profile.social_avatar_url = "https://social.example.com/pic.jpg"

        serializer = ProfileSerializer(profile, context={"request": request})
        result = serializer.get_avatar_url(profile)
        assert result == "https://cdn.example.com/avatars/a.jpg"
