from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from django.db import models

CALLBACK_STATUSES = ("sent", "delivered", "read", "failed")


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


@dataclass(frozen=True)
class StatusEvent:
    """A provider callback translated into provider-independent terms."""

    event_id: str
    reference: str
    status: str  # One of CALLBACK_STATUSES
    occurred_at: datetime
    failure_code: FailureCode | None = None


class InvalidSignature(Exception):
    """The callback was not signed by the provider."""


class InvalidPayload(Exception):
    """The callback body is malformed; the message explains what is wrong."""


class MessagingProvider(Protocol):
    name: str

    def send(self, *, to: str, body: str, client_reference: str) -> SendResult: ...

    def parse_callback(self, *, body: bytes, headers: Mapping[str, str]) -> StatusEvent: ...