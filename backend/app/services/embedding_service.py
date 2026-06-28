from app.core.config import get_settings
from app.core.embedding import EMBEDDING_DIMENSION
from app.integrations.openai_client import OpenAINotConfiguredError, get_openai_client


class EmbeddingGenerationError(Exception):
    pass


class EmbeddingsNotConfiguredError(Exception):
    pass


def _embedding_request_kwargs(*, model: str, texts: list[str]) -> dict:
    kwargs: dict = {"model": model, "input": texts}
    if model.startswith("text-embedding-3"):
        kwargs["dimensions"] = EMBEDDING_DIMENSION
    return kwargs


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embedding vectors for one or more text inputs."""
    if not texts:
        return []

    settings = get_settings()
    if not settings.OPENAI_API_KEY:
        raise EmbeddingsNotConfiguredError(
            "OPENAI_API_KEY is not configured for embedding generation"
        )

    try:
        client = get_openai_client()
        response = client.embeddings.create(
            **_embedding_request_kwargs(model=settings.EMBEDDING_MODEL, texts=texts),
        )
    except OpenAINotConfiguredError as exc:
        raise EmbeddingsNotConfiguredError(str(exc)) from exc
    except Exception as exc:
        raise EmbeddingGenerationError("Failed to generate embeddings") from exc

    ordered = sorted(response.data, key=lambda item: item.index)
    if len(ordered) != len(texts):
        raise EmbeddingGenerationError(
            "Embedding API returned an unexpected result count"
        )

    embeddings: list[list[float]] = []
    for item in ordered:
        vector = list(item.embedding)
        if len(vector) != EMBEDDING_DIMENSION:
            raise EmbeddingGenerationError(
                f"Expected {EMBEDDING_DIMENSION}-dimension embeddings, "
                f"got {len(vector)}"
            )
        embeddings.append(vector)

    return embeddings
