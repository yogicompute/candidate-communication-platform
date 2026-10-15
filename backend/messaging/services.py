import logging
import uuid
from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.utils import timezone

from candidates.models import Candidate
from candidates.services import get_candidate
from config.exceptions import ApiError
from messaging.failures import failure_message, is_retryable
from messaging.models import (
    MAX_ATTEMPTS,
    MESSAGE_MAX_LENGTH,
    Message,
    MessageStatus,
    MessageTemplate,
    ScheduledMessage,
    ScheduledStatus,
)
from messaging.placeholders import render
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


def _check_rendered_length(body: str, candidates: list[Candidate]) -> None:
    """Names can push a valid template over the limit; reject before anything is sent."""
    for candidate in candidates:
        length = len(render(body, candidate.full_name))
        if length > MESSAGE_MAX_LENGTH:
            raise ApiError(
                "Please fix the message.",
                code="validation_error",
                fields={
                    "body": (
                        f"With names filled in, this message is {length} characters for "
                        f"{candidate.full_name}. Keep it to {MESSAGE_MAX_LENGTH}."
                    )
                },
            )


def send_message(candidate_public_id: str, body: str) -> Message:
    candidate = get_candidate(candidate_public_id)
    _check_rendered_length(body, [candidate])
    return create_attempt(candidate, render(body, candidate.full_name))


def send_bulk(candidate_public_ids: list[str], body: str) -> tuple[str, list[RecipientResult]]:
    """Send one independent message per recipient. A failure for one never stops the others."""
    bulk_request_id = f"bulk_{uuid.uuid4().hex}"
    candidates = {
        c.public_id: c for c in Candidate.objects.active().filter(public_id__in=candidate_public_ids)
    }
    _check_rendered_length(body, list(candidates.values()))
    results: list[RecipientResult] = []

    for public_id in candidate_public_ids:
        candidate = candidates.get(public_id)
        if candidate is None:
            results.append(RecipientResult(public_id, None, None, "This candidate no longer exists."))
            continue
        try:
            message = create_attempt(
                candidate, render(body, candidate.full_name), bulk_request_id=bulk_request_id
            )
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


@dataclass
class ScheduleResult:
    candidate_id: str
    candidate_name: str | None
    scheduled: ScheduledMessage | None
    error: str | None


def schedule_messages(
    candidate_public_ids: list[str], body: str, scheduled_for
) -> tuple[str | None, list[ScheduleResult]]:
    """Store one ScheduledMessage per recipient; run_scheduler sends them when due."""
    candidates = {
        c.public_id: c for c in Candidate.objects.active().filter(public_id__in=candidate_public_ids)
    }
    _check_rendered_length(body, list(candidates.values()))
    # Several recipients share a group id, which becomes the bulk_request_id of the sent messages.
    group_id = f"bulk_{uuid.uuid4().hex}" if len(candidate_public_ids) > 1 else None
    results: list[ScheduleResult] = []
    with transaction.atomic():
        for public_id in candidate_public_ids:
            candidate = candidates.get(public_id)
            if candidate is None:
                results.append(ScheduleResult(public_id, None, None, "This candidate no longer exists."))
                continue
            item = ScheduledMessage.objects.create(
                candidate=candidate, body=body, scheduled_for=scheduled_for, group_id=group_id
            )
            results.append(ScheduleResult(public_id, candidate.full_name, item, None))
    return group_id, results


def list_candidate_scheduled(candidate_public_id: str) -> list[ScheduledMessage]:
    """Upcoming and cancelled items. Sent ones appear in the history as their Message instead."""
    candidate = get_candidate(candidate_public_id)
    return list(
        ScheduledMessage.objects.filter(candidate=candidate)
        .exclude(status=ScheduledStatus.SENT)
        .select_related("candidate", "message")
        .order_by("scheduled_for", "id")[:HISTORY_LIMIT]
    )


def cancel_scheduled(public_id: str) -> ScheduledMessage:
    now = timezone.now()
    # Conditional update: the scheduler may be claiming the same row right now.
    cancelled = ScheduledMessage.objects.filter(
        public_id=public_id, status=ScheduledStatus.SCHEDULED
    ).update(status=ScheduledStatus.CANCELLED, cancelled_at=now, updated_at=now)
    item = ScheduledMessage.objects.select_related("candidate", "message").filter(public_id=public_id).first()
    if item is None:
        raise ApiError("This scheduled message no longer exists.", code="not_found", status_code=404)
    if not cancelled:
        reason = {
            ScheduledStatus.SENDING: "This message is being sent right now, so it can't be cancelled.",
            ScheduledStatus.SENT: "This message was already sent.",
            ScheduledStatus.CANCELLED: "This message was already cancelled.",
        }[item.status]
        raise ApiError(reason, code="not_cancellable", status_code=409)
    return item


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


DUPLICATE_TEMPLATE = "A template with this name already exists."


def list_templates() -> list[MessageTemplate]:
    return list(MessageTemplate.objects.all())


def get_template(public_id: str) -> MessageTemplate:
    template = MessageTemplate.objects.filter(public_id=public_id).first()
    if template is None:
        raise ApiError("This template no longer exists.", code="not_found", status_code=404)
    return template


def save_template(template: MessageTemplate, *, name: str, body: str) -> MessageTemplate:
    """Create or update a template. Names are unique regardless of case."""
    duplicate = MessageTemplate.objects.filter(name__iexact=name).exclude(pk=template.pk).exists()
    if not duplicate:
        template.name, template.body = name, body
        try:
            with transaction.atomic():
                template.save()
            return template
        except IntegrityError:
            pass  # Another request saved the same name in between.
    raise ApiError(
        DUPLICATE_TEMPLATE, code="duplicate_template", status_code=409, fields={"name": DUPLICATE_TEMPLATE}
    )


def delete_template(public_id: str) -> None:
    get_template(public_id).delete()
