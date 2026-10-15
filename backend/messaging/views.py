import logging

from rest_framework.response import Response
from rest_framework.views import APIView

from config.exceptions import ApiError
from messaging.idempotency import get_idempotency_key, run_idempotent
from messaging.models import MessageTemplate
from messaging.serializers import (
    BulkSendSerializer,
    MessageSerializer,
    MessageTemplateSerializer,
    ScheduledMessageSerializer,
    ScheduleSerializer,
    SendMessageSerializer,
)
from messaging.services import (
    RecipientResult,
    ScheduleResult,
    cancel_scheduled,
    delete_template,
    get_template,
    list_candidate_messages,
    list_candidate_scheduled,
    list_templates,
    retry_message,
    save_template,
    schedule_messages,
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


def _schedule_body(group_id: str | None, scheduled_for, results: list[ScheduleResult]) -> dict:
    rows = [
        {
            "candidate_id": result.candidate_id,
            "candidate_name": result.candidate_name,
            "accepted": result.scheduled is not None,
            "scheduled_message": ScheduledMessageSerializer(result.scheduled).data if result.scheduled else None,
            "error": result.error,
        }
        for result in results
    ]
    accepted_count = sum(1 for row in rows if row["accepted"])
    return {
        "group_id": group_id,
        "scheduled_for": scheduled_for.isoformat(),
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


class ScheduleMessagesView(APIView):
    def post(self, request):
        key = get_idempotency_key(request)
        serializer = ScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        def handler() -> tuple[int, dict]:
            group_id, results = schedule_messages(data["candidate_ids"], data["body"], data["scheduled_for"])
            return 201, _schedule_body(group_id, data["scheduled_for"], results)

        return _respond(*run_idempotent(key=key, scope="messages.schedule", payload=data, handler=handler))


class CandidateScheduledView(APIView):
    def get(self, request, public_id: str):
        items = list_candidate_scheduled(public_id)
        return Response({"results": ScheduledMessageSerializer(items, many=True).data})


class CancelScheduledView(APIView):
    def post(self, request, public_id: str):
        return Response(ScheduledMessageSerializer(cancel_scheduled(public_id)).data)


class RetryMessageView(APIView):
    def post(self, request, public_id: str):
        key = get_idempotency_key(request)

        def handler() -> tuple[int, dict]:
            return 201, dict(MessageSerializer(retry_message(public_id)).data)

        payload = {"message_id": public_id}
        return _respond(*run_idempotent(key=key, scope="messages.retry", payload=payload, handler=handler))


class TemplateListCreateView(APIView):
    def get(self, request):
        return Response({"results": MessageTemplateSerializer(list_templates(), many=True).data})

    def post(self, request):
        serializer = MessageTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = save_template(MessageTemplate(), **serializer.validated_data)
        return Response(MessageTemplateSerializer(template).data, status=201)


class TemplateDetailView(APIView):
    def get(self, request, public_id: str):
        return Response(MessageTemplateSerializer(get_template(public_id)).data)

    def patch(self, request, public_id: str):
        template = get_template(public_id)
        serializer = MessageTemplateSerializer(template, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = {"name": template.name, "body": template.body, **serializer.validated_data}
        return Response(MessageTemplateSerializer(save_template(template, **data)).data)

    def delete(self, request, public_id: str):
        delete_template(public_id)
        return Response(status=204)


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
