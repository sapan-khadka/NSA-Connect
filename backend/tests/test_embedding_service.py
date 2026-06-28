from unittest.mock import MagicMock, patch

import pytest

from app.core.embedding import EMBEDDING_DIMENSION
from app.services.embedding_service import (
    EmbeddingGenerationError,
    EmbeddingsNotConfiguredError,
    generate_embeddings,
)


def test_generate_embeddings_returns_vectors_for_each_input():
    with (
        patch("app.services.embedding_service.get_settings") as mock_settings,
        patch("app.services.embedding_service.get_openai_client") as mock_get_client,
    ):
        mock_settings.return_value = MagicMock(
            OPENAI_API_KEY="test-key",
            EMBEDDING_MODEL="text-embedding-3-small",
        )
        client = MagicMock()
        client.embeddings.create.return_value = MagicMock(
            data=[
                MagicMock(index=0, embedding=[0.1] * EMBEDDING_DIMENSION),
                MagicMock(index=1, embedding=[0.2] * EMBEDDING_DIMENSION),
            ]
        )
        mock_get_client.return_value = client

        vectors = generate_embeddings(["first chunk", "second chunk"])

    assert len(vectors) == 2
    assert len(vectors[0]) == EMBEDDING_DIMENSION
    client.embeddings.create.assert_called_once_with(
        model="text-embedding-3-small",
        input=["first chunk", "second chunk"],
        dimensions=EMBEDDING_DIMENSION,
    )


def test_generate_embeddings_requires_openai_api_key():
    with patch("app.services.embedding_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            OPENAI_API_KEY="",
            EMBEDDING_MODEL="text-embedding-3-small",
        )

        with pytest.raises(EmbeddingsNotConfiguredError):
            generate_embeddings(["chunk text"])


def test_generate_embeddings_rejects_wrong_vector_size():
    with (
        patch("app.services.embedding_service.get_settings") as mock_settings,
        patch("app.services.embedding_service.get_openai_client") as mock_get_client,
    ):
        mock_settings.return_value = MagicMock(
            OPENAI_API_KEY="test-key",
            EMBEDDING_MODEL="text-embedding-3-small",
        )
        client = MagicMock()
        client.embeddings.create.return_value = MagicMock(
            data=[MagicMock(index=0, embedding=[0.1, 0.2, 0.3])]
        )
        mock_get_client.return_value = client

        with pytest.raises(EmbeddingGenerationError, match="1536"):
            generate_embeddings(["chunk text"])
