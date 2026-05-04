from django.apps import AppConfig


class PostsConfig(AppConfig):
    name = "apps.posts"
    label = "posts"
    verbose_name = "Posts"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        import apps.posts.signals  # noqa: F401
