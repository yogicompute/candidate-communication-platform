import hashlib
import json
from collections.abc import Callable
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from config.exceptions import ApiError
from messaging.models import IdempotencyRecord

HEADER = "Idempotency-Key"
MAX_KEY_LENGTH = 100
# A finished request is replayed for this long; afterwards the key may be reused for anything.
RECORD_TTL = timedelta(hours=24)
# A request still "in progress" after this long crashed or was killed; its key becomes reusable.
IN_PROGRESS_TIMEOUT = timedelta(minutes=15)

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


def _is_stale(record: IdempotencyRecord, now) -> bool:
    if record.created_at < now - RECORD_TTL:
        return True
    return record.status_code is None and record.created_at < now - IN_PROGRESS_TIMEOUT


def _claim(*, key: str, scope: str, request_hash: str) -> tuple[IdempotencyRecord | None, IdempotencyRecord | None]:
    """Create (or take over a stale) record for key. Returns (claimed, existing) — exactly one is set."""
    try:
        with transaction.atomic():
            return IdempotencyRecord.objects.create(key=key, scope=scope, request_hash=request_hash), None
    except IntegrityError:
        pass

    existing = IdempotencyRecord.objects.filter(key=key).first()
    now = timezone.now()
    if existing is None:
        # Purged between our insert and this read; one more insert settles it.
        try:
            with transaction.atomic():
                return IdempotencyRecord.objects.create(key=key, scope=scope, request_hash=request_hash), None
        except IntegrityError:
            existing = IdempotencyRecord.objects.get(key=key)
    if not _is_stale(existing, now):
        return None, existing

    # Conditional update so only one of several concurrent requests takes the stale key over.
    taken = IdempotencyRecord.objects.filter(pk=existing.pk, created_at=existing.created_at).update(
        scope=scope, request_hash=request_hash, status_code=None, response_body=None, created_at=now
    )
    if taken:
        return IdempotencyRecord.objects.get(pk=existing.pk), None
    raise ApiError(
        "This request is already being processed. Please wait a moment.",
        code="request_in_progress",
        status_code=409,
    )


def run_idempotent(*, key: str, scope: str, payload: dict, handler: Handler) -> tuple[int, dict, bool]:
    """Run handler at most once per key. Returns (status_code, body, replayed)."""
    request_hash = _hash_request(scope, payload)
    record, existing = _claim(key=key, scope=scope, request_hash=request_hash)
    if existing is not None:
        if existing.request_hash != request_hash:
            raise ApiError(
                "This request key was already used for a different request.",
                code="idempotency_conflict",
                status_code=409,
            )
        if existing.status_code is None:
            raise ApiError(
                "This request is already being processed. Please wait a moment.",
                code="request_in_progress",
                status_code=409,
            )
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


def purge_idempotency_records() -> dict[str, int]:
    """Delete records past their replay window and in-progress records abandoned by a crash."""
    now = timezone.now()
    expired, _ = IdempotencyRecord.objects.filter(created_at__lt=now - RECORD_TTL).delete()
    abandoned, _ = IdempotencyRecord.objects.filter(
        status_code__isnull=True, created_at__lt=now - IN_PROGRESS_TIMEOUT
    ).delete()
    return {"expired": expired, "abandoned": abandoned}
