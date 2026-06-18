
from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

if TYPE_CHECKING:
    from rest_framework.request import Request

from apps.accounts.models import Passphrase

_MIN_WORDS = 4


class PassphraseView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        has = Passphrase.objects.filter(user=request.user).exists()
        return Response({"has_passphrase": has})

    def post(self, request: Request) -> Response:
        phrase = str(request.data.get("phrase", "")).strip()
        if not phrase:
            return Response(
                {"detail": "Field 'phrase' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        words = phrase.split()
        if len(words) < _MIN_WORDS:
            return Response(
                {"detail": f"Passphrase must contain at least {_MIN_WORDS} words."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj, _ = Passphrase.objects.get_or_create(user=request.user)
        obj.set_phrase(phrase)
        obj.save()
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class PassphraseVerifyView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        phrase = str(request.data.get("phrase", "")).strip()
        try:
            obj = Passphrase.objects.get(user=request.user)
        except Passphrase.DoesNotExist:
            return Response(
                {"detail": "No passphrase has been set for this account."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"valid": obj.check_phrase(phrase)})


class PassphraseDeleteView(APIView):

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request) -> Response:
        Passphrase.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
