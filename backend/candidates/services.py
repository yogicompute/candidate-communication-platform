import re
from datetime import datetime

from django.db import IntegrityError, transaction
from django.db.models import Case, CharField, Exists, F, OuterRef, Q, QuerySet, Subquery, Value, When
from django.utils import timezone

from candidates.models import Candidate, generate_public_id
from config.exceptions import ApiError
from messaging.models import Message, ScheduledMessage, ScheduledStatus

MAX_PUBLIC_ID_ATTEMPTS = 5


def with_last_message(queryset: QuerySet[Candidate]) -> QuerySet[Candidate]:
    """Annotate the date of the last sent message and the candidate's most recent status:
    "scheduled" while a scheduled message is waiting, else "cancelled" if a cancellation is newer
    than the last sent message, else that message's delivery status."""
    latest = Message.objects.filter(candidate=OuterRef("pk")).order_by("-created_at", "-id")
    upcoming = ScheduledMessage.objects.filter(
        candidate=OuterRef("pk"), status__in=[ScheduledStatus.SCHEDULED, ScheduledStatus.SENDING]
    )
    last_cancelled = ScheduledMessage.objects.filter(
        candidate=OuterRef("pk"), status=ScheduledStatus.CANCELLED
    ).order_by("-cancelled_at", "-id")
    cancelled_is_newest = Q(last_cancelled_at__isnull=False) & (
        Q(last_message_at__isnull=True) | Q(last_cancelled_at__gt=F("last_message_at"))
    )
    return queryset.annotate(
        last_message_at=Subquery(latest.values("created_at")[:1]),
        latest_message_status=Subquery(latest.values("status")[:1]),
        has_upcoming_scheduled=Exists(upcoming),
        last_cancelled_at=Subquery(last_cancelled.values("cancelled_at")[:1]),
    ).annotate(
        last_message_status=Case(
            When(has_upcoming_scheduled=True, then=Value(ScheduledStatus.SCHEDULED.value)),
            When(cancelled_is_newest, then=Value(ScheduledStatus.CANCELLED.value)),
            default=F("latest_message_status"),
            output_field=CharField(),
        )
    )


def _apply_search(queryset: QuerySet[Candidate], search: str) -> QuerySet[Candidate]:
    term = search.strip()
    if not term:
        return queryset
    condition = Q(full_name__icontains=term) | Q(email__icontains=term) | Q(public_id__iexact=term)
    digits = re.sub(r"\D", "", term)
    if len(digits) >= 3:
        condition |= Q(phone__contains=digits)
    return queryset.filter(condition)


def filter_candidates(
    *,
    search: str = "",
    name: str = "",
    phone: str = "",
    candidate_id: str = "",
    status: str | None = None,
    last_message_after: datetime | None = None,
    last_message_before: datetime | None = None,
) -> QuerySet[Candidate]:
    queryset = _apply_search(with_last_message(Candidate.objects.active()), search)
    if name.strip():
        queryset = queryset.filter(full_name__icontains=name.strip())
    phone_digits = re.sub(r"\D", "", phone)
    if phone_digits:
        queryset = queryset.filter(phone__contains=phone_digits)
    if candidate_id.strip():
        queryset = queryset.filter(public_id__icontains=candidate_id.strip())
    if status == "none":
        queryset = queryset.filter(last_message_status__isnull=True)
    elif status:
        queryset = queryset.filter(last_message_status=status)
    if last_message_after:
        queryset = queryset.filter(last_message_at__gte=last_message_after)
    if last_message_before:
        queryset = queryset.filter(last_message_at__lt=last_message_before)
    return queryset.order_by("-created_at", "-id")


def get_candidate(public_id: str) -> Candidate:
    try:
        return with_last_message(Candidate.objects.active()).get(public_id=public_id.upper())
    except Candidate.DoesNotExist:
        raise ApiError(
            "This candidate does not exist or was removed.", code="not_found", status_code=404
        ) from None


def _raise_if_duplicate(phone: str, email: str) -> None:
    fields = {}
    if Candidate.objects.active().filter(phone=phone).exists():
        fields["phone"] = "A candidate with this mobile number already exists."
    if Candidate.objects.active().filter(email__iexact=email).exists():
        fields["email"] = "A candidate with this email already exists."
    if fields:
        raise ApiError(
            "This candidate already exists.",
            code="duplicate_candidate",
            status_code=409,
            fields=fields,
        )


def create_candidate(*, full_name: str, phone: str, email: str) -> Candidate:
    _raise_if_duplicate(phone, email)
    for _ in range(MAX_PUBLIC_ID_ATTEMPTS):
        try:
            with transaction.atomic():
                candidate = Candidate.objects.create(
                    public_id=generate_public_id(),
                    full_name=full_name,
                    phone=phone,
                    email=email,
                )
        except IntegrityError:
            _raise_if_duplicate(phone, email)
            continue
        return get_candidate(candidate.public_id)
    raise RuntimeError("Could not allocate a unique candidate ID.")


def delete_candidates(public_ids: list[str]) -> list[str]:
    """Soft-delete: hide candidates everywhere but keep their message history for records."""
    now = timezone.now()
    with transaction.atomic():
        deleted_ids = list(
            Candidate.objects.active()
            .select_for_update()
            .filter(public_id__in=public_ids)
            .values_list("public_id", flat=True)
        )
        Candidate.objects.filter(public_id__in=deleted_ids).update(deleted_at=now, updated_at=now)
    return deleted_ids