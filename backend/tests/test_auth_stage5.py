"""Stage 5 tests — Auth views and passphrase validation."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from rest_framework.test import APIRequestFactory

# ─── Helpers ─────────────────────────────────────────────────────────────────


_factory = APIRequestFactory()  # sets _dont_enforce_csrf_checks=True


def _anon(method: str, path: str, data=None):
    """Create an unauthenticated API request."""
    req = getattr(_factory, method)(path, data or {}, format="json")
    req.user = MagicMock(is_authenticated=False)
    return req


def _auth(method: str, path: str, data=None):
    """Create an authenticated API request."""
    req = getattr(_factory, method)(path, data or {}, format="json")
    user = MagicMock(is_authenticated=True, pk=1, id=1, username="testuser")
    req.user = user
    return req


# ─── AuthSessionView ──────────────────────────────────────────────────────────


class TestAuthSessionView:
    def test_anon_returns_unauthenticated(self) -> None:
        from apps.accounts.auth_views import AuthSessionView

        response = AuthSessionView.as_view()(_anon("get", "/api/v1/auth/session/"))
        assert response.status_code == 200
        assert response.data["authenticated"] is False
        assert response.data["user"] is None

    def test_authenticated_returns_user_data(self) -> None:
        from apps.accounts.auth_views import AuthSessionView
        from apps.accounts.models import Profile

        mock_profile = MagicMock()
        mock_profile.bio = ""
        mock_profile.website_url = ""
        mock_profile.feed_lifetime_hours = 10
        mock_profile.avatar = None

        with patch.object(Profile.objects, "get_or_create", return_value=(mock_profile, False)):
            response = AuthSessionView.as_view()(_auth("get", "/api/v1/auth/session/"))

        assert response.status_code == 200
        assert response.data["authenticated"] is True
        assert "user" in response.data


# ─── AuthCsrfView ─────────────────────────────────────────────────────────────


class TestAuthCsrfView:
    def test_returns_csrf_token(self) -> None:
        from apps.accounts.auth_views import AuthCsrfView

        with patch("apps.accounts.auth_views.get_token", return_value="test-csrf-token"):
            response = AuthCsrfView.as_view()(_anon("get", "/api/v1/auth/csrf/"))

        assert response.status_code == 200
        assert response.data["csrfToken"] == "test-csrf-token"


# ─── AuthLogoutView ───────────────────────────────────────────────────────────


class TestAuthLogoutView:
    def test_logout_returns_204(self) -> None:
        from apps.accounts.auth_views import AuthLogoutView

        request = _auth("post", "/api/v1/auth/logout/")
        view = AuthLogoutView.as_view()

        with patch("apps.accounts.auth_views.logout") as mock_logout:
            response = view(request)
            mock_logout.assert_called_once()

        assert response.status_code == 204


# ─── AuthProvidersView ────────────────────────────────────────────────────────


class TestAuthProvidersView:
    def test_returns_clerk_auth_mode_with_no_backend_providers(self) -> None:
        from apps.accounts.auth_views import AuthProvidersView

        response = AuthProvidersView.as_view()(_anon("get", "/api/v1/auth/providers/"))

        assert response.status_code == 200
        assert response.data["auth_mode"] == "clerk"
        assert response.data["providers"] == []

    def test_backend_does_not_advertise_provider_login_urls(self) -> None:
        from apps.accounts.auth_views import AuthProvidersView

        response = AuthProvidersView.as_view()(_anon("get", "/api/v1/auth/providers/"))

        assert response.data["providers"] == []


# ─── PassphraseView ───────────────────────────────────────────────────────────


class TestPassphraseView:
    def test_get_reports_no_passphrase(self) -> None:
        from apps.accounts.models import Passphrase
        from apps.accounts.passphrase_views import PassphraseView

        with patch.object(Passphrase.objects, "filter") as mock_filter:
            mock_filter.return_value.exists.return_value = False
            response = PassphraseView.as_view()(_auth("get", "/api/v1/auth/passphrase/"))

        assert response.status_code == 200
        assert response.data["has_passphrase"] is False

    def test_post_rejects_short_phrase(self) -> None:
        from apps.accounts.passphrase_views import PassphraseView

        response = PassphraseView.as_view()(
            _auth("post", "/api/v1/auth/passphrase/", {"phrase": "one two"})
        )
        assert response.status_code == 400
        assert "at least 4 words" in response.data["detail"]

    def test_post_rejects_empty_phrase(self) -> None:
        from apps.accounts.passphrase_views import PassphraseView

        response = PassphraseView.as_view()(_auth("post", "/api/v1/auth/passphrase/", {}))
        assert response.status_code == 400


# ─── PassphraseVerifyView ─────────────────────────────────────────────────────


class TestPassphraseVerifyView:
    def test_returns_404_when_no_passphrase_set(self) -> None:
        from apps.accounts.models import Passphrase
        from apps.accounts.passphrase_views import PassphraseVerifyView

        with patch.object(Passphrase.objects, "get", side_effect=Passphrase.DoesNotExist):
            response = PassphraseVerifyView.as_view()(
                _auth("post", "/api/v1/auth/passphrase/verify/", {"phrase": "some words here test"})
            )

        assert response.status_code == 404

    def test_valid_passphrase_returns_true(self) -> None:
        from apps.accounts.models import Passphrase
        from apps.accounts.passphrase_views import PassphraseVerifyView

        mock_obj = MagicMock(spec=Passphrase)
        mock_obj.check_phrase.return_value = True

        with patch.object(Passphrase.objects, "get", return_value=mock_obj):
            response = PassphraseVerifyView.as_view()(
                _auth(
                    "post",
                    "/api/v1/auth/passphrase/verify/",
                    {"phrase": "correct horse battery staple"},
                )
            )

        assert response.status_code == 200
        assert response.data["valid"] is True

    def test_invalid_passphrase_returns_false(self) -> None:
        from apps.accounts.models import Passphrase
        from apps.accounts.passphrase_views import PassphraseVerifyView

        mock_obj = MagicMock(spec=Passphrase)
        mock_obj.check_phrase.return_value = False

        with patch.object(Passphrase.objects, "get", return_value=mock_obj):
            response = PassphraseVerifyView.as_view()(
                _auth("post", "/api/v1/auth/passphrase/verify/", {"phrase": "wrong words here now"})
            )

        assert response.status_code == 200
        assert response.data["valid"] is False


# ─── PassphraseDeleteView ─────────────────────────────────────────────────────


class TestPassphraseDeleteView:
    def test_delete_returns_204(self) -> None:
        from apps.accounts.models import Passphrase
        from apps.accounts.passphrase_views import PassphraseDeleteView

        with patch.object(Passphrase.objects, "filter") as mock_filter:
            mock_filter.return_value.delete.return_value = (1, {})
            response = PassphraseDeleteView.as_view()(
                _auth("delete", "/api/v1/auth/passphrase/delete/")
            )

        assert response.status_code == 204

    def test_delete_idempotent_when_no_passphrase(self) -> None:
        from apps.accounts.models import Passphrase
        from apps.accounts.passphrase_views import PassphraseDeleteView

        with patch.object(Passphrase.objects, "filter") as mock_filter:
            mock_filter.return_value.delete.return_value = (0, {})
            response = PassphraseDeleteView.as_view()(
                _auth("delete", "/api/v1/auth/passphrase/delete/")
            )

        assert response.status_code == 204
