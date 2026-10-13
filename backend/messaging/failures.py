from providers.base import FailureCode

FAILURE_DETAILS: dict[str, tuple[bool, str]] = {
    FailureCode.INVALID_NUMBER: (
        False,
        "This mobile number can't receive messages. Check the number on the candidate's profile.",
    ),
    FailureCode.BLOCKED_RECIPIENT: (
        False,
        "The candidate's carrier blocked this message. Try contacting them another way.",
    ),
    FailureCode.RATE_LIMITED: (
        True,
        "Too many messages were sent at once. Wait a moment, then retry.",
    ),
    FailureCode.PROVIDER_UNAVAILABLE: (
        True,
        "The messaging service is temporarily unavailable. Try again in a few minutes.",
    ),
    FailureCode.DELIVERY_TIMEOUT: (
        True,
        "The message couldn't be delivered in time. The phone may be off or out of coverage. You can retry.",
    ),
}

UNKNOWN_FAILURE = (True, "The message could not be sent. Please try again.")


def is_retryable(code: str | None) -> bool:
    return FAILURE_DETAILS.get(code or "", UNKNOWN_FAILURE)[0]


def failure_message(code: str | None) -> str:
    return FAILURE_DETAILS.get(code or "", UNKNOWN_FAILURE)[1]