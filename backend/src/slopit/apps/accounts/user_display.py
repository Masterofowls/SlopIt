from __future__ import annotations

import re
from typing import TYPE_CHECKING

from apps.accounts.avatar import generate_avatar_data_url

if TYPE_CHECKING:
    from apps.accounts.models import Profile, User

_CLERK_ID = re.compile(r"^(clerk_|k_)?user_[a-z0-9]{6,}", re.IGNORECASE)
_PLACEHOLDER = re.compile(r"^user\d+$", re.IGNORECASE)
_CLERK_USERNAME = re.compile(r"^(clerk_|k_)?user_[a-z0-9]{6,}", re.IGNORECASE)


def is_clerk_id(value: str | None) -> bool:
    if not value:
        return False
    return bool(_CLERK_ID.match(value))


def is_clerk_username(value: str) -> bool:
    if not value:
        return False
    return bool(_CLERK_USERNAME.match(value))


def is_placeholder_username(value: str | None) -> bool:
    if not value:
        return False
    return bool(_PLACEHOLDER.match(value))


def is_sentinel_email(email: str | None) -> bool:
    if not email:
        return False
    if email.endswith("@no-email.local"):
        return True
    return is_clerk_id(email.split("@")[0])


def full_name(user: User) -> str:
    parts = []
    if user.first_name:
        parts.append(user.first_name)
    if user.last_name:
        parts.append(user.last_name)
    return " ".join(parts).strip()


def avatar_seed(user: User, profile: Profile | None = None) -> str:
    if profile is None:
        profile = getattr(user, "profile", None)
    if profile and profile.display_name:
        return profile.display_name
    name = full_name(user)
    if name:
        return name
    if user.username and not is_clerk_id(user.username):
        return user.username
    if user.email:
        local = user.email.split("@")[0]
        if not is_clerk_id(local):
            return local
    return str(user.pk)


def display_name(user: User) -> str:
    profile = getattr(user, "profile", None)
    if profile and profile.display_name:
        return profile.display_name
    name = full_name(user)
    if name:
        return name
    if user.username and not is_placeholder_username(user.username):
        return user.username
    if user.email and not is_sentinel_email(user.email):
        return user.email.split("@")[0]
    return f"User {user.pk}"


def display_name_public(profile: Profile) -> str:
    if profile.display_name:
        return profile.display_name
    user = profile.user
    name = full_name(user)
    if name:
        return name
    if user.username:
        return user.username
    if user.email:
        return user.email.split("@")[0]
    return f"User {profile.user_id}"


def profile_avatar_url(profile: Profile, request=None) -> str | None:
    if profile.avatar and request:
        return request.build_absolute_uri(profile.avatar.url)
    if profile.social_avatar_url:
        return profile.social_avatar_url
    return generate_avatar_data_url(avatar_seed(profile.user, profile))
