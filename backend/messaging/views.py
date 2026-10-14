import logging

from rest_framework.response import Response
from rest_framework.views import APIView

from config.exceptions import ApiError
from messaging.idempotency import get_idempotency_key, run_idempotent
from messaging.serializers import BulkSendSerializer, MessageSerializer, SendMessageSerializer
from messaging.services import (
    RecipientResult,
    list_candidate_messages,
    retry_message,
    send_bulk,
    send_message,
)
from messaging.webhooks import process_status_event
from providers.base import InvalidPayload, InvalidSignature
from providers.registry import get_provider

logger = logging.getLogger(__name__)

REPLAY_HEADER = "Idempotent-Replayed"


def _bulk_body(bulk_request_id: str, results: list[RecipientResult]) -> dict:
    rows = [
        {
            "candidate_id": result.candidate_id,
            "candidate_name": result.candidate_name,
            "accepted": result.accepted,
            "message": MessageSerializer(result.message).data if result.message else None,
            "error": result.error,
        }
        for result in results
    ]
    accepted_count = sum(1 for row in rows if row["accepted"])
    return {
        "bulk_request_id": bulk_request_id,
        "total": len(rows),
        "accepted_count": accepted_count,
        "failed_count": len(rows) - accepted_count,
        "results": rows,
    }


def _respond(status_code: int, body: dict, replayed: bool) -> Response:
    headers = {REPLAY_HEADER: "true"} if replayed else None
    return Response(body, status=status_code, headers=headers)


class CandidateMessagesView(APIView):
    def get(self, request, public_id: str):
        messages = list_candidate_messages(public_id)
        return Response({"results": MessageSerializer(messages, many=True).data})


class MessageCreateView(APIView):
    def post(self, request):
        key = get_idempotency_key(request)
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        def handler() -> tuple[int, dict]:
            message = send_message(data["candidate_id"], data["body"])
            return 201, dict(MessageSerializer(message).data)

        return _respond(*run_idempotent(key=key, scope="messages.send", payload=data, handler=handler))


class BulkMessageView(APIView):
    def post(self, request):
        key = get_idempotency_key(request)
        serializer = BulkSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        def handler() -> tuple[int, dict]:
            bulk_request_id, results = send_bulk(data["candidate_ids"], data["body"])
            return 200, _bulk_body(bulk_request_id, results)

        return _respond(*run_idempotent(key=key, scope="messages.bulk", payload=data, handler=handler))


class RetryMessageView(APIView):
    def post(self, request, public_id: str):
        key = get_idempotency_key(request)

        def handler() -> tuple[int, dict]:
            return 201, dict(MessageSerializer(retry_message(public_id)).data)

        payload = {"message_id": public_id}
        return _respond(*run_idempotent(key=key, scope="messages.retry", payload=payload, handler=handler))


class ProviderWebhookView(APIView):
    """Receives signed status callbacks from the provider. Never called by the frontend."""

    def post(self, request):
        provider = get_provider()
        try:
            event = provider.parse_callback(body=request.body, headers=request.headers)
        except InvalidSignature:
            logger.warning("Rejected a provider callback with a missing or invalid signature.")
            raise ApiError("Invalid signature.", code="unauthorized", status_code=401) from None
        except InvalidPayload as exc:
            raise ApiError(str(exc), code="invalid_payload", status_code=400) from None

        return Response(process_status_event(provider.name, event))
