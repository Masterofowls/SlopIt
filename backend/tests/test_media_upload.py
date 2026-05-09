from __future__ import annotations

from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_media_upload_returns_url_for_authenticated_clerk_user() -> None:
    client = APIClient()
    image = SimpleUploadedFile("photo.png", b"fake-image-bytes", content_type="image/png")

    with patch(
        "apps.accounts.clerk_auth._verify_clerk_token",
        return_value={
            "sub": "user_clerk_media_upload",
            "email": "media@example.com",
            "username": "mediauser",
        },
    ):
        response = client.post(
            "/api/v1/media/",
            {"file": image},
            format="multipart",
            HTTP_AUTHORIZATION="Bearer test-token",
        )

    assert response.status_code == 201
    assert isinstance(response.data.get("url"), str)
    assert response.data["url"].startswith("http")


@pytest.mark.django_db
def test_media_upload_requires_file_field() -> None:
    client = APIClient()

    with patch(
        "apps.accounts.clerk_auth._verify_clerk_token",
        return_value={
            "sub": "user_clerk_media_upload_missing",
            "email": "media-missing@example.com",
            "username": "mediauser2",
        },
    ):
        response = client.post(
            "/api/v1/media/",
            {},
            format="multipart",
            HTTP_AUTHORIZATION="Bearer test-token",
        )

    assert response.status_code == 400
    assert "file is required" in response.data["detail"]


@pytest.mark.django_db
def test_media_upload_rejects_file_over_limit() -> None:
    client = APIClient()
    image = SimpleUploadedFile("too-big.png", b"ab", content_type="image/png")

    with (
        patch(
            "apps.accounts.clerk_auth._verify_clerk_token",
            return_value={
                "sub": "user_clerk_media_upload_big",
                "email": "media-big@example.com",
                "username": "mediauser3",
            },
        ),
        patch("apps.posts.views.MAX_MEDIA_UPLOAD_BYTES", 1),
    ):
        response = client.post(
            "/api/v1/media/",
            {"file": image},
            format="multipart",
            HTTP_AUTHORIZATION="Bearer test-token",
        )

    assert response.status_code == 400
    assert "500MB" in response.data["detail"]


@pytest.mark.django_db
def test_media_upload_can_link_file_to_post() -> None:
    from apps.accounts.models import User
    from apps.posts.models import Post

    client = APIClient()
    user = User.objects.create_user(
        clerk_id="user_clerk_media_link",
        username="mediaowner",
        email="media-owner@example.com",
    )
    post = Post.objects.create(
        author=user,
        title="Image post",
        kind=Post.Kind.IMAGE,
        status=Post.Status.PUBLISHED,
    )
    image = SimpleUploadedFile("photo.png", b"fake-image-bytes", content_type="image/png")

    with patch(
        "apps.accounts.clerk_auth._verify_clerk_token",
        return_value={
            "sub": "user_clerk_media_link",
            "email": "media-owner@example.com",
            "username": "mediaowner",
        },
    ):
        upload_response = client.post(
            "/api/v1/media/",
            {
                "file": image,
                "post_id": str(post.id),
                "kind": "image",
            },
            format="multipart",
            HTTP_AUTHORIZATION="Bearer test-token",
        )

    assert upload_response.status_code == 201
    assert upload_response.data.get("media_id")

    detail_response = client.get(f"/api/v1/posts/{post.id}/")
    assert detail_response.status_code == 200
    assert len(detail_response.data["media"]) == 1
    assert detail_response.data["media"][0]["file"].startswith("http")
