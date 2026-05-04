from django.apps import AppConfig


class PagesConfig(AppConfig):
    name = "apps.pages"
    label = "pages"
    verbose_name = "Static pages"
    default_auto_field = "django.db.models.BigAutoField"
