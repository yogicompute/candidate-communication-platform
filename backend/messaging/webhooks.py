import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from config.exceptions import ApiError
from messaging.models import EventOutcome, Message, MessageEvent
from messaging.status import apply_status
from providers.base import StatusEvent

logger = logging.getLogger(__name__)

DUPLICATE = "duplicate"
MAX_CLOCK_SKEW = timedelta(minutes=5)


def process_status_event(provider_name: str, event: StatusEvent) -> str:
    """Apply one provider callback exactly once. Returns 'applied', 'ignored' or 'duplicate'."""
    if event.occurred_at > timezone.now() + MAX_CLOCK_SKEW:
        raise ApiError("'occurred_at' is too far in the future.", code="invalid_payload", status_code=400)

    try:
        with transaction.atomic():
            message = (
                Message.objects.select_for_update()
                .filter(provider=provider_name, provider_reference=event.reference)
                .first()
            )
            if message is None:
                raise ApiError("Unknown provider reference.", code="not_found", status_code=404)

            if MessageEvent.objects.filter(provider=provider_name, event_id=event.event_id).exists():
                return DUPLICATE

            changed = apply_status(message, event.status, event.occurred_at, event.failure_code)
            if changed:
                message.save(update_fields=changed)
            outcome = EventOutcome.APPLIED if changed else EventOutcome.IGNORED

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
        return DUPLICATE

    logger.info("Callback %s for %s: %s -> %s", event.event_id, message.public_id, event.status, outcome)
    return outcome