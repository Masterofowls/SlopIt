"""Serializer for toggling reactions on posts and comments."""

from __future__ import annotations

from rest_framework import serializers

from apps.reactions.models import Reaction


class ReactionToggleSerializer(serializers.Serializer):
    """Input: just the reaction kind.  The target is the URL-resolved object."""

    kind = serializers.ChoiceField(choices=Reaction.Kind.choices)
