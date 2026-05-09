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
from apps.accounts.views import MeViewSet, UserProfileViewSet
from apps.comments.views import CommentViewSet
from apps.feed.views import FeedViewSet
from apps.posts.views import MediaUploadView, PostViewSet, TagViewSet, TrendingTagsView

router = DefaultRouter()
router.register("me", MeViewSet, basename="me")
router.register("posts", PostViewSet, basename="post")
router.register("tags", TagViewSet, basename="tag")
router.register("comments", CommentViewSet, basename="comment")
router.register("feed", FeedViewSet, basename="feed")
router.register("users", UserProfileViewSet, basename="user-profile")

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
    path("media/", MediaUploadView.as_view(), name="media-upload"),
    path("trending-tags/", TrendingTagsView.as_view(), name="trending-tags"),
    path(
        "me/",
        MeViewSet.as_view({"get": "list", "patch": "partial_update"}),
        name="me-self",
    ),
    path(
        "me/bookmarks/",
        MeViewSet.as_view({"get": "bookmarks"}),
        name="me-bookmarks",
    ),
    path(
        "users/<str:username>/",
        UserProfileViewSet.as_view({"get": "retrieve"}),
        name="user-profile-detail",
    ),
    path(
        "users/<str:username>/posts/",
        UserProfileViewSet.as_view({"get": "posts"}),
        name="user-profile-posts",
    ),
    path("", include(router.urls)),
]
