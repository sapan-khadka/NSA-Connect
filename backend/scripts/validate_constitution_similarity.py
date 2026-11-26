"""Score representative questions against a local constitution PDF.

This does not connect to production, write a database, or print the API key.

Setup:
  1. Keep the official PDF outside the repository.
  2. Export OPENAI_API_KEY only in the shell for this command.
     Do not read it from Railway and do not commit it.
  3. From backend/, run:

     OPENAI_API_KEY="..." \\
       .venv/bin/python3.13 scripts/validate_constitution_similarity.py \\
       /absolute/path/to/constitution.pdf

The script embeds the PDF and the questions with text-embedding-3-small, then
prints each chunk's cosine score. Chat keeps the nearest five non-empty
constitution chunks regardless of score. Chunks outside that window are not
retrieved. The 0.45 floor applies to additional organization documents, not
to these constitution chunks.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.services.constitution_chunk_service import chunk_constitution_text
from app.services.constitution_pdf_service import extract_text_from_constitution_pdf
from app.services.embedding_service import generate_embeddings

QUESTIONS = [
    "What does the constitution say about voting?",
    "What are the duties of the officers?",
    "How are amendments to the constitution adopted?",
    "Who is eligible for membership?",
    "What events are coming up?",
    "What is our treasury balance?",
    "What is the treasury balance, and what does the constitution say about dues?",
]


def _cosine(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_constitution_similarity.py /path/to/constitution.pdf")
        return 2
    if not get_settings().OPENAI_API_KEY:
        print("OPENAI_API_KEY is not set in this shell. The script did not call OpenAI.")
        return 2

    pdf_path = Path(sys.argv[1]).expanduser()
    file_bytes = pdf_path.read_bytes()
    extracted = extract_text_from_constitution_pdf(
        file_bytes=file_bytes,
        content_type="application/pdf",
        filename=pdf_path.name,
    )
    chunks = chunk_constitution_text(extracted.text)
    settings = get_settings()
    limit = settings.AI_CHAT_RAG_CHUNK_LIMIT
    print(
        f"model={settings.EMBEDDING_MODEL} chunks={len(chunks)} "
        f"constitution_limit={limit} document_threshold="
        f"{settings.AI_CHAT_RAG_MIN_SIMILARITY}"
    )

    chunk_vectors = generate_embeddings([chunk.content for chunk in chunks])
    question_vectors = generate_embeddings(QUESTIONS)
    for question, question_vector in zip(QUESTIONS, question_vectors, strict=True):
        ranked = sorted(
            (
                (
                    _cosine(question_vector, chunk_vector),
                    chunk,
                )
                for chunk, chunk_vector in zip(chunks, chunk_vectors, strict=True)
            ),
            key=lambda item: item[0],
            reverse=True,
        )
        print(f"\nQ: {question}")
        for rank, (score, chunk) in enumerate(ranked, start=1):
            section = chunk.section or f"Chunk {chunk.chunk_index + 1}"
            section = " ".join(section.split())
            excerpt = " ".join(chunk.content.split())[:120]
            if rank <= limit and chunk.content.strip():
                decision = "kept"
            else:
                decision = "not-retrieved"
            print(
                f"  rank={rank} chat={decision:13} {score:.3f}  {section}: {excerpt}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
