import logging
import uuid
from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.utils import timezone

from candidates.models import Candidate
from candidates.services import get_candidate
from config.exceptions import ApiError
from messaging.failures import failure_message, is_retryable
from messaging.models import MAX_ATTEMPTS, Message, MessageStatus
from messaging.status import apply_status
from providers.base import MessagingProvider
from providers.registry import get_provider

logger = logging.getLogger(__name__)

HISTORY_LIMIT = 200
ALREADY_RETRIED = "This message has already been retried."


@dataclass
class RecipientResult:
    candidate_id: str
    candidate_name: str | None
    message: Message | None
    error: str | None

    @property
    def accepted(self) -> bool:
        return self.message is not None and self.message.status != MessageStatus.FAILED


def create_attempt(
    candidate: Candidate,
    body: str,
    *,
    bulk_request_id: str | None = None,
    retry_of: Message | None = None,
    provider: MessagingProvider | None = None,
) -> Message:
    """Persist a pending attempt, submit it to the provider, and record the immediate outcome.

    The row is saved before the provider call so a crash never loses the attempt, and the
    provider call happens outside any transaction so no database lock is held during network I/O.
    """
    provider = provider or get_provider()
    message = Message.objects.create(
        candidate=candidate,
        body=body,
        provider=provider.name,
        bulk_request_id=bulk_request_id,
        attempt_number=retry_of.attempt_number + 1 if retry_of else 1,
        retry_of=retry_of,
    )

    result = provider.send(to=candidate.phone, body=body, client_reference=message.public_id)

    if result.accepted:
        message.provider_reference = result.reference
        message.save(update_fields=["provider_reference", "updated_at"])
    else:
        logger.info("Provider rejected %s: %s (%s)", message.public_id, result.failure_code, result.detail)
        changed = apply_status(message, MessageStatus.FAILED, timezone.now(), result.failure_code)
        message.save(update_fields=changed)
    return message


def list_candidate_messages(candidate_public_id: str) -> list[Message]:
    candidate = get_candidate(candidate_public_id)
    queryset = (
        Message.objects.filter(candidate=candidate)
        .select_related("candidate", "retry_of", "retried_by")
        .order_by("-created_at", "-id")
    )
    return list(queryset[:HISTORY_LIMIT])


def send_message(candidate_public_id: str, body: str) -> Message:
    return create_attempt(get_candidate(candidate_public_id), body)


def send_bulk(candidate_public_ids: list[str], body: str) -> tuple[str, list[RecipientResult]]:
    """Send one independent message per recipient. A failure for one never stops the others."""
    bulk_request_id = f"bulk_{uuid.uuid4().hex}"
    candidates = {
        c.public_id: c for c in Candidate.objects.active().filter(public_id__in=candidate_public_ids)
    }
    results: list[RecipientResult] = []

    for public_id in candidate_public_ids:
        candidate = candidates.get(public_id)
        if candidate is None:
            results.append(RecipientResult(public_id, None, None, "This candidate no longer exists."))
            continue
        try:
            message = create_attempt(candidate, body, bulk_request_id=bulk_request_id)
        except Exception:
            logger.exception("Bulk send %s failed for %s", bulk_request_id, public_id)
            results.append(
                RecipientResult(
                    public_id,
                    candidate.full_name,
                    None,
                    "Something went wrong while sending to this candidate.",
                )
            )
            continue
        error = failure_message(message.failure_code) if message.failure_code else None
        results.append(RecipientResult(public_id, candidate.full_name, message, error))

    return bulk_request_id, results


def _retry_block_reason(message: Message) -> str | None:
    if message.candidate.deleted_at is not None:
        return "This candidate was deleted, so the message can't be retried."
    if message.status != MessageStatus.FAILED:
        return "Only failed messages can be retried."
    if not is_retryable(message.failure_code):
        return "This failure is permanent, so the message can't be retried."
    if message.retry_attempt is not None:
        return ALREADY_RETRIED
    if message.attempt_number >= MAX_ATTEMPTS:
        return "This message has reached the retry limit."
    return None


def retry_message(message_public_id: str) -> Message:
    """Create the next attempt for one failed message. Only that message's candidate is contacted."""
    with transaction.atomic():
        original = (
            Message.objects.select_for_update()
            .select_related("candidate")
            .filter(public_id=message_public_id)
            .first()
        )
        if original is None:
            raise ApiError("This message no longer exists.", code="not_found", status_code=404)
        reason = _retry_block_reason(original)
        if reason:
            raise ApiError(reason, code="not_retryable", status_code=409)

    try:
        return create_attempt(
            original.candidate,
            original.body,
            bulk_request_id=original.bulk_request_id,
            retry_of=original,
        )
    except IntegrityError:
        raise ApiError(ALREADY_RETRIED, code="not_retryable", status_code=409) from None