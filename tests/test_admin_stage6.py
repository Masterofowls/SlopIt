"""Stage 6 — Unfold admin + StaticPages + Sitemap tests.

All tests are pure import / unit checks — no DB required.
"""

from __future__ import annotations

import django
import pytest

django.setup()


# ─── Admin registration ───────────────────────────────────────────────────────


class TestUnfoldAdminRegistrations:
    """Every ModelAdmin must subclass unfold.admin.ModelAdmin."""

    def _assert_unfold(self, admin_class_path: str) -> None:
        from unfold.admin import ModelAdmin as UnfoldModelAdmin

        module_path, cls_name = admin_class_path.rsplit(".", 1)
        import importlib

        mod = importlib.import_module(module_path)
        cls = getattr(mod, cls_name)
        assert issubclass(cls, UnfoldModelAdmin), (
            f"{cls_name} does not subclass unfold.admin.ModelAdmin"
        )

    def test_user_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.accounts.admin.UserAdmin")

    def test_profile_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.accounts.admin.ProfileAdmin")

    def test_passkey_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.accounts.admin.PasskeyAdmin")

    def test_passphrase_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.accounts.admin.PassphraseAdmin")

    def test_post_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.posts.admin.PostAdmin")

    def test_tag_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.posts.admin.TagAdmin")

    def test_media_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.posts.admin.MediaAdmin")

    def test_comment_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.comments.admin.CommentAdmin")

    def test_feed_prefs_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.feed.admin.FeedPreferencesAdmin")

    def test_post_feed_meta_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.feed.admin.PostFeedMetaAdmin")

    def test_feed_snapshot_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.feed.admin.FeedSnapshotAdmin")

    def test_report_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.moderation.admin.ReportAdmin")

    def test_ban_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.moderation.admin.BanAdmin")

    def test_reaction_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.reactions.admin.ReactionAdmin")

    def test_static_page_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.pages.admin.StaticPageAdmin")

    def test_system_flag_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.pages.admin.SystemFlagAdmin")


# ─── UNFOLD settings ──────────────────────────────────────────────────────────


class TestUnfoldSettings:
    def test_unfold_dict_exists(self) -> None:
        from django.conf import settings

        assert hasattr(settings, "UNFOLD")

    def test_unfold_has_site_title(self) -> None:
        from django.conf import settings

        assert settings.UNFOLD["SITE_TITLE"] == "SlopIt Admin"

    def test_unfold_sidebar_has_navigation(self) -> None:
        from django.conf import settings

        nav = settings.UNFOLD["SIDEBAR"]["navigation"]
        assert isinstance(nav, list)
        assert len(nav) >= 5  # Content, Users, Feed, Moderation, Pages&Config

    def test_unfold_colors_defined(self) -> None:
        from django.conf import settings

        assert "primary" in settings.UNFOLD["COLORS"]


# ─── Sitemaps ─────────────────────────────────────────────────────────────────


class TestStaticPageSitemap:
    def test_imports_cleanly(self) -> None:
        from apps.pages.sitemaps import StaticPageSitemap

        assert StaticPageSitemap is not None

    def test_location_format(self) -> None:
        from unittest.mock import MagicMock

        from apps.pages.sitemaps import StaticPageSitemap

        page = MagicMock()
        page.slug = "about"
        sm = StaticPageSitemap()
        assert sm.location(page) == "/about/"

    def test_lastmod_returns_updated_at(self) -> None:
        import datetime
        from unittest.mock import MagicMock

        from apps.pages.sitemaps import StaticPageSitemap

        ts = datetime.datetime(2026, 1, 1, tzinfo=datetime.UTC)
        page = MagicMock()
        page.updated_at = ts
        sm = StaticPageSitemap()
        assert sm.lastmod(page) == ts

    def test_changefreq_is_weekly(self) -> None:
        from apps.pages.sitemaps import StaticPageSitemap

        assert StaticPageSitemap.changefreq == "weekly"


class TestStaticViewSitemap:
    def test_imports_cleanly(self) -> None:
        from apps.pages.sitemaps import StaticViewSitemap

        assert StaticViewSitemap is not None

    def test_items_returns_url_names(self) -> None:
        from apps.pages.sitemaps import StaticViewSitemap

        sm = StaticViewSitemap()
        items = sm.items()
        assert "system-status" in items
        assert "swagger-ui" in items
        assert "redoc" in items

    def test_priority_override_for_api_docs(self) -> None:
        from apps.pages.sitemaps import StaticViewSitemap

        sm = StaticViewSitemap()
        assert sm.priority("swagger-ui") == pytest.approx(0.4)
        assert sm.priority("system-status") == pytest.approx(0.1)


# ─── Sitemap URL wiring ───────────────────────────────────────────────────────


class TestSitemapUrlWiring:
    def test_sitemap_xml_url_resolves(self) -> None:
        from django.urls import reverse

        url = reverse("django.contrib.sitemaps.views.sitemap")
        assert url == "/sitemap.xml"

    def test_urls_module_imports_sitemaps(self) -> None:
        import config.urls as urls_module

        assert hasattr(urls_module, "_sitemaps")
        assert "static-pages" in urls_module._sitemaps
        assert "static-views" in urls_module._sitemaps


# ─── StaticPage model ─────────────────────────────────────────────────────────


class TestStaticPageModel:
    def test_str_format(self) -> None:
        from apps.pages.models import StaticPage

        page = StaticPage.__new__(StaticPage)
        page.title = "About"
        page.slug = "about"
        assert str(page) == "About (about)"

    def test_slug_choices_defined(self) -> None:
        from apps.pages.models import StaticPage

        slugs = [c[0] for c in StaticPage.Slug.choices]
        assert "landing" in slugs
        assert "about" in slugs


class TestSystemFlagModel:
    def test_str_format(self) -> None:
        from apps.pages.models import SystemFlag

        flag = SystemFlag.__new__(SystemFlag)
        flag.key = "feature_passkeys_enabled"
        flag.value = "true"
        assert str(flag) == "feature_passkeys_enabled = 'true'"
