"""DRF router — all API v1 viewsets + auth endpoints."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.auth_views import (
    AuthCsrfView,
    AuthLogoutView,
    AuthProvidersView,
    AuthSessionView,
)
from apps.accounts.passphrase_views import (
    PassphraseDeleteView,
    PassphraseVerifyView,
    PassphraseView,
)
from apps.accounts.views import MeViewSet
from apps.comments.views import CommentViewSet
from apps.feed.views import FeedViewSet
from apps.posts.views import PostViewSet, TagViewSet

router = DefaultRouter()
router.register("me", MeViewSet, basename="me")
router.register("posts", PostViewSet, basename="post")
router.register("tags", TagViewSet, basename="tag")
router.register("comments", CommentViewSet, basename="comment")
router.register("feed", FeedViewSet, basename="feed")

# Auth endpoints (session state + second-factor passphrase).
# Primary OAuth login is handled by AllAuth at /accounts/<provider>/login/.
auth_urlpatterns = [
    path("session/", AuthSessionView.as_view(), name="auth-session"),
    path("csrf/", AuthCsrfView.as_view(), name="auth-csrf"),
    path("logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("providers/", AuthProvidersView.as_view(), name="auth-providers"),
    path("passphrase/", PassphraseView.as_view(), name="auth-passphrase"),
    path("passphrase/verify/", PassphraseVerifyView.as_view(), name="auth-passphrase-verify"),
    path("passphrase/delete/", PassphraseDeleteView.as_view(), name="auth-passphrase-delete"),
]

urlpatterns = [
    path("auth/", include(auth_urlpatterns)),
    path("", include(router.urls)),
]
