"""Supabase (PostgREST) access as the signed-in user.

Every request carries the user's own access token, so Postgres Row-Level
Security (`auth.uid() = user_id`) decides what is visible. Queries still add
an explicit `user_id` filter as a second guard and to use the indexes.
"""

from collections.abc import Mapping, Sequence
from typing import Any

import httpx

from .config import get_settings
from .http import get_http


# PostgREST answers at most `max_rows` rows per request (Supabase default 1000)
# and does not say when it cut a response short. Unbounded reads must page.
PAGE_SIZE = 1000   # keep <= the project's max_rows, or paging would stop early
MAX_ROWS = 20_000  # hard ceiling so a runaway table cannot exhaust memory or time


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

    async def select_all(
        self,
        table: str,
        params: Mapping[str, str] | Sequence[tuple[str, str]],
        *,
        page_size: int = PAGE_SIZE,
        max_rows: int = MAX_ROWS,
    ) -> list[dict[str, Any]]:
        """GET every matching row by paging with `Range` headers.

        Use this for reads that can exceed one page (expenses, incomes). The
        order gets an `id` tie-break so pages never overlap or skip rows when
        many rows share a sort value. Raises DbError past `max_rows` rather
        than returning a silently partial result.
        """
        pairs = list(params.items()) if isinstance(params, Mapping) else list(params)
        orders = [value for key, value in pairs if key == "order"]
        pairs = [(key, value) for key, value in pairs if key != "order"]
        order = orders[-1] if orders else ""
        if "id" not in {term.split(".")[0] for term in order.split(",")}:
            order = f"{order},id.asc" if order else "id.asc"
        pairs.append(("order", order))

        rows: list[dict[str, Any]] = []
        while True:
            start = len(rows)
            headers = self._headers({"Range-Unit": "items", "Range": f"{start}-{start + page_size - 1}"})
            try:
                response = await get_http().get(self._url(table), params=pairs, headers=headers)
            except httpx.HTTPError as exc:
                raise DbError(f"Database unreachable: {exc.__class__.__name__}") from exc
            page = self._check(response) or []
            rows.extend(page)
            if len(page) < page_size:
                return rows
            if len(rows) >= max_rows:
                raise DbError(f"More than {max_rows} rows in {table}; narrow the date range.")

    async def rpc(self, function: str, args: dict[str, Any]) -> Any:
        """POST /rest/v1/rpc/<function> as the user (RLS and auth.uid() apply)."""
        try:
            response = await get_http().post(
                f"{get_settings().supabase_url}/rest/v1/rpc/{function}",
                json=args,
                headers=self._headers(),
                timeout=3,
            )
        except httpx.HTTPError as exc:
            raise DbError(f"Database unreachable: {exc.__class__.__name__}") from exc
        return self._check(response)

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
