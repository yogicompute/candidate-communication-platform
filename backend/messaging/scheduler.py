"""Sends scheduled messages when they are due. Run by `python manage.py run_scheduler`."""

import logging

from django.utils import timezone

from messaging.models import ScheduledMessage, ScheduledStatus
from messaging.placeholders import render
from messaging.services import create_attempt

logger = logging.getLogger(__name__)

BATCH_SIZE = 100


def _claim(pk: int) -> bool:
    """Move one row from scheduled to sending. The conditional UPDATE is atomic on SQLite and
    PostgreSQL, so a row is claimed by exactly one scheduler and a cancelled row is never sent."""
    return bool(
        ScheduledMessage.objects.filter(pk=pk, status=ScheduledStatus.SCHEDULED).update(
            status=ScheduledStatus.SENDING, updated_at=timezone.now()
        )
    )


def dispatch_due() -> dict[str, int]:
    """Send every scheduled message whose time has come. Returns counts for logging."""
    counts = {"sent": 0, "cancelled": 0, "errors": 0}
    due = list(
        ScheduledMessage.objects.filter(status=ScheduledStatus.SCHEDULED, scheduled_for__lte=timezone.now())
        .order_by("scheduled_for", "id")
        .values_list("pk", flat=True)[:BATCH_SIZE]
    )
    for pk in due:
        if not _claim(pk):
            continue
        item = ScheduledMessage.objects.select_related("candidate").get(pk=pk)
        candidate = item.candidate
        if candidate.deleted_at is not None:
            item.status, item.cancelled_at = ScheduledStatus.CANCELLED, timezone.now()
            item.save(update_fields=["status", "cancelled_at", "updated_at"])
            counts["cancelled"] += 1
            continue
        try:
            message = create_attempt(
                candidate, render(item.body, candidate.full_name), bulk_request_id=item.group_id
            )
        except Exception:
            # Left in "sending" on purpose: the attempt may already exist, and re-sending could
            # message the candidate twice. Provider errors never get here; they become failed Messages.
            logger.exception("Scheduled message %s could not be sent", item.public_id)
            counts["errors"] += 1
            continue
        item.status, item.message = ScheduledStatus.SENT, message
        item.save(update_fields=["status", "message", "updated_at"])
        counts["sent"] += 1
    return counts
