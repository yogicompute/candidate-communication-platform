import re

from django.db import IntegrityError, transaction
from django.db.models import OuterRef, Q, QuerySet, Subquery

from candidates.models import Candidate, generate_public_id
from config.exceptions import ApiError
from messaging.models import Message

MAX_PUBLIC_ID_ATTEMPTS = 5


def with_last_message(queryset: QuerySet[Candidate]) -> QuerySet[Candidate]:
    latest = Message.objects.filter(candidate=OuterRef("pk")).order_by("-created_at", "-id")
    return queryset.annotate(
        last_message_at=Subquery(latest.values("created_at")[:1]),
        last_message_status=Subquery(latest.values("status")[:1]),
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


def filter_candidates(*, search: str = "", status: str | None = None) -> QuerySet[Candidate]:
    queryset = _apply_search(with_last_message(Candidate.objects.all()), search)
    if status == "none":
        queryset = queryset.filter(last_message_status__isnull=True)
    elif status:
        queryset = queryset.filter(last_message_status=status)
    return queryset.order_by("-created_at", "-id")


def get_candidate(public_id: str) -> Candidate:
    try:
        return with_last_message(Candidate.objects.all()).get(public_id=public_id.upper())
    except Candidate.DoesNotExist:
        raise ApiError(
            "This candidate does not exist or was removed.", code="not_found", status_code=404
        ) from None


def _raise_if_duplicate(phone: str, email: str) -> None:
    fields = {}
    if Candidate.objects.filter(phone=phone).exists():
        fields["phone"] = "A candidate with this mobile number already exists."
    if Candidate.objects.filter(email__iexact=email).exists():
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