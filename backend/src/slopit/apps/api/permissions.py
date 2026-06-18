
from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.permissions import SAFE_METHODS, BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView


class IsAuthorOrReadOnly(BasePermission):

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.method in SAFE_METHODS or (request.user and request.user.is_authenticated)
        )

    def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return bool(getattr(obj, "author", None) == request.user)


class IsOwnerOrReadOnly(BasePermission):

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.method in SAFE_METHODS or (request.user and request.user.is_authenticated)
        )

    def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return bool(getattr(obj, "user", None) == request.user)
