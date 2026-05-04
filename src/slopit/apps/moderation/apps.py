from django.apps import AppConfig


class ModerationConfig(AppConfig):
    name = "apps.moderation"
    label = "moderation"
    verbose_name = "Moderation"
    default_auto_field = "django.db.models.BigAutoField"
