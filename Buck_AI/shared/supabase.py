"""Supabase (PostgREST) access as the signed-in user.

Every request carries the user's own access token, so Postgres Row-Level
Security (`auth.uid() = user_id`) decides what is visible. Queries still add
an explicit `user_id` filter as a second guard and to use the indexes.
"""

from typing import Any

import httpx

from .config import get_settings
from .http import get_http


class DbError(RuntimeError):
    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.code = code


class UserDb:
    def __init__(self, user_id: str, token: str):
        self.user_id = user_id
        self._token = token

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        settings = get_settings()
        return {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {self._token}",
            **(extra or {}),
        }

    def _url(self, table: str) -> str:
        return f"{get_settings().supabase_url}/rest/v1/{table}"

    @staticmethod
    def _check(response: httpx.Response) -> Any:
        if response.status_code >= 400:
            try:
                body = response.json()
            except ValueError:
                body = {}
            raise DbError(str(body.get("message") or f"HTTP {response.status_code}"), body.get("code"))
        return response.json() if response.content else None

    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        """GET rows. `params` are PostgREST filters, e.g. {"spent_on": "gte.2026-10-01"}."""
        try:
            response = await get_http().get(self._url(table), params=params, headers=self._headers())
        except httpx.HTTPError as exc:
            raise DbError(f"Database unreachable: {exc.__class__.__name__}") from exc
        return self._check(response) or []

    async def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await get_http().post(
                self._url(table),
                json=row,
                headers=self._headers({"Prefer": "return=representation"}),
            )
        except httpx.HTTPError as exc:
            raise DbError(f"Database unreachable: {exc.__class__.__name__}") from exc
        rows = self._check(response) or []
        return rows[0] if rows else {}
