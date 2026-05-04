"""Post-save signals for accounts: auto-create Profile and FeedPreferences."""

from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="accounts.User")
def create_user_profile_and_preferences(
    sender: object,
    instance: object,
    created: bool,
    **kwargs: object,
) -> None:
    """Ensure every new User gets a Profile and FeedPreferences row."""
    if not created:
        return

    from apps.accounts.models import Profile  # avoid circular import at module level
    from apps.feed.models import FeedPreferences

    Profile.objects.get_or_create(user=instance)
    FeedPreferences.objects.get_or_create(user=instance)
