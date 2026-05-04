"""Django signals for the posts app.

Hooks:
- post_save on Post: when status changes to 'published', enqueue L2 intake.
- post_save on Post: when status changes FROM 'published' to 'removed',
  enqueue a mark-ineligible update on the PostFeedMeta record.
"""

from __future__ import annotations

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


@receiver(pre_save, sender="posts.Post")
def _cache_original_status(sender: type, instance: object, **kwargs: object) -> None:
    """Cache the pre-save status so post_save can detect transitions."""
    if instance.pk:  # type: ignore[union-attr]
        try:
            instance._original_status = sender.objects.values_list(  # type: ignore[union-attr]
                "status", flat=True
            ).get(pk=instance.pk)  # type: ignore[union-attr]
        except sender.DoesNotExist:
            instance._original_status = None  # type: ignore[union-attr]
    else:
        instance._original_status = None  # type: ignore[union-attr]


@receiver(post_save, sender="posts.Post")
def _on_post_saved(sender: type, instance: object, created: bool, **kwargs: object) -> None:
    """Enqueue feed updates when a post's publication status changes."""
    current = instance.status  # type: ignore[union-attr]
    original = getattr(instance, "_original_status", None)

    if current == "published" and original != "published":
        from apps.feed.jobs import enqueue_post_published

        enqueue_post_published(instance.pk)  # type: ignore[union-attr]

    elif current == "removed" and original == "published":
        from apps.feed.jobs import enqueue_mark_ineligible

        enqueue_mark_ineligible([instance.pk])  # type: ignore[union-attr]
