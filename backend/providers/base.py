from dataclasses import dataclass
from typing import Protocol

from django.db import models


class FailureCode(models.TextChoices):
    """Provider-independent failure codes. Each provider adapter maps its own errors onto these."""

    INVALID_NUMBER = "invalid_number", "Invalid number"
    BLOCKED_RECIPIENT = "blocked_recipient", "Blocked by carrier"
    RATE_LIMITED = "rate_limited", "Rate limited"
    PROVIDER_UNAVAILABLE = "provider_unavailable", "Provider unavailable"
    DELIVERY_TIMEOUT = "delivery_timeout", "Delivery timed out"


@dataclass(frozen=True)
class SendResult:
    accepted: bool
    reference: str | None = None
    failure_code: FailureCode | None = None
    detail: str = ""  # Diagnostic text for server logs only; never shown to recruiters.


class MessagingProvider(Protocol):
    name: str

    def send(self, *, to: str, body: str, client_reference: str) -> SendResult: ...