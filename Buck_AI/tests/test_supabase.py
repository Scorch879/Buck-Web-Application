"""Paging of unbounded Supabase reads. Run from Buck_AI/: python -m unittest -v"""

import os
import re
import unittest

os.environ.update({
    "SUPABASE_URL": "https://proj.supabase.co",
    "SUPABASE_ANON_KEY": "anon-key",
    "GEMINI_API_KEY": "test-key",
    "ALLOWED_ORIGINS": "http://localhost:3000",
})

import httpx  # noqa: E402

from BuckAI_Advisor.snapshot import build_snapshot, today_ph  # noqa: E402
from shared.config import get_settings  # noqa: E402
from shared.http import set_http  # noqa: E402
from shared.supabase import DbError, UserDb  # noqa: E402

SERVER_MAX_ROWS = 1000  # Supabase default


class PagingSupabase:
    """PostgREST that honours `Range` and caps every response at max_rows."""

    def __init__(self, expenses: list[dict]):
        self.expenses = expenses
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        table = request.url.path.rsplit("/", 1)[-1]
        if table != "expenses":
            return httpx.Response(200, json=[])
        match = re.match(r"(\d+)-(\d+)", request.headers.get("range", ""))
        start, end = (int(match.group(1)), int(match.group(2))) if match else (0, SERVER_MAX_ROWS - 1)
        end = min(end, start + SERVER_MAX_ROWS - 1)
        return httpx.Response(206, json=self.expenses[start:end + 1])


def rows(count: int) -> list[dict]:
    today = today_ph().isoformat()
    return [{"id": f"e{i:05d}", "amount": 10, "category_name": "Food", "spent_on": today} for i in range(count)]


class SelectAllTests(unittest.IsolatedAsyncioTestCase):
    def use(self, supa: PagingSupabase) -> UserDb:
        get_settings.cache_clear()
        set_http(httpx.AsyncClient(transport=httpx.MockTransport(supa.handler)))
        return UserDb("user-1", "token")

    async def test_reads_every_page_without_gaps_or_duplicates(self):
        supa = PagingSupabase(rows(2500))
        got = await self.use(supa).select_all("expenses", {"select": "id", "user_id": "eq.user-1"})
        self.assertEqual(len(got), 2500)
        self.assertEqual(len({r["id"] for r in got}), 2500)
        self.assertEqual([r.headers["range"] for r in supa.requests], ["0-999", "1000-1999", "2000-2999"])

    async def test_exact_multiple_of_page_size_needs_one_empty_page(self):
        supa = PagingSupabase(rows(2000))
        got = await self.use(supa).select_all("expenses", {"select": "id"})
        self.assertEqual(len(got), 2000)
        self.assertEqual(len(supa.requests), 3)

    async def test_small_result_is_one_request(self):
        supa = PagingSupabase(rows(5))
        got = await self.use(supa).select_all("expenses", {"select": "id"})
        self.assertEqual(len(got), 5)
        self.assertEqual(len(supa.requests), 1)

    async def test_order_gets_an_id_tie_break(self):
        supa = PagingSupabase(rows(1))
        db = self.use(supa)
        await db.select_all("expenses", [("select", "id"), ("order", "spent_on.desc")])
        await db.select_all("expenses", {"select": "id"})
        await db.select_all("expenses", [("order", "id.desc")])
        orders = [r.url.params.get("order") for r in supa.requests]
        self.assertEqual(orders, ["spent_on.desc,id.asc", "id.asc", "id.desc"])

    async def test_row_ceiling_raises_instead_of_returning_partial_data(self):
        supa = PagingSupabase(rows(3000))
        with self.assertRaises(DbError):
            await self.use(supa).select_all("expenses", {"select": "id"}, max_rows=2000)

    async def test_snapshot_totals_include_more_than_one_page(self):
        supa = PagingSupabase(rows(1500))  # 1500 x PHP 10, all dated today
        snapshot = await build_snapshot(self.use(supa))
        self.assertEqual(snapshot.data["spent_this_month"], 15000.0)


if __name__ == "__main__":
    unittest.main()
