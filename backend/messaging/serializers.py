from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from messaging.failures import failure_message, is_retryable
from messaging.models import (
    MAX_BULK_RECIPIENTS,
    MESSAGE_MAX_LENGTH,
    TEMPLATE_NAME_MAX_LENGTH,
    Message,
    MessageTemplate,
    ScheduledMessage,
)
from messaging.placeholders import render, validate_placeholders

MAX_SCHEDULE_AHEAD = timedelta(days=365)

BODY_REQUIRED = "Write a message before sending."


def message_body_field() -> serializers.CharField:
    return serializers.CharField(
        max_length=MESSAGE_MAX_LENGTH,
        error_messages={
            "required": BODY_REQUIRED,
            "blank": BODY_REQUIRED,
            "null": BODY_REQUIRED,
            "max_length": f"Messages can be up to {MESSAGE_MAX_LENGTH} characters.",
        },
        validators=[validate_placeholders],
    )


def candidate_id_field() -> serializers.CharField:
    return serializers.CharField(
        max_length=20,
        error_messages={"required": "Choose a candidate.", "blank": "Choose a candidate."},
    )


class SendMessageSerializer(serializers.Serializer):
    candidate_id = candidate_id_field()
    body = message_body_field()

    def validate_candidate_id(self, value: str) -> str:
        return value.strip().upper()


class BulkSendSerializer(serializers.Serializer):
    candidate_ids = serializers.ListField(
        child=candidate_id_field(),
        allow_empty=False,
        max_length=MAX_BULK_RECIPIENTS,
        error_messages={
            "required": "Select at least one candidate.",
            "empty": "Select at least one candidate.",
            "max_length": f"You can message up to {MAX_BULK_RECIPIENTS} candidates at once.",
        },
    )
    body = message_body_field()

    def validate_candidate_ids(self, value: list[str]) -> list[str]:
        return list(dict.fromkeys(item.strip().upper() for item in value))


class ScheduleSerializer(BulkSendSerializer):
    scheduled_for = serializers.DateTimeField(
        error_messages={
            "required": "Choose when to send the message.",
            "null": "Choose when to send the message.",
            "invalid": "Choose a valid date and time.",
        }
    )

    def validate_scheduled_for(self, value):
        now = timezone.now()
        if value <= now:
            raise serializers.ValidationError("Choose a time in the future.")
        if value > now + MAX_SCHEDULE_AHEAD:
            raise serializers.ValidationError("You can schedule up to a year ahead.")
        return value


class MessageSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="public_id", read_only=True)
    candidate_id = serializers.CharField(source="candidate.public_id", read_only=True)
    retry_of_id = serializers.SerializerMethodField()
    retried_by_id = serializers.SerializerMethodField()
    failure = serializers.SerializerMethodField()
    can_retry = serializers.BooleanField(read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "candidate_id",
            "body",
            "status",
            "provider_reference",
            "bulk_request_id",
            "attempt_number",
            "retry_of_id",
            "retried_by_id",
            "failure",
            "can_retry",
            "created_at",
            "updated_at",
            "sent_at",
            "delivered_at",
            "read_at",
            "failed_at",
        ]

    def get_retry_of_id(self, message: Message) -> str | None:
        return message.retry_of.public_id if message.retry_of_id else None

    def get_retried_by_id(self, message: Message) -> str | None:
        attempt = message.retry_attempt
        return attempt.public_id if attempt else None

    def get_failure(self, message: Message) -> dict | None:
        if not message.failure_code:
            return None
        return {
            "code": message.failure_code,
            "message": failure_message(message.failure_code),
            "retryable": is_retryable(message.failure_code),
        }


class MessageTemplateSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="public_id", read_only=True)
    name = serializers.CharField(
        max_length=TEMPLATE_NAME_MAX_LENGTH,
        error_messages={
            "required": "Give the template a name.",
            "blank": "Give the template a name.",
            "null": "Give the template a name.",
            "max_length": f"Names can be up to {TEMPLATE_NAME_MAX_LENGTH} characters.",
        },
    )
    body = message_body_field()

    class Meta:
        model = MessageTemplate
        fields = ["id", "name", "body", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]



class ScheduledMessageSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="public_id", read_only=True)
    candidate_id = serializers.CharField(source="candidate.public_id", read_only=True)
    body = serializers.SerializerMethodField()
    message_id = serializers.SerializerMethodField()
    can_cancel = serializers.BooleanField(read_only=True)

    class Meta:
        model = ScheduledMessage
        fields = [
            "id",
            "candidate_id",
            "body",
            "scheduled_for",
            "status",
            "group_id",
            "message_id",
            "can_cancel",
            "created_at",
            "cancelled_at",
        ]

    def get_body(self, item: ScheduledMessage) -> str:
        # Shown as this candidate will receive it.
        return render(item.body, item.candidate.full_name)

    def get_message_id(self, item: ScheduledMessage) -> str | None:
        return item.message.public_id if item.message_id else None
