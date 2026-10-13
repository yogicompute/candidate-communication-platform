import logging

from django.utils import timezone

from candidates.models import Candidate
from messaging.models import Message, MessageStatus
from messaging.status import apply_status
from providers.base import MessagingProvider
from providers.registry import get_provider

logger = logging.getLogger(__name__)


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