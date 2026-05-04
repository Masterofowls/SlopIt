from __future__ import annotations

from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

from apps.accounts.models import Profile


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    """Custom allauth social adapter for SlopIt.

    - Redirects to FRONTEND_URL after every OAuth login (not backend root).
    - Syncs provider avatar URL into Profile.social_avatar_url on every login.
    """

    _AVATAR_KEYS: dict[str, str] = {
        "google": "picture",
        "github": "avatar_url",
        "telegram": "photo_url",
    }

    def get_login_redirect_url(self, request: object) -> str:
        from django.conf import settings

        return getattr(settings, "FRONTEND_URL", "/")

    def pre_social_login(self, request: object, sociallogin: object) -> None:
        super().pre_social_login(request, sociallogin)
        if sociallogin.is_existing:
            self._sync_avatar(sociallogin)

    def save_user(self, request: object, sociallogin: object, form: object = None) -> object:
        user = super().save_user(request, sociallogin, form)
        self._sync_avatar(sociallogin, user=user)
        return user

    def _sync_avatar(self, sociallogin: object, user: object = None) -> None:
        extra = sociallogin.account.extra_data
        provider = sociallogin.account.provider
        url = extra.get(self._AVATAR_KEYS.get(provider, ""), "")
        if not url:
            return
        target_user = user or sociallogin.user
        if target_user and target_user.pk:
            Profile.objects.filter(user_id=target_user.pk).update(social_avatar_url=url)
