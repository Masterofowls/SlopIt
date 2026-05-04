"""Admin registrations for the accounts app."""

from __future__ import annotations

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin

from .models import Passkey, Passphrase, Profile, User


@admin.register(User)
class UserAdmin(ModelAdmin, BaseUserAdmin):
    list_display = ["username", "email", "is_active", "is_staff", "date_joined"]
    list_filter = ["is_active", "is_staff", "is_superuser"]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering = ["-date_joined"]


@admin.register(Profile)
class ProfileAdmin(ModelAdmin):
    list_display = ["user", "feed_lifetime_hours", "created_at"]
    raw_id_fields = ["user"]
    search_fields = ["user__username", "user__email"]


@admin.register(Passkey)
class PasskeyAdmin(ModelAdmin):
    list_display = ["user", "name", "created_at", "last_used_at"]
    raw_id_fields = ["user"]
    search_fields = ["user__username", "name"]
    readonly_fields = ["credential_id", "public_key", "sign_count", "aaguid"]


@admin.register(Passphrase)
class PassphraseAdmin(ModelAdmin):
    list_display = ["user", "created_at"]
    raw_id_fields = ["user"]
    readonly_fields = ["phrase_hash"]
