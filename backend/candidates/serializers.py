import re

from rest_framework import serializers

E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")
INDIAN_MOBILE_PATTERN = re.compile(r"^\+91[6-9]\d{9}$")
PHONE_ERROR = "Enter a valid mobile number, e.g. 9876543210 or +91 9876543210."

STATUS_FILTERS = ("pending", "sent", "delivered", "read", "failed", "none")


def normalize_phone(raw: str) -> str:
    compact = re.sub(r"[\s()-]", "", raw)
    if re.fullmatch(r"\d{10}", compact):
        return f"+91{compact}"
    if re.fullmatch(r"0\d{10}", compact):
        return f"+91{compact[1:]}"
    if re.fullmatch(r"91\d{10}", compact):
        return f"+{compact}"
    return compact


class CandidateSerializer(serializers.Serializer):
    id = serializers.CharField(source="public_id", read_only=True)
    full_name = serializers.CharField(read_only=True)
    phone = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True, allow_null=True)
    last_message_status = serializers.CharField(read_only=True, allow_null=True)


class CandidateCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(
        max_length=100,
        error_messages={
            "required": "Enter the candidate's full name.",
            "blank": "Enter the candidate's full name.",
            "null": "Enter the candidate's full name.",
            "max_length": "Name must be 100 characters or fewer.",
        },
    )
    phone = serializers.CharField(
        max_length=20,
        error_messages={
            "required": "Enter a mobile number.",
            "blank": "Enter a mobile number.",
            "null": "Enter a mobile number.",
            "max_length": PHONE_ERROR,
        },
    )
    email = serializers.EmailField(
        max_length=254,
        error_messages={
            "required": "Enter an email address.",
            "blank": "Enter an email address.",
            "null": "Enter an email address.",
            "invalid": "Enter a valid email address.",
            "max_length": "Enter a valid email address.",
        },
    )

    def validate_full_name(self, value: str) -> str:
        name = " ".join(value.split())
        if len(name) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters.")
        if any(char.isdigit() for char in name):
            raise serializers.ValidationError("Name should not contain numbers.")
        return name

    def validate_phone(self, value: str) -> str:
        phone = normalize_phone(value)
        is_invalid_indian = phone.startswith("+91") and not INDIAN_MOBILE_PATTERN.match(phone)
        if not E164_PATTERN.match(phone) or is_invalid_indian:
            raise serializers.ValidationError(PHONE_ERROR)
        return phone

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class CandidateListQuerySerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=100, default="")
    status = serializers.ChoiceField(required=False, choices=STATUS_FILTERS)
    page = serializers.IntegerField(required=False, min_value=1, default=1)
    page_size = serializers.IntegerField(required=False, min_value=1, max_value=100, default=10)