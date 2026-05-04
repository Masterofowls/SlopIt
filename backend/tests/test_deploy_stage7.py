"""Stage 7 tests — Fly.io deploy config, health endpoint, production settings."""

from __future__ import annotations

import importlib

import pytest
from django.test import RequestFactory, override_settings

# ─── Health endpoint ─────────────────────────────────────────────────────────


class TestHealthEndpoint:
    """Health endpoint never touches the DB — use RequestFactory to avoid DB setup."""

    @pytest.fixture(autouse=True)
    def _factory(self) -> None:
        from config.urls import system_status

        self._view = system_status
        self._rf = RequestFactory()

    def _get(self) -> object:
        request = self._rf.get("/api/v1/system/status")
        return self._view(request)

    def test_returns_200_by_default(self) -> None:
        assert self._get().status_code == 200

    def test_response_is_json(self) -> None:
        import json

        response = self._get()
        data = json.loads(response.content)
        assert isinstance(data, dict)

    def test_ok_true_by_default(self) -> None:
        import json

        data = json.loads(self._get().content)
        assert data["ok"] is True

    def test_maintenance_false_by_default(self) -> None:
        import json

        data = json.loads(self._get().content)
        assert data["maintenance"] is False

    def test_version_present(self) -> None:
        import json

        assert "version" in json.loads(self._get().content)

    @override_settings(MAINTENANCE_MODE=True)
    def test_returns_503_in_maintenance_mode(self) -> None:
        assert self._get().status_code == 503

    @override_settings(MAINTENANCE_MODE=True)
    def test_ok_false_in_maintenance_mode(self) -> None:
        import json

        data = json.loads(self._get().content)
        assert data["ok"] is False
        assert data["maintenance"] is True

    def test_no_auth_required(self) -> None:
        """Health endpoint must be anonymous — Fly.io calls it without credentials."""
        assert self._get().status_code == 200


# ─── Production settings ─────────────────────────────────────────────────────


class TestProdSettings:
    """Import prod module directly to verify its constants without activating it."""

    @pytest.fixture(autouse=True)
    def _prod(self) -> None:
        self.prod = importlib.import_module("config.settings.prod")

    def test_debug_is_false(self) -> None:
        assert self.prod.DEBUG is False

    def test_secure_ssl_redirect(self) -> None:
        assert self.prod.SECURE_SSL_REDIRECT is True

    def test_secure_hsts_seconds_set(self) -> None:
        assert self.prod.SECURE_HSTS_SECONDS > 0

    def test_secure_hsts_include_subdomains(self) -> None:
        assert self.prod.SECURE_HSTS_INCLUDE_SUBDOMAINS is True

    def test_secure_hsts_preload(self) -> None:
        assert self.prod.SECURE_HSTS_PRELOAD is True

    def test_session_cookie_secure(self) -> None:
        assert self.prod.SESSION_COOKIE_SECURE is True

    def test_csrf_cookie_secure(self) -> None:
        assert self.prod.CSRF_COOKIE_SECURE is True

    def test_session_cookie_httponly(self) -> None:
        assert self.prod.SESSION_COOKIE_HTTPONLY is True

    def test_x_frame_options_deny(self) -> None:
        assert self.prod.X_FRAME_OPTIONS == "DENY"

    def test_content_type_nosniff(self) -> None:
        assert self.prod.SECURE_CONTENT_TYPE_NOSNIFF is True

    def test_referrer_policy(self) -> None:
        assert self.prod.SECURE_REFERRER_POLICY == "same-origin"

    def test_whitenoise_manifest_strict_false(self) -> None:
        """Must be False so first deploy doesn't crash before collectstatic runs."""
        assert self.prod.WHITENOISE_MANIFEST_STRICT is False


# ─── Static files ────────────────────────────────────────────────────────────


class TestStaticFilesConfig:
    def test_static_root_configured(self) -> None:
        from django.conf import settings

        assert settings.STATIC_ROOT is not None
        assert str(settings.STATIC_ROOT) != ""

    def test_whitenoise_in_middleware(self) -> None:
        from django.conf import settings

        assert any("whitenoise" in m.lower() for m in settings.MIDDLEWARE)

    def test_whitenoise_storage_backend(self) -> None:
        from django.conf import settings

        assert "whitenoise" in settings.STATICFILES_STORAGE.lower()

    def test_static_url(self) -> None:
        from django.conf import settings

        assert settings.STATIC_URL == "/static/"


# ─── Fly.io config sanity ────────────────────────────────────────────────────


class TestFlyConfig:
    """Parse fly.toml to assert critical values without running flyctl."""

    @pytest.fixture(autouse=True)
    def _read_toml(self) -> None:
        from pathlib import Path

        toml_path = Path(__file__).resolve().parents[1] / "fly.toml"
        self.raw = toml_path.read_text(encoding="utf-8")

    def test_health_check_uses_v1_path(self) -> None:
        assert "/api/v1/system/status" in self.raw

    def test_old_health_check_path_absent(self) -> None:
        # The old path (missing /v1/) must not appear
        lines = [line for line in self.raw.splitlines() if "path" in line and "/api/" in line]
        assert all("/api/v1/" in line for line in lines), (
            "Found health check path without /v1/: " + str(lines)
        )

    def test_force_https_enabled(self) -> None:
        assert "force_https = true" in self.raw

    def test_strategy_is_rolling(self) -> None:
        assert 'strategy = "rolling"' in self.raw

    def test_prod_settings_module_set(self) -> None:
        assert "config.settings.prod" in self.raw


# ─── Dockerfile sanity ───────────────────────────────────────────────────────


class TestDockerfileConfig:
    @pytest.fixture(autouse=True)
    def _read_dockerfile(self) -> None:
        from pathlib import Path

        df_path = Path(__file__).resolve().parents[1] / "Dockerfile"
        self.raw = df_path.read_text(encoding="utf-8")

    def test_health_check_uses_v1_path(self) -> None:
        assert "/api/v1/system/status" in self.raw

    def test_multi_stage_build(self) -> None:
        assert "AS builder" in self.raw
        assert "AS runtime" in self.raw

    def test_non_root_user(self) -> None:
        assert "USER app" in self.raw

    def test_uv_lock_copied(self) -> None:
        assert "uv.lock" in self.raw

    def test_gunicorn_command(self) -> None:
        assert "gunicorn" in self.raw
