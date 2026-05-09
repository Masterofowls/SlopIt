"""Stage 6 — Unfold admin tests.

All tests are pure import / unit checks — no DB required.
"""

from __future__ import annotations

import django

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

    def test_reaction_admin_uses_unfold(self) -> None:
        self._assert_unfold("apps.reactions.admin.ReactionAdmin")


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
        assert len(nav) >= 3  # Content, Users, Feed

    def test_unfold_colors_defined(self) -> None:
        from django.conf import settings

        assert "primary" in settings.UNFOLD["COLORS"]
