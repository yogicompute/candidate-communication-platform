from functools import lru_cache

from django.conf import settings

from providers.base import MessagingProvider
from providers.dummy import DummyProvider


@lru_cache(maxsize=1)
def get_provider() -> MessagingProvider:
    return DummyProvider(
        base_url=settings.DUMMY_PROVIDER_URL,
        api_key=settings.DUMMY_PROVIDER_API_KEY,
        webhook_secret=settings.PROVIDER_WEBHOOK_SECRET,
        timeout=settings.PROVIDER_TIMEOUT_SECONDS,
    )