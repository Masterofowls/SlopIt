from django.apps import AppConfig


class FeedConfig(AppConfig):

    name = "apps.feed"
    label = "feed"
    verbose_name = "Feed (3-level random algorithm)"
    default_auto_field = "django.db.models.BigAutoField"
