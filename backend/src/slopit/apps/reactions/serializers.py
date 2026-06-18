
from __future__ import annotations

from rest_framework import serializers

from apps.reactions.models import Reaction


class ReactionToggleSerializer(serializers.Serializer):

    kind = serializers.ChoiceField(choices=Reaction.Kind.choices)
