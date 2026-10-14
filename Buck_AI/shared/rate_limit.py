"""Per-user sliding-window limits.

In memory, so per serverless instance: it stops bursts and runaway clients.
The Gemini free-tier quota is the hard ceiling; when it is hit Gemini answers
429 and every Advisor feature serves its fallback instead of failing.
"""

import threading
import time
from collections import deque

from fastapi import HTTPException

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


def enforce(user_id: str, bucket: str) -> None:
    wait = take(user_id, bucket)
    if wait:
        raise HTTPException(
            429,
            f"You're asking a bit fast. Try again in about {wait} seconds.",
            headers={"Retry-After": str(wait)},
        )


def reset() -> None:
    with _lock:
        _windows.clear()
