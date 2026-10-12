"""Authentication and abuse protection for the BuckAI service.

Every request must carry a Supabase access token (`Authorization: Bearer <jwt>`).
The token is verified against the Supabase Auth server, so revoked sessions and
signed-out users are rejected. The caller's identity always comes from the
verified token and never from the request payload.
"""

import hashlib
import logging
import os
import threading
import time
from collections import deque
from typing import Deque, Dict, Tuple

import requests
from fastapi import Depends, HTTPException, Request

logger = logging.getLogger("buckai.auth")

TOKEN_CACHE_TTL_SECONDS = 60
TOKEN_CACHE_MAX_ENTRIES = 2048
RATE_LIMIT_REQUESTS = int(os.getenv("AI_RATE_LIMIT_REQUESTS", "20"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("AI_RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_MAX_TRACKED_USERS = 10000

_token_cache: Dict[str, Tuple[str, float]] = {}
_token_lock = threading.Lock()
_rate_windows: Dict[str, Deque[float]] = {}
_rate_lock = threading.Lock()


def _supabase_settings() -> Tuple[str, str]:
    url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip().rstrip("/")
    anon_key = (os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "").strip()
    return url, anon_key


def _cache_key(token: str) -> str:
    # Never keep raw tokens in memory longer than the request.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _verify_with_supabase(token: str) -> str:
    url, anon_key = _supabase_settings()
    if not url or not anon_key:
        logger.error("SUPABASE_URL / SUPABASE_ANON_KEY are not configured; rejecting all requests.")
        raise HTTPException(status_code=503, detail="Authentication is not configured.")

    try:
        response = requests.get(
            f"{url}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": anon_key},
            timeout=5,
        )
    except requests.RequestException:
        logger.exception("Supabase token verification failed to reach the auth server.")
        raise HTTPException(status_code=503, detail="Authentication service unavailable.")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    user_id = response.json().get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    return user_id


def get_current_user_id(request: Request) -> str:
    """FastAPI dependency: returns the verified Supabase user id or raises 401."""
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")

    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    token = token.strip()
    key = _cache_key(token)
    now = time.monotonic()

    with _token_lock:
        cached = _token_cache.get(key)
        if cached and cached[1] > now:
            return cached[0]

    user_id = _verify_with_supabase(token)

    with _token_lock:
        if len(_token_cache) >= TOKEN_CACHE_MAX_ENTRIES:
            for stale_key in [k for k, (_, exp) in _token_cache.items() if exp <= now]:
                _token_cache.pop(stale_key, None)
            if len(_token_cache) >= TOKEN_CACHE_MAX_ENTRIES:
                _token_cache.clear()
        _token_cache[key] = (user_id, now + TOKEN_CACHE_TTL_SECONDS)

    return user_id


def enforce_rate_limit(user_id: str = Depends(get_current_user_id)) -> str:
    """Per-user sliding-window limiter (in-memory, per instance).

    Returns the user id so routes can depend on this alone. For multi-instance
    deployments move the counters to a shared store (e.g. Redis).
    """
    now = time.monotonic()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS

    with _rate_lock:
        if len(_rate_windows) >= RATE_LIMIT_MAX_TRACKED_USERS and user_id not in _rate_windows:
            for stale_user in [u for u, w in _rate_windows.items() if not w or w[-1] <= cutoff]:
                _rate_windows.pop(stale_user, None)

        window = _rate_windows.setdefault(user_id, deque())
        while window and window[0] <= cutoff:
            window.popleft()

        if len(window) >= RATE_LIMIT_REQUESTS:
            retry_after = max(1, int(window[0] + RATE_LIMIT_WINDOW_SECONDS - now) + 1)
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down.",
                headers={"Retry-After": str(retry_after)},
            )

        window.append(now)

    return user_id
