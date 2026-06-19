from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.password_auth import (
    authenticate_password_user,
    register_password_user,
    validate_password_value,
)


class PasswordRegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, trim_whitespace=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    username = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=150,
        trim_whitespace=True,
    )

    def validate_password(self, value: str) -> str:
        return validate_password_value(value)

    def create(self, validated_data: dict) -> User:
        try:
            return register_password_user(
                name=validated_data["name"],
                email=validated_data.get("email", ""),
                password=validated_data["password"],
                username=validated_data.get("username", ""),
            )
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict) from exc
            raise serializers.ValidationError(list(exc.messages)) from exc


class PasswordLoginSerializer(serializers.Serializer):
    login = serializers.CharField(max_length=254, trim_whitespace=True)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate(self, attrs: dict) -> dict:
        user = authenticate_password_user(attrs["login"], attrs["password"])
        if user is None:
            raise serializers.ValidationError({"detail": "Invalid username or password."})
        attrs["user"] = user
        return attrs
