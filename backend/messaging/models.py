import uuid

from django.db import models
from django.db.models import Q

from candidates.models import Candidate
from messaging.failures import is_retryable
from providers.base import FailureCode

MAX_ATTEMPTS = 3
MESSAGE_MAX_LENGTH = 1000


def generate_message_id() -> str:
    return f"msg_{uuid.uuid4().hex}"


class MessageStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    DELIVERED = "delivered", "Delivered"
    READ = "read", "Read"
    FAILED = "failed", "Failed"


class Message(models.Model):
    """One delivery attempt to one candidate. A retry is a new Message linked via retry_of."""

    public_id = models.CharField(max_length=40, unique=True, default=generate_message_id, editable=False)
    candidate = models.ForeignKey(Candidate, on_delete=models.PROTECT, related_name="messages")
    body = models.TextField(max_length=MESSAGE_MAX_LENGTH)
    status = models.CharField(max_length=10, choices=MessageStatus.choices, default=MessageStatus.PENDING)
    provider = models.CharField(max_length=30)
    provider_reference = models.CharField(max_length=64, unique=True, null=True, blank=True)
    bulk_request_id = models.CharField(max_length=40, null=True, blank=True, db_index=True)
    attempt_number = models.PositiveSmallIntegerField(default=1)
    retry_of = models.OneToOneField(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="retried_by"
    )
    failure_code = models.CharField(max_length=30, choices=FailureCode.choices, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["candidate", "-created_at"], name="message_candidate_recent")]
        constraints = [
            models.CheckConstraint(
                condition=Q(attempt_number__gte=1, attempt_number__lte=MAX_ATTEMPTS),
                name="message_attempt_in_range",
            ),
            models.CheckConstraint(
                condition=~Q(status=MessageStatus.FAILED) | Q(failure_code__isnull=False),
                name="message_failed_has_code",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.public_id} → {self.candidate.public_id} ({self.status})"

    @property
    def retry_attempt(self) -> "Message | None":
        try:
            return self.retried_by
        except Message.DoesNotExist:
            return None

    @property
    def can_retry(self) -> bool:
        return (
            self.status == MessageStatus.FAILED
            and is_retryable(self.failure_code)
            and self.retry_attempt is None
            and self.attempt_number < MAX_ATTEMPTS
        )