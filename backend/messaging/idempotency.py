import hashlib
import json
from collections.abc import Callable

from django.db import IntegrityError, transaction

from config.exceptions import ApiError
from messaging.models import IdempotencyRecord

HEADER = "Idempotency-Key"
MAX_KEY_LENGTH = 100

Handler = Callable[[], tuple[int, dict]]


def get_idempotency_key(request) -> str:
    key = (request.headers.get(HEADER) or "").strip()
    if not key or len(key) > MAX_KEY_LENGTH:
        raise ApiError(
            "This request is missing a valid Idempotency-Key header.",
            code="validation_error",
            status_code=400,
            fields={"idempotency_key": f"Send an {HEADER} header of 1–{MAX_KEY_LENGTH} characters."},
        )
    return key


def _hash_request(scope: str, payload: dict) -> str:
    canonical = json.dumps({"scope": scope, "payload": payload}, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def run_idempotent(*, key: str, scope: str, payload: dict, handler: Handler) -> tuple[int, dict, bool]:
    """Run handler at most once per key. Returns (status_code, body, replayed)."""
    request_hash = _hash_request(scope, payload)
    try:
        with transaction.atomic():
            record = IdempotencyRecord.objects.create(key=key, scope=scope, request_hash=request_hash)
    except IntegrityError:
        existing = IdempotencyRecord.objects.get(key=key)
        if existing.request_hash != request_hash:
            raise ApiError(
                "This request key was already used for a different request.",
                code="idempotency_conflict",
                status_code=409,
            ) from None
        if existing.response_body is None:
            raise ApiError(
                "This request is already being processed. Please wait a moment.",
                code="request_in_progress",
                status_code=409,
            ) from None
        return existing.status_code, existing.response_body, True

    try:
        status_code, body = handler()
    except Exception:
        record.delete()
        raise

    record.status_code = status_code
    record.response_body = body
    record.save(update_fields=["status_code", "response_body"])
    return status_code, body, False