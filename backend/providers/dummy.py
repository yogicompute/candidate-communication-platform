import json
import logging
from urllib import error, request

from providers.base import FailureCode, SendResult

logger = logging.getLogger(__name__)

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


class DummyProvider:
    """HTTP client for the local simulated provider (providers/dummy_server.py)."""

    name = "dummy"

    def __init__(self, *, base_url: str, api_key: str, timeout: float = 5.0):
        self.base_url = base_url
        self.api_key = api_key
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