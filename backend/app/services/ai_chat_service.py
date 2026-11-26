import json
import logging
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.safe_messages import GENERIC_AI_UNAVAILABLE
from app.integrations.anthropic_client import (
    AnthropicNotConfiguredError,
    get_anthropic_client,
)
from app.lib.event_timezone import format_local_date
from app.models.member import Member
from app.prompts.chatbot import build_chat_system_prompt, wrap_untrusted_user_message
from app.schemas.ai import (
    ChatConstitutionSource,
    ChatRequest,
    ChatResponse,
    ChatToolCallRecord,
)
from app.services.ai_chat_tools import (
    CHAT_TOOL_DEFINITIONS,
    execute_chat_tool,
    organization_zone,
)
from app.services.ai_checklist_service import AIDisabledError
from app.services.constitution_relevance import constitution_chunk_retained
from app.services.constitution_search_service import search_constitution_chunks
from app.services.embedding_service import (
    EmbeddingsNotConfiguredError,
    generate_embeddings,
)
from app.services.org_document_service import (
    organization_has_document_chunks,
    search_org_document_chunks,
)

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 5


class AIChatError(Exception):
    pass


def _format_sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _opening_gap(previous: str, upcoming: str) -> tuple[str, str]:
    """Return a blank line between tool narration and the next answer.

    Leading newlines on the upcoming text are dropped so a paragraph the model
    already started is not given a second separator. Newlines already streamed
    with the narration stay as they are.
    """
    body = upcoming.lstrip("\n")
    if not previous.strip():
        return "", body
    trailing = len(previous) - len(previous.rstrip("\n"))
    missing = 2 - trailing
    gap = "\n" * missing if missing > 0 else ""
    return gap, body


def _format_rag_context(hits) -> tuple[str, list[ChatConstitutionSource]]:
    if not hits:
        return "", []

    sections: list[str] = []
    sources: list[ChatConstitutionSource] = []
    for hit in hits:
        label = hit.section or f"Chunk {hit.chunk_index + 1}"
        sections.append(
            f"[{label} | score={hit.similarity_score:.3f}]\n{hit.content.strip()}",
        )
        sources.append(
            ChatConstitutionSource(
                chunk_id=hit.id,
                section=hit.section,
                chunk_index=hit.chunk_index,
                similarity_score=round(hit.similarity_score, 6),
                excerpt=hit.content.strip(),
            ),
        )
    return "\n\n".join(sections), sources


def _format_document_context(hits) -> str:
    if not hits:
        return ""
    sections: list[str] = []
    for hit in hits:
        label = hit.section or f"Chunk {hit.chunk_index + 1}"
        sections.append(
            f"[{hit.document_title} · {label} | score={hit.similarity_score:.3f}]\n"
            f"{hit.content.strip()}",
        )
    return "\n\n".join(sections)


def _question_embedding(query: str) -> list[float] | None:
    try:
        return generate_embeddings([query.strip()])[0]
    except EmbeddingsNotConfiguredError:
        logger.warning("Chat retrieval skipped: OpenAI embeddings not configured")
        return None
    except Exception:
        logger.exception("Chat retrieval embedding failed")
        return None


def _relevant_hits(hits, minimum: float):
    return [
        hit
        for hit in hits
        if hit.similarity_score >= minimum and hit.content.strip()
    ]


def _relevant_constitution_hits(hits, minimum: float, question: str):
    return [
        hit
        for hit in hits
        if constitution_chunk_retained(
            question=question,
            content=hit.content,
            similarity=hit.similarity_score,
            minimum=minimum,
        )
    ]


def _retrieve_document_context(
    db: Session,
    *,
    member: Member,
    query: str,
    limit: int,
    minimum: float,
    query_embedding: list[float],
) -> str:
    try:
        hits = search_org_document_chunks(
            db,
            member=member,
            query=query,
            limit=limit,
            query_embedding=query_embedding,
        )
    except Exception:
        logger.exception("Document RAG retrieval failed")
        return ""
    return _format_document_context(_relevant_hits(hits, minimum))


