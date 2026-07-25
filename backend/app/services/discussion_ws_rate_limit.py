"""In-process sliding-window rate limits for discussion WebSocket actions."""

from __future__ import annotations

import time
from collections import defaultdict, deque

# Per authenticated member across all discussion sockets on this worker.
WS_CHAT_MAX = 40
WS_CHAT_WINDOW_SECONDS = 60
WS_REACTION_MAX = 60
WS_REACTION_WINDOW_SECONDS = 60
WS_TYPING_MAX = 120
WS_TYPING_WINDOW_SECONDS = 60

_buckets: dict[str, deque[float]] = defaultdict(deque)


def _allow(key: str, *, max_events: int, window_seconds: int) -> bool:
    now = time.monotonic()
    bucket = _buckets[key]
    cutoff = now - window_seconds
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    if len(bucket) >= max_events:
        return False
    bucket.append(now)
    return True


def allow_ws_chat(member_id: int) -> bool:
    return _allow(
        f"chat:{member_id}",
        max_events=WS_CHAT_MAX,
        window_seconds=WS_CHAT_WINDOW_SECONDS,
    )


def allow_ws_reaction(member_id: int) -> bool:
    return _allow(
        f"reaction:{member_id}",
        max_events=WS_REACTION_MAX,
        window_seconds=WS_REACTION_WINDOW_SECONDS,
    )


def allow_ws_typing(member_id: int) -> bool:
    return _allow(
        f"typing:{member_id}",
        max_events=WS_TYPING_MAX,
        window_seconds=WS_TYPING_WINDOW_SECONDS,
    )


def reset_ws_rate_limits_for_tests() -> None:
    _buckets.clear()
