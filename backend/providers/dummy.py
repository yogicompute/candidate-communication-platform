import hashlib
import hmac
import json
import logging
from collections.abc import Mapping
from datetime import datetime
from urllib import error, request

from providers.base import (
    CALLBACK_STATUSES,
    FailureCode,
    InvalidPayload,
    InvalidSignature,
    SendResult,
    StatusEvent,
)

logger = logging.getLogger(__name__)

SIGNATURE_HEADER = "X-Provider-Signature"

PROVIDER_ERROR_CODES: dict[str, FailureCode] = {
    "INVALID_DESTINATION": FailureCode.INVALID_NUMBER,
    "CARRIER_BLOCKED": FailureCode.BLOCKED_RECIPIENT,
    "THROTTLED": FailureCode.RATE_LIMITED,
    "SERVICE_UNAVAILABLE": FailureCode.PROVIDER_UNAVAILABLE,
    "DELIVERY_EXPIRED": FailureCode.DELIVERY_TIMEOUT,
}


def to_failure_code(provider_code: str | None) -> FailureCode:
    return PROVIDER_ERROR_CODES.get(provider_code or "", FailureCode.PROVIDER_UNAVAILABLE)


def _error_code(exc: error.HTTPError) -> str | None:
    try:
        payload = json.loads(exc.read() or b"{}")
    except ValueError:
        return None
    return payload.get("error") if isinstance(payload, dict) else None


def _required_text(data: dict, field: str, max_length: int) -> str:
    value = data.get(field)
    if not isinstance(value, str) or not value.strip() or len(value) > max_length:
        raise InvalidPayload(f"'{field}' must be a non-empty string of at most {max_length} characters.")
    return value


class DummyProvider:
    """Adapter for the local simulated provider (providers/dummy_server.py)."""

    name = "dummy"

    def __init__(self, *, base_url: str, api_key: str, webhook_secret: str, timeout: float = 5.0):
        self.base_url = base_url
        self.api_key = api_key
        self.webhook_secret = webhook_secret
        self.timeout = timeout

    def send(self, *, to: str, body: str, client_reference: str) -> SendResult:
        payload = json.dumps({"to": to, "body": body, "client_reference": client_reference}).encode()
        http_request = request.Request(
            f"{self.base_url}/v1/messages",
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"},
        )
        try:
            with request.urlopen(http_request, timeout=self.timeout) as response:
                data = json.loads(response.read())
            return SendResult(accepted=True, reference=str(data["reference"]))
        except error.HTTPError as exc:
            provider_code = _error_code(exc)
            if exc.code == 401:
                logger.error("Dummy provider rejected the API key; check DUMMY_PROVIDER_API_KEY.")
            return SendResult(
                accepted=False,
                failure_code=to_failure_code(provider_code),
                detail=f"HTTP {exc.code} {provider_code}",
            )
        except (error.URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
            logger.warning("Dummy provider unreachable: %s", exc)
            return SendResult(
                accepted=False,
                failure_code=FailureCode.PROVIDER_UNAVAILABLE,
                detail=str(exc),
            )

    def parse_callback(self, *, body: bytes, headers: Mapping[str, str]) -> StatusEvent:
        expected = "sha256=" + hmac.new(self.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        received = headers.get(SIGNATURE_HEADER, "")
        if not self.webhook_secret or not hmac.compare_digest(received, expected):
            raise InvalidSignature()

        try:
            data = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            raise InvalidPayload("The body is not valid JSON.") from None
        if not isinstance(data, dict):
            raise InvalidPayload("The body must be a JSON object.")

        event_id = _required_text(data, "event_id", 100)
        reference = _required_text(data, "provider_reference", 64)
        status = data.get("status")
        if status not in CALLBACK_STATUSES:
            raise InvalidPayload(f"'status' must be one of: {', '.join(CALLBACK_STATUSES)}.")

        try:
            occurred_at = datetime.fromisoformat(_required_text(data, "occurred_at", 40))
        except ValueError:
            raise InvalidPayload("'occurred_at' must be an ISO 8601 timestamp.") from None
        if occurred_at.tzinfo is None:
            raise InvalidPayload("'occurred_at' must include a timezone.")

        failure_code = None
        if status == "failed":
            failure_code = to_failure_code(_required_text(data, "error_code", 50))

        return StatusEvent(
            event_id=event_id,
            reference=reference,
            status=status,
            occurred_at=occurred_at,
            failure_code=failure_code,
        )