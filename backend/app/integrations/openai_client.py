from functools import lru_cache
from typing import TYPE_CHECKING

from app.core.config import get_settings

if TYPE_CHECKING:
    from openai import OpenAI


class OpenAINotConfiguredError(RuntimeError):
    """Raised when embeddings are requested but OpenAI credentials are missing."""


@lru_cache
def get_openai_client() -> "OpenAI":
    from openai import OpenAI

    settings = get_settings()
    if not settings.OPENAI_API_KEY:
        raise OpenAINotConfiguredError(
            "OPENAI_API_KEY is not set; cannot create OpenAI client"
        )
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def reset_openai_client() -> None:
    get_openai_client.cache_clear()
