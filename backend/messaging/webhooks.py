import logging

from django.db import IntegrityError, transaction

from messaging.models import EventOutcome, Message, MessageEvent
from messaging.status import apply_status
from providers.base import StatusEvent

logger = logging.getLogger(__name__)


def process_status_event(provider_name: str, event: StatusEvent) -> dict:
    """Apply one provider status callback to its message.

    Idempotent: each (provider, event_id) is recorded exactly once. A repeated callback is
    acknowledged without touching the message. Out-of-order or disallowed transitions are
    recorded as ignored. The message is persisted only when the transition is accepted.
    """
    with transaction.atomic():
        try:
            message = Message.objects.select_for_update().get(
                provider=provider_name, provider_reference=event.reference
            )
        except Message.DoesNotExist:
            logger.warning(
                "Provider %s sent a callback for unknown reference %s", provider_name, event.reference
            )
            return {"result": "unknown_reference", "reference": event.reference}

        changed = apply_status(message, event.status, event.occurred_at, event.failure_code)
        outcome = EventOutcome.APPLIED if changed else EventOutcome.IGNORED

        try:
            with transaction.atomic():
                MessageEvent.objects.create(
                    message=message,
                    provider=provider_name,
                    event_id=event.event_id,
                    status=event.status,
                    failure_code=event.failure_code,
                    occurred_at=event.occurred_at,
                    outcome=outcome,
                )
        except IntegrityError:
            # (provider, event_id) already recorded: this exact callback was processed before.
            return {"result": "duplicate", "event_id": event.event_id, "message_id": message.public_id}

        if changed:
            message.save(update_fields=changed)

    return {
        "result": str(outcome),
        "event_id": event.event_id,
        "message_id": message.public_id,
        "message_status": message.status,
    }
