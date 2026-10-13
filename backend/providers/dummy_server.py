"""Simulated SMS provider that runs as its own process.

This is NOT a real messaging service. It accepts or rejects messages based on the
recipient's last phone digit and later POSTs signed status callbacks to Django.

Run from backend/:  python -m providers.dummy_server
"""

import argparse
import hashlib
import hmac
import json
import logging
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import error, request

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_KEY = os.getenv("DUMMY_PROVIDER_API_KEY", "")
WEBHOOK_SECRET = os.getenv("PROVIDER_WEBHOOK_SECRET", "")
WEBHOOK_URL = os.getenv("PROVIDER_WEBHOOK_URL", "http://127.0.0.1:8000/api/v1/webhooks/provider/")
MAX_BODY_BYTES = 16_384
CALLBACK_ATTEMPTS = 3

logger = logging.getLogger("dummy_provider")


@dataclass
class Acceptance:
    reference: str
    send_count: int
    is_new: bool


@dataclass
class Rejection:
    http_status: int
    code: str
    headers: dict[str, str] = field(default_factory=dict)


def rejection_for(last_digit: str, send_count: int) -> Rejection | None:
    first_of_pair = send_count % 2 == 1
    if last_digit == "9":
        return Rejection(400, "INVALID_DESTINATION")
    if last_digit == "8" and first_of_pair:
        return Rejection(503, "SERVICE_UNAVAILABLE")
    if last_digit == "7" and first_of_pair:
        return Rejection(429, "THROTTLED", {"Retry-After": "30"})
    return None


class ProviderState:
    def __init__(self):
        self.lock = threading.Lock()
        self.outage = False
        self.send_counts: dict[str, int] = {}
        self.references: dict[str, str] = {}

    def accept(self, to: str, client_reference: str) -> Acceptance | Rejection:
        with self.lock:
            if self.outage:
                return Rejection(503, "SERVICE_UNAVAILABLE")
            if client_reference in self.references:
                return Acceptance(self.references[client_reference], 0, is_new=False)
            send_count = self.send_counts.get(to, 0) + 1
            self.send_counts[to] = send_count
            rejection = rejection_for(to[-1], send_count)
            if rejection:
                return rejection
            reference = f"SIM-{uuid.uuid4().hex[:12].upper()}"
            self.references[client_reference] = reference
            return Acceptance(reference, send_count, is_new=True)


STATE = ProviderState()


def plan_callbacks(reference: str, last_digit: str, send_count: int) -> list[tuple[float, dict]]:
    now = datetime.now(timezone.utc)

    def event(status: str, offset: float, error_code: str | None = None) -> dict:
        return {
            "event_id": f"evt_{uuid.uuid4().hex}",
            "provider_reference": reference,
            "status": status,
            "occurred_at": (now + timedelta(seconds=offset)).isoformat(),
            "error_code": error_code,
        }

    sent = event("sent", 1.5)
    if last_digit == "6":
        return [(1.5, sent), (3.5, event("failed", 3.5, "CARRIER_BLOCKED"))]
    if last_digit == "5" and send_count % 2 == 1:
        return [(1.5, sent), (3.5, event("failed", 3.5, "DELIVERY_EXPIRED"))]
    delivered = event("delivered", 4.0)
    if last_digit == "4":
        return [(1.5, sent), (4.0, delivered)]
    late_sent = {**sent, "event_id": f"evt_{uuid.uuid4().hex}"}
    return [
        (1.5, sent),
        (4.0, delivered),
        (4.5, delivered),
        (5.0, late_sent),
        (8.0, event("read", 8.0)),
    ]


