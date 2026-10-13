from datetime import datetime

from messaging.models import Message, MessageStatus
from providers.base import FailureCode

PROGRESS_ORDER = [MessageStatus.PENDING, MessageStatus.SENT, MessageStatus.DELIVERED, MessageStatus.READ]
TERMINAL_STATUSES = {MessageStatus.READ, MessageStatus.FAILED}


def can_transition(current: str, new: str) -> bool:
    """Statuses only move forward; failure is possible only before delivery; read/failed are final."""
    if current in TERMINAL_STATUSES or current == new:
        return False
    if new == MessageStatus.FAILED:
        return current in (MessageStatus.PENDING, MessageStatus.SENT)
    if new not in PROGRESS_ORDER:
        return False
    return PROGRESS_ORDER.index(new) > PROGRESS_ORDER.index(current)


def apply_status(
    message: Message,
    new_status: str,
    occurred_at: datetime,
    failure_code: str | None = None,
) -> list[str] | None:
    """Update the message in memory. Returns the changed fields, or None if the transition is not allowed."""
    if not can_transition(message.status, new_status):
        return None

    changed = ["status", "updated_at"]
    message.status = new_status
    if new_status == MessageStatus.FAILED:
        message.failed_at = occurred_at
        message.failure_code = failure_code or FailureCode.DELIVERY_TIMEOUT
        return changed + ["failed_at", "failure_code"]

    if message.sent_at is None:
        message.sent_at = occurred_at
        changed.append("sent_at")
    if new_status in (MessageStatus.DELIVERED, MessageStatus.READ) and message.delivered_at is None:
        message.delivered_at = occurred_at
        changed.append("delivered_at")
    if new_status == MessageStatus.READ:
        message.read_at = occurred_at
        changed.append("read_at")
    return changed