"""Caller authentication: the Supabase access token of the signed-in user.

Web and mobile send the same thing, `Authorization: Bearer <access token>`.
There is no app-level API key: a key shipped inside the mobile app could be
extracted and used to drain the Gemini quota. The token is verified with
Supabase Auth (so expired, revoked and signed-out sessions fail), and the
user id always comes from Supabase, never from the request body.
"""

import hashlib
import re
import threading
import time
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request

from .config import get_settings
from .http import get_http

TOKEN_CACHE_TTL_SECONDS = 60
TOKEN_CACHE_MAX = 2048
_BEARER = re.compile(r"^Bearer\s+(\S+)\s*$", re.IGNORECASE)

_cache: dict[str, tuple[str, float]] = {}
_lock = threading.Lock()


@dataclass(frozen=True)
class AuthUser:
    id: str
    token: str  # forwarded to Supabase so Row-Level Security applies


def read_bearer(header: str | None) -> str | None:
    match = _BEARER.match(header or "")
    return match.group(1) if match else None


def _key(token: str) -> str:
    # Raw tokens are never kept in memory beyond the request.
    return hashlib.sha256(token.encode()).hexdigest()


async def _verify(token: str) -> str:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(503, "Authentication is not configured.")
    try:
        response = await get_http().get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": settings.supabase_anon_key},
            timeout=5,
        )
    except httpx.HTTPError:
        raise HTTPException(503, "Authentication service unavailable.")
    if response.status_code != 200:
        raise HTTPException(401, "Your session expired. Sign in again.")
    user_id = response.json().get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(401, "Your session expired. Sign in again.")
    return user_id


async def current_user(request: Request) -> AuthUser:
    """FastAPI dependency: the verified caller, or 401."""
    token = read_bearer(request.headers.get("authorization"))
    if not token:
        raise HTTPException(401, "Sign in first.")

    key, now = _key(token), time.monotonic()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[1] > now:
            return AuthUser(hit[0], token)

    user_id = await _verify(token)
    with _lock:
        if len(_cache) >= TOKEN_CACHE_MAX:
            _cache.clear()
        _cache[key] = (user_id, now + TOKEN_CACHE_TTL_SECONDS)
    return AuthUser(user_id, token)


def clear_auth_cache() -> None:
    with _lock:
        _cache.clear()
