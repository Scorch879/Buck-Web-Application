"""Caller authentication: the Supabase access token of the signed-in user.

Web and mobile send the same thing, `Authorization: Bearer <access token>`.
There is no app-level API key: a key shipped inside the mobile app could be
extracted and used to drain the Gemini quota. The token is verified with
Supabase Auth (so expired, revoked and signed-out sessions fail), and the
user id always comes from Supabase, never from the request body.

Two-factor (ADR-048): a user with a verified authenticator must present an
aal2 token. Same rule as private.mfa_satisfied() (RLS) and the web's
utils/mfa/assurance.ts:

    satisfied = token is aal2  OR  the user has no verified MFA factor

RLS already hides the data from an aal1 token; this check turns that into a
clear 403 instead of empty advice.

Connected apps (ADR-049): tokens Supabase's OAuth server issues to other apps
carry a `client_id` claim. They may read data through RLS but never use
Buck_AI (it spends the Gemini quota and saves advice), so they get a 403.
"""

import base64
import hashlib
import json
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

MFA_REQUIRED_MESSAGE = "Enter your two-factor code first."
CONNECTED_APP_MESSAGE = "Connected apps can't use Buck AI."

_cache: dict[str, tuple[str, bool, float]] = {}
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


def _claims(token: str) -> dict:
    """Unverified JWT payload; {} when unreadable."""
    try:
        payload = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError):
        return {}
    return claims if isinstance(claims, dict) else {}


def token_aal(token: str) -> str:
    """The `aal` claim of a token Supabase Auth has already accepted.

    The signature is not re-checked here: _verify() only calls this after
    /auth/v1/user returned 200 for the same token. Anything unreadable is aal1.
    """
    return "aal2" if _claims(token).get("aal") == "aal2" else "aal1"


def is_connected_app(token: str) -> bool:
    """True for an OAuth access token issued to a connected app.

    Checked before verification on purpose: refusing a forged token is safe.
    """
    client_id = _claims(token).get("client_id")
    return isinstance(client_id, str) and client_id != ""


def mfa_satisfied(aal: str, user: dict) -> bool:
    factors = user.get("factors") or []
    has_verified = any(isinstance(f, dict) and f.get("status") == "verified" for f in factors)
    return aal == "aal2" or not has_verified


async def _verify(token: str) -> tuple[str, bool]:
    """(user id, 2FA satisfied) for a token, or 401/503."""
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
    user = response.json()
    user_id = user.get("id") if isinstance(user, dict) else None
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(401, "Your session expired. Sign in again.")
    return user_id, mfa_satisfied(token_aal(token), user)


async def current_user(request: Request) -> AuthUser:
    """FastAPI dependency: the verified caller, or 401."""
    token = read_bearer(request.headers.get("authorization"))
    if not token:
        raise HTTPException(401, "Sign in first.")
    if is_connected_app(token):
        raise HTTPException(403, CONNECTED_APP_MESSAGE, headers={"X-Buck-Error": "connected_app"})

    key, now = _key(token), time.monotonic()
    with _lock:
        hit = _cache.get(key)
    if hit and hit[2] > now:
        user_id, satisfied = hit[0], hit[1]
    else:
        user_id, satisfied = await _verify(token)
        with _lock:
            if len(_cache) >= TOKEN_CACHE_MAX:
                _cache.clear()
            _cache[key] = (user_id, satisfied, now + TOKEN_CACHE_TTL_SECONDS)

    if not satisfied:
        raise HTTPException(403, MFA_REQUIRED_MESSAGE, headers={"X-Buck-Error": "mfa_required"})
    return AuthUser(user_id, token)


def clear_auth_cache() -> None:
    with _lock:
        _cache.clear()
