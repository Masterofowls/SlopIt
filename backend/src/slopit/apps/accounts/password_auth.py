"""Email + password registration and login helpers."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from apps.accounts.models import AuthMethod, Profile, User

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser


def derive_username(email: str) -> str:
    """Build a unique username from an email local-part."""
    local = email.split("@", 1)[0]
    return _unique_username(_slug_username(local))


def derive_username_from_name(name: str) -> str:
    """Build a unique username from a display name."""
    slug = name.lower().replace(" ", "_")
    return _unique_username(_slug_username(slug))


def _slug_username(value: str) -> str:
    base = re.sub(r"[^\w.@+-]", "", value)[:30].strip(".@+-")
    return base or "user"


def _unique_username(base: str) -> str:
    candidate = base
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f"{base}{suffix}"
        suffix += 1
    return candidate


def find_user_by_login(login: str) -> User | None:
    """Resolve a user by email (case-insensitive) or username."""
    value = login.strip()
    if not value:
        return None
    if "@" in value:
        return User.objects.filter(email__iexact=value).first()
    return User.objects.filter(username__iexact=value).first()


def validate_password_value(password: str, *, user: User | None = None) -> str:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise DjangoValidationError(exc.messages) from exc
    return password


@transaction.atomic
def register_password_user(
    *,
    name: str,
    password: str,
    email: str = "",
    username: str = "",
) -> User:
    """Create a local account with display name and hashed password."""
    display = name.strip()
    if not display:
        raise DjangoValidationError("Name is required.")

    normalized_email = email.strip().lower()
    if normalized_email and User.objects.filter(email__iexact=normalized_email).exists():
        raise DjangoValidationError("Email already registered.")

    chosen_username = username.strip()
    if not chosen_username:
        if normalized_email:
            chosen_username = derive_username(normalized_email)
        else:
            chosen_username = derive_username_from_name(display)
    if User.objects.filter(username__iexact=chosen_username).exists():
        raise DjangoValidationError("Username already taken.")

    validate_password_value(password)

    stored_email = normalized_email or f"{chosen_username}@no-email.local"
    user = User.objects.create_user(
        username=chosen_username,
        email=stored_email,
        password=password,
        first_name=display,
        auth_method=AuthMethod.PASSWORD,
    )
    Profile.objects.filter(user=user).update(display_name=display)
    return user


def authenticate_password_user(login: str, password: str) -> AbstractBaseUser | None:
    """Return the user when email/username and password match."""
    user = find_user_by_login(login)
    if user is None:
        return None
    return authenticate(username=user.username, password=password)
