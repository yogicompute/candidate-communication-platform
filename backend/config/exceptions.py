import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

SERVER_ERROR_MESSAGE = "Something went wrong on our side. Please try again."
VALIDATION_MESSAGE = "Please fix the highlighted fields."


class ApiError(exceptions.APIException):
    """A business-rule error with a stable code, HTTP status and optional field messages."""

    def __init__(
        self,
        message: str,
        *,
        code: str,
        status_code: int = 400,
        fields: dict[str, str] | None = None,
    ):
        super().__init__(detail=message, code=code)
        self.status_code = status_code
        self.error_code = code
        self.fields = fields or {}


def error_body(code: str, message: str, fields: dict[str, str] | None = None) -> dict:
    body: dict = {"code": code, "message": message}
    if fields:
        body["fields"] = fields
    return {"error": body}


def _first_message(value) -> str:
    if isinstance(value, dict):
        return _first_message(next(iter(value.values()), ""))
    if isinstance(value, list):
        return _first_message(value[0]) if value else ""
    return str(value)


def _validation_payload(detail) -> tuple[str, dict[str, str]]:
    if not isinstance(detail, dict):
        return _first_message(detail) or VALIDATION_MESSAGE, {}
    non_field_key = api_settings.NON_FIELD_ERRORS_KEY
    fields = {key: _first_message(value) for key, value in detail.items() if key != non_field_key}
    message = _first_message(detail[non_field_key]) if non_field_key in detail else VALIDATION_MESSAGE
    return message, fields


def api_exception_handler(exc, context):
    if isinstance(exc, ApiError):
        return Response(
            error_body(exc.error_code, str(exc.detail), exc.fields),
            status=exc.status_code,
        )

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(error_body("server_error", SERVER_ERROR_MESSAGE), status=500)

    if isinstance(exc, exceptions.ValidationError):
        message, fields = _validation_payload(exc.detail)
        response.data = error_body("validation_error", message, fields)
    elif isinstance(exc, Http404):
        response.data = error_body("not_found", "The requested item was not found.")
    elif isinstance(exc, PermissionDenied):
        response.data = error_body("forbidden", "You do not have permission to do this.")
    else:
        codes = exc.get_codes()
        code = codes if isinstance(codes, str) else exc.default_code
        message = str(exc.detail) if isinstance(exc.detail, str) else str(exc.default_detail)
        response.data = error_body(code, message)
    return response