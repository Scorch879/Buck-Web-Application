"""Per-user sliding-window limits.

Two layers:
1. An in-memory window per serverless instance: free, stops bursts and is the
   fallback when the database is unreachable.
2. A shared window in Supabase (`ai_rate_limit_take`, as the user under RLS),
   which holds across instances so one user cannot spread requests over many
   cold starts to drain the Gemini free-tier quota.
The quota is the hard ceiling; when Gemini answers 429 every Advisor feature
serves its fallback instead of failing.
"""

import logging
import threading
import time
from collections import deque

from fastapi import HTTPException

from .supabase import DbError, UserDb

log = logging.getLogger("buck_ai.rate_limit")

LIMITS = {
    "chat": (15, 60),       # requests, window seconds
    "insight": (20, 60),
    "tip": (20, 60),
    "categorize": (30, 60),  # one request carries up to 25 items
}
_MAX_KEYS = 10_000
_windows: dict[str, deque[float]] = {}
_lock = threading.Lock()


def take(user_id: str, bucket: str, now: float | None = None) -> int:
    """Returns 0 when allowed, otherwise seconds to wait."""
    limit, window = LIMITS[bucket]
    now = time.monotonic() if now is None else now
    key = f"{bucket}:{user_id}"
    with _lock:
        if len(_windows) >= _MAX_KEYS and key not in _windows:
            _windows.clear()
        hits = _windows.setdefault(key, deque())
        while hits and hits[0] <= now - window:
            hits.popleft()
        if len(hits) >= limit:
            return max(1, int(hits[0] + window - now) + 1)
        hits.append(now)
        return 0


def _reject(wait: int) -> HTTPException:
    return HTTPException(
        429,
        f"You're asking a bit fast. Try again in about {wait} seconds.",
        headers={"Retry-After": str(wait)},
    )


async def enforce(db: UserDb, bucket: str) -> None:
    """Raises 429 when the user is over the limit. Never raises for DB trouble."""
    wait = take(db.user_id, bucket)
    if wait:
        raise _reject(wait)

    limit, window = LIMITS[bucket]
    try:
        shared_wait = await db.rpc(
            "ai_rate_limit_take", {"p_bucket": bucket, "p_limit": limit, "p_window_seconds": window}
        )
    except DbError as exc:
        log.warning("Shared rate limit unavailable, using the local window: %s", exc)
        return
    # A non-integer answer (unexpected shape) is treated like an outage.
    if isinstance(shared_wait, int) and not isinstance(shared_wait, bool) and shared_wait > 0:
        raise _reject(shared_wait)


def reset() -> None:
    with _lock:
        _windows.clear()
