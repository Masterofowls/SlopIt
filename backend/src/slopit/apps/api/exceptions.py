"""RFC 7807 Problem JSON exception handler for Django REST Framework."""

from __future__ import annotations

from typing import Any

from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def problem_json_exception_handler(
    exc: Exception,
    context: dict[str, Any],
) -> JsonResponse | None:
    """Return RFC 7807 ``application/problem+json`` responses for all DRF errors.

    Falls through to DRF's default handler first, then reshapes the response
    into the Problem Details format::

        {
            "type":   "about:blank",
            "title":  "Bad Request",
            "status": 400,
            "detail": "...",
            "errors": {...}
        }

    Frontend should inspect ``Content-Type: application/problem+json`` to
    distinguish problem responses from normal API payloads.
    """
    response = exception_handler(exc, context)

    if response is None:
        return None

    http_status: int = response.status_code
    title = _status_title(http_status)

    problem: dict[str, Any] = {
        "type": "about:blank",
        "title": title,
        "status": http_status,
        "detail": _extract_detail(exc, response),
    }

    if isinstance(exc, ValidationError) and isinstance(response.data, dict):
        errors: dict[str, Any] = {}
        for field, messages in response.data.items():
            if field != "detail":
                errors[field] = messages
        if errors:
            problem["errors"] = errors

    return JsonResponse(
        problem,
        status=http_status,
        content_type="application/problem+json",
    )


def _extract_detail(exc: Exception, response: Any) -> str:
    """Extract a human-readable detail string from the response data."""
    data = response.data
    if isinstance(data, dict) and "detail" in data:
        return str(data["detail"])
    if isinstance(data, list):
        return str(data[0]) if data else "An error occurred."
    if isinstance(data, str):
        return data
    return str(exc)


def _status_title(http_status: int) -> str:
    """Map an HTTP status code to its standard reason phrase."""
    titles = {
        status.HTTP_400_BAD_REQUEST: "Bad Request",
        status.HTTP_401_UNAUTHORIZED: "Unauthorized",
        status.HTTP_403_FORBIDDEN: "Forbidden",
        status.HTTP_404_NOT_FOUND: "Not Found",
        status.HTTP_405_METHOD_NOT_ALLOWED: "Method Not Allowed",
        status.HTTP_409_CONFLICT: "Conflict",
        status.HTTP_429_TOO_MANY_REQUESTS: "Too Many Requests",
        status.HTTP_500_INTERNAL_SERVER_ERROR: "Internal Server Error",
    }
    return titles.get(http_status, "Error")
