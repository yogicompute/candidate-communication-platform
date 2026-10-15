"""Message placeholders. Only {{candidate_name}} and {{first_name}} exist; they are filled in per
recipient at send time, so the stored Message body is always the text the candidate received.
Mirrored in frontend/src/utils/placeholders.ts for the live preview and the mock services."""

import re

from rest_framework import serializers

PLACEHOLDERS = ("candidate_name", "first_name")
HINT = "Use {{candidate_name}} or {{first_name}}."

_TOKEN = re.compile(r"\{\{\s*([A-Za-z0-9_]*)\s*\}\}")


def placeholder_error(text: str) -> str | None:
    """Explain the first unknown or malformed placeholder in text, or None when all are valid."""
    for match in _TOKEN.finditer(text):
        if match.group(1) not in PLACEHOLDERS:
            return f"{match.group(0)} isn't a supported placeholder. {HINT}"
    leftover = _TOKEN.sub("", text)
    if "{{" in leftover or "}}" in leftover:
        return f"A placeholder is missing a brace or contains extra characters. {HINT}"
    return None


def validate_placeholders(text: str) -> None:
    error = placeholder_error(text)
    if error:
        raise serializers.ValidationError(error)


def first_name(full_name: str) -> str:
    parts = full_name.split()
    return parts[0] if parts else full_name


def render(text: str, full_name: str) -> str:
    values = {"candidate_name": full_name, "first_name": first_name(full_name)}
    return _TOKEN.sub(lambda match: values[match.group(1)], text)