def deliver_callback(payload: dict) -> None:
    body = json.dumps(payload).encode()
    signature = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    label = f"{payload['status']} {payload['provider_reference']} {payload['event_id'][:12]}"
    for attempt in range(1, CALLBACK_ATTEMPTS + 1):
        callback = request.Request(
            WEBHOOK_URL,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json", "X-Provider-Signature": f"sha256={signature}"},
        )
        try:
            with request.urlopen(callback, timeout=5) as response:
                logger.info("Callback %s -> %s", label, response.status)
                return
        except error.HTTPError as exc:
            if exc.code < 500:
                logger.warning("Callback %s rejected with %s (not retrying)", label, exc.code)
                return
            logger.warning("Callback %s failed with %s (attempt %s)", label, exc.code, attempt)
        except (error.URLError, TimeoutError, OSError) as exc:
            logger.warning("Callback %s could not connect: %s (attempt %s)", label, exc, attempt)
        time.sleep(2**attempt)
    logger.error("Callback %s gave up after %s attempts", label, CALLBACK_ATTEMPTS)


def schedule_callbacks(reference: str, phone: str, send_count: int) -> None:
    for delay, payload in plan_callbacks(reference, phone[-1], send_count):
        timer = threading.Timer(delay, deliver_callback, args=(payload,))
        timer.daemon = True
        timer.start()


class ProviderHandler(BaseHTTPRequestHandler):
    server_version = "DummyProvider/1.0"

    def log_message(self, format: str, *args) -> None:
        logger.info("%s %s", self.address_string(), format % args)

    def reply(self, status: int, payload: dict, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return None
        if length <= 0 or length > MAX_BODY_BYTES:
            return None
        try:
            data = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            return None
        return data if isinstance(data, dict) else None

    def is_authorized(self) -> bool:
        return hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {API_KEY}")

    def do_GET(self) -> None:
        if self.path == "/health":
            self.reply(200, {"status": "ok", "outage": STATE.outage})
        else:
            self.reply(404, {"error": "NOT_FOUND"})

    def do_POST(self) -> None:
        if not self.is_authorized():
            self.reply(401, {"error": "UNAUTHORIZED"})
            return
        payload = self.read_json()
        if payload is None:
            self.reply(400, {"error": "INVALID_REQUEST"})
        elif self.path == "/v1/messages":
            self.handle_send(payload)
        elif self.path == "/control":
            self.handle_control(payload)
        else:
            self.reply(404, {"error": "NOT_FOUND"})

    def handle_send(self, payload: dict) -> None:
        to, body, client_reference = payload.get("to"), payload.get("body"), payload.get("client_reference")
        valid = (
            isinstance(to, str)
            and to.startswith("+")
            and isinstance(body, str)
            and body.strip()
            and isinstance(client_reference, str)
            and client_reference
        )
        if not valid:
            self.reply(400, {"error": "INVALID_REQUEST"})
            return

        decision = STATE.accept(to, client_reference)
        if isinstance(decision, Rejection):
            logger.info("Rejected %s: %s", to, decision.code)
            self.reply(decision.http_status, {"error": decision.code}, decision.headers)
            return

        if decision.is_new:
            logger.info("Accepted %s as %s (send #%s)", to, decision.reference, decision.send_count)
            schedule_callbacks(decision.reference, to, decision.send_count)
        self.reply(202, {"reference": decision.reference, "status": "accepted"})

    def handle_control(self, payload: dict) -> None:
        outage = payload.get("outage")
        if not isinstance(outage, bool):
            self.reply(400, {"error": "INVALID_REQUEST"})
            return
        with STATE.lock:
            STATE.outage = outage
        logger.warning("Outage mode %s", "ON" if outage else "OFF")
        self.reply(200, {"outage": outage})


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the simulated SMS provider.")
    parser.add_argument("--port", type=int, default=int(os.getenv("DUMMY_PROVIDER_PORT", "8100")))
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if not API_KEY or not WEBHOOK_SECRET:
        raise SystemExit("Set DUMMY_PROVIDER_API_KEY and PROVIDER_WEBHOOK_SECRET in backend/.env")

    server = ThreadingHTTPServer(("127.0.0.1", args.port), ProviderHandler)
    logger.info("Dummy provider listening on http://127.0.0.1:%s (callbacks -> %s)", args.port, WEBHOOK_URL)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()