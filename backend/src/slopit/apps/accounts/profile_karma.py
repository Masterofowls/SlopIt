from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.accounts.models import Profile


def karma_score(profile: Profile) -> int:
    from django.contrib.contenttypes.models import ContentType

    from apps.comments.models import Comment
    from apps.posts.models import Post
    from apps.reactions.models import Reaction

    post_ct = ContentType.objects.get_for_model(Post)
    comment_ct = ContentType.objects.get_for_model(Comment)
    user = profile.user

    post_ids = list(
        Post.objects.filter(author=user, status="published").values_list("id", flat=True)
    )
    comment_ids = list(
        Comment.objects.filter(author=user, is_deleted=False).values_list("id", flat=True)
    )

    post_likes = 0
    if len(post_ids) > 0:
        post_likes = Reaction.objects.filter(
            content_type=post_ct, object_id__in=post_ids, kind="like"
        ).count()

    comment_likes = 0
    if len(comment_ids) > 0:
        comment_likes = Reaction.objects.filter(
            content_type=comment_ct, object_id__in=comment_ids, kind="like"
        ).count()

    return post_likes * 2 + comment_likes
