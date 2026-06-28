import logging
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.integrations.anthropic_client import (
    AnthropicNotConfiguredError,
    get_anthropic_client,
)
from app.models.member import Member
from app.prompts.chatbot import build_chat_system_prompt
from app.schemas.ai import (
    ChatConstitutionSource,
    ChatRequest,
    ChatResponse,
    ChatToolCallRecord,
)
from app.services.ai_chat_tools import CHAT_TOOL_DEFINITIONS, execute_chat_tool
from app.services.ai_checklist_service import AIDisabledError
from app.services.constitution_search_service import search_constitution_chunks
from app.services.embedding_service import EmbeddingsNotConfiguredError

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 5


class AIChatError(Exception):
    pass


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


def _retrieve_constitution_context(
    db: Session,
    *,
    query: str,
    limit: int,
) -> tuple[str, list[ChatConstitutionSource]]:
    try:
        hits = search_constitution_chunks(db, query=query, limit=limit)
    except EmbeddingsNotConfiguredError:
        logger.warning("Constitution RAG skipped: OpenAI embeddings not configured")
        return "", []
    except Exception:
        logger.exception("Constitution RAG retrieval failed")
        return "", []

    return _format_rag_context(hits)


def _history_messages(history) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    for item in history:
        messages.append({"role": item.role, "content": item.content})
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

    rag_context, sources = _retrieve_constitution_context(
        db,
        query=data.message,
        limit=settings.AI_CHAT_RAG_CHUNK_LIMIT,
    )
    system_prompt = build_chat_system_prompt(rag_context=rag_context)

    messages = _history_messages(data.history)
    messages.append({"role": "user", "content": data.message.strip()})

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
