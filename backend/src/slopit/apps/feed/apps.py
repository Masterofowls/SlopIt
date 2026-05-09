from django.apps import AppConfig


class FeedConfig(AppConfig):
    """Three-level random feed algorithm — see docs/ALGORITHM.md."""

    name = "apps.feed"
    label = "feed"
    verbose_name = "Feed (3-level random algorithm)"
    default_auto_field = "django.db.models.BigAutoField"