def _retrieve_constitution_context(
    db: Session,
    *,
    query: str,
    limit: int,
    minimum: float,
    query_embedding: list[float],
) -> tuple[str, list[ChatConstitutionSource]]:
    try:
        hits = search_constitution_chunks(
            db,
            query=query,
            limit=limit,
            query_embedding=query_embedding,
        )
    except Exception:
        logger.exception("Constitution RAG retrieval failed")
        return "", []

    return _format_rag_context(
        _relevant_constitution_hits(hits, minimum, query),
    )


def _history_messages(history) -> list[dict[str, Any]]:
    """Forward only the caller's questions.

    Assistant text is client-supplied. After a role change it can still contain
    treasury figures or minutes the current caller must not see, so it is not
    sent to the model. Tools run again under the current permission check.
    """
    messages: list[dict[str, Any]] = []
    for item in history:
        if item.role != "user":
            continue
        messages.append(
            {
                "role": "user",
                "content": wrap_untrusted_user_message(item.content),
            }
        )
    return messages


def _extract_text(response) -> str:
    parts = [
        block.text.strip()
        for block in response.content
        if getattr(block, "type", None) == "text" and block.text.strip()
    ]
    return "\n\n".join(parts)


def _assistant_content_blocks(response) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for block in response.content:
        block_type = getattr(block, "type", None)
        if block_type == "text" and block.text:
            blocks.append({"type": "text", "text": block.text})
        elif block_type == "tool_use":
            blocks.append(
                {
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                }
            )
    return blocks


def _process_tool_use_blocks(
    db: Session,
    *,
    member: Member,
    response,
    tool_records: list[ChatToolCallRecord],
) -> list[dict[str, Any]]:
    tool_results: list[dict[str, Any]] = []
    for block in response.content:
        if getattr(block, "type", None) != "tool_use":
            continue

        result_content = execute_chat_tool(
            db=db,
            member=member,
            tool_name=block.name,
            tool_input=block.input,
        )
        tool_records.append(
            ChatToolCallRecord(
                tool_name=block.name,
                input=block.input,
                output=result_content,
            )
        )
        tool_results.append(
            {
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result_content,
            }
        )
    return tool_results


def _prepare_chat_context(
    db: Session,
    *,
    member: Member,
    data: ChatRequest,
) -> tuple[str, list[ChatConstitutionSource], list[dict[str, Any]]]:
    settings = get_settings()
    embedding = _question_embedding(data.message)
    minimum = settings.AI_CHAT_RAG_MIN_SIMILARITY
    if embedding is None:
        rag_context, sources = "", []
        document_context = ""
    else:
        rag_context, sources = _retrieve_constitution_context(
            db,
            query=data.message,
            limit=settings.AI_CHAT_RAG_CHUNK_LIMIT,
            minimum=minimum,
            query_embedding=embedding,
        )
        if organization_has_document_chunks(db):
            document_context = _retrieve_document_context(
                db,
                member=member,
                query=data.message,
                limit=settings.AI_CHAT_RAG_CHUNK_LIMIT,
                minimum=minimum,
                query_embedding=embedding,
            )
        else:
            document_context = ""
    zone = organization_zone(db, member)
    local_date = format_local_date(_utc_now(), zone)
    timezone_name = getattr(zone, "key", None) or str(zone)
    system_prompt = build_chat_system_prompt(
        rag_context=rag_context,
        document_context=document_context,
        local_date=local_date,
        timezone_name=timezone_name,
    )
    messages = _history_messages(data.history)
    messages.append(
        {"role": "user", "content": wrap_untrusted_user_message(data.message)},
    )
    return system_prompt, sources, messages


