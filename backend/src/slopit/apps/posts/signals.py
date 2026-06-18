
from __future__ import annotations

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver


@receiver(pre_save, sender="posts.Post")
def _cache_original_status(sender: type, instance: object, **kwargs: object) -> None:
    if instance.pk:  
        try:
            instance._original_status = sender.objects.values_list(  
                "status", flat=True
            ).get(pk=instance.pk)  
        except sender.DoesNotExist:
            instance._original_status = None  
    else:
        instance._original_status = None  


@receiver(post_save, sender="posts.Post")
def _on_post_saved(sender: type, instance: object, created: bool, **kwargs: object) -> None:
    current = instance.status  
    original = getattr(instance, "_original_status", None)

    if current == "published" and original != "published":
        
        import random

        from django.utils import timezone

        update_fields: dict[str, object] = {
            "toxicity_score": round(random.uniform(0.0, 1.0), 4),
        }
        if not instance.published_at:  
            update_fields["published_at"] = timezone.now()

        sender.objects.filter(pk=instance.pk).update(**update_fields)  

        
        try:
            from apps.feed.services.level2_intake import on_post_published

            post = (
                sender.objects.select_related("author").prefetch_related("tags").get(pk=instance.pk)
            )  
            on_post_published(post)
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "on_post_published failed for post %s",
                instance.pk,  
            )

    elif current == "removed" and original == "published":
        from apps.feed.models import PostFeedMeta

        PostFeedMeta.objects.filter(post_id=instance.pk).update(is_eligible=False)
