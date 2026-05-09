"""Stage 1 sanity test — verifies project skeleton is importable."""

from __future__ import annotations


def test_django_settings_import() -> None:
    """Settings module must be importable without errors."""
    from config.settings import base  # noqa: F401


def test_urls_import() -> None:
    """URL conf must be importable."""
    from config import urls  # type: ignore[import-untyped]

    assert any(getattr(p, "name", None) == "system-status" for p in urls.urlpatterns)
