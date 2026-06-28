from functools import lru_cache
from typing import TYPE_CHECKING

from app.core.config import get_settings

if TYPE_CHECKING:
    from anthropic import Anthropic


class AnthropicNotConfiguredError(RuntimeError):
    """Raised when AI is enabled but Anthropic credentials are missing."""


@lru_cache
def get_anthropic_client() -> "Anthropic":
    from anthropic import Anthropic

    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise AnthropicNotConfiguredError(
            "ANTHROPIC_API_KEY is not set; cannot create Anthropic client"
        )
    return Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def reset_anthropic_client() -> None:
    get_anthropic_client.cache_clear()
