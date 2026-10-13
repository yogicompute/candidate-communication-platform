import logging
import uuid
from dataclasses import dataclass

from django.utils import timezone

from candidates.models import Candidate
from candidates.services import get_candidate
from messaging.failures import failure_message
from messaging.models import Message, MessageStatus
from messaging.status import apply_status
from providers.base import MessagingProvider
from providers.registry import get_provider

logger = logging.getLogger(__name__)

HISTORY_LIMIT = 200


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
    candidates = {c.public_id: c for c in Candidate.objects.filter(public_id__in=candidate_public_ids)}
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