def chat_with_nsa_assistant(
    db: Session,
    *,
    member: Member,
    data: ChatRequest,
) -> ChatResponse:
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise AIDisabledError

    try:
        client = get_anthropic_client()
    except AnthropicNotConfiguredError as exc:
        raise AIChatError("Anthropic is not configured") from exc

    system_prompt, sources, messages = _prepare_chat_context(
        db, member=member, data=data
    )
    tool_records: list[ChatToolCallRecord] = []
    final_text = ""

    for _round in range(MAX_TOOL_ROUNDS):
        try:
            response = client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=2048,
                system=system_prompt,
                messages=messages,
                tools=CHAT_TOOL_DEFINITIONS,
            )
        except Exception as exc:
            logger.exception("Anthropic chat request failed for member=%s", member.id)
            raise AIChatError("Failed to generate chat response") from exc

        if response.stop_reason == "tool_use":
            messages.append(
                {
                    "role": "assistant",
                    "content": _assistant_content_blocks(response),
                }
            )
            tool_results = _process_tool_use_blocks(
                db,
                member=member,
                response=response,
                tool_records=tool_records,
            )
            messages.append({"role": "user", "content": tool_results})
            continue

        final_text = _extract_text(response)
        if not final_text:
            raise AIChatError("Anthropic returned an empty response")
        break
    else:
        raise AIChatError("Chat exceeded maximum tool-use rounds")

    return ChatResponse(
        reply=final_text,
        constitution_sources=sources,
        tool_calls=tool_records,
    )


def stream_chat_with_nsa_assistant(
    db: Session,
    *,
    member: Member,
    data: ChatRequest,
) -> Iterator[str]:
    """Stream a chat response as SSE.

    Known failures are surfaced to the client as an ``error`` event rather than
    raised, because the response headers are already sent once streaming begins
    and a raised exception would otherwise drop the connection with no signal,
    leaving the UI stuck on a typing indicator.
    """
    try:
        yield from _stream_chat_impl(db, member=member, data=data)
    except AIDisabledError:
        yield _format_sse("error", {"detail": "AI features are disabled"})
    except AIChatError:
        yield _format_sse("error", {"detail": GENERIC_AI_UNAVAILABLE})


def _stream_chat_impl(
    db: Session,
    *,
    member: Member,
    data: ChatRequest,
) -> Iterator[str]:
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise AIDisabledError

    try:
        client = get_anthropic_client()
    except AnthropicNotConfiguredError as exc:
        raise AIChatError("Anthropic is not configured") from exc

    yield _format_sse("status", {"phase": "retrieving"})

    system_prompt, sources, messages = _prepare_chat_context(
        db, member=member, data=data
    )
    tool_records: list[ChatToolCallRecord] = []
    final_text = ""
    pending_narration = ""

    for _round in range(MAX_TOOL_ROUNDS):
        round_text = ""
        held = ""
        opening_closed = pending_narration == ""
        try:
            with client.messages.stream(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=2048,
                system=system_prompt,
                messages=messages,
                tools=CHAT_TOOL_DEFINITIONS,
            ) as stream:
                yield _format_sse("status", {"phase": "thinking"})
                for text in stream.text_stream:
                    if not text:
                        continue
                    if not opening_closed:
                        held += text
                        if not held.strip():
                            continue
                        gap, body = _opening_gap(pending_narration, held)
                        pending_narration = ""
                        opening_closed = True
                        held = ""
                        for piece in (gap, body):
                            if not piece:
                                continue
                            final_text += piece
                            round_text += piece
                            yield _format_sse("token", {"text": piece})
                        continue
                    final_text += text
                    round_text += text
                    yield _format_sse("token", {"text": text})
                response = stream.get_final_message()
        except Exception as exc:
            logger.exception("Anthropic chat stream failed for member=%s", member.id)
            raise AIChatError("Failed to generate chat response") from exc

        if response.stop_reason == "tool_use":
            yield _format_sse("status", {"phase": "tools"})
            messages.append(
                {
                    "role": "assistant",
                    "content": _assistant_content_blocks(response),
                }
            )
            tool_results = _process_tool_use_blocks(
                db,
                member=member,
                response=response,
                tool_records=tool_records,
            )
            messages.append({"role": "user", "content": tool_results})
            if round_text.strip():
                pending_narration = round_text
            final_text = ""
            continue

        if not final_text.strip():
            raise AIChatError("Anthropic returned an empty response")
        break
    else:
        raise AIChatError("Chat exceeded maximum tool-use rounds")

    yield _format_sse(
        "metadata",
        {
            "constitution_sources": [
                source.model_dump(mode="json") for source in sources
            ],
            "tool_calls": [record.model_dump(mode="json") for record in tool_records],
        },
    )
    yield _format_sse("done", {})
