"""AI Forecaster API tests: Supabase faked at the HTTP layer, Groq patched."""

import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

os.environ.update({
    "SUPABASE_URL": "https://proj.supabase.co",
    "SUPABASE_ANON_KEY": "anon-key",
    "GEMINI_API_KEY": "test-key",
    "GROQ_API_KEY": "test-key",
    "ALLOWED_ORIGINS": "http://localhost:3000",
})

import httpx  # noqa: E402

from shared import auth, groq, rate_limit  # noqa: E402
from shared.config import get_settings  # noqa: E402
from shared.http import set_http  # noqa: E402
from shared.money import today_ph  # noqa: E402
import main  # noqa: E402
from BuckAI_Forecast import service  # noqa: E402

TODAY = today_ph()
GOOD = {"Authorization": "Bearer good"}
NARRATIVE = {"headline": "You're likely to spend ₱12,000.00 over the next 30 days.",
             "explanation": "Based on your last 30 days. <b>Food</b> leads. Call 09171234567.",
             "habit_notes": ["You spend more on weekends.", "Bills land on the 5th.", "x", "dropped"],
             "watch_out": "GCash may run out by ₱7066.56, not ₱1,234.56 or ₱500."}


class FakeSupabase:
    def __init__(self):
        self.expenses = []
        for i in range(90):
            day = (TODAY - timedelta(days=i)).isoformat()
            self.expenses.append({"amount": 150, "category_name": "Food", "wallet_id": "w1",
                                  "description": "lunch", "spent_on": day, "metadata": {}})
        self.expenses.append({"amount": 9000, "category_name": "Food", "wallet_id": "w1", "description": "x",
                              "spent_on": TODAY.isoformat(), "metadata": {"is_emergency": True}})
        self.forecasts: list[dict] = []
        self.queries: list[httpx.URL] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        token = request.headers.get("authorization", "").removeprefix("Bearer ")
        if path == "/auth/v1/user":
            return httpx.Response(200, json={"id": "user-1"}) if token == "good" else httpx.Response(401, json={})
        table = path.rsplit("/", 1)[-1]
        if table == "ai_rate_limit_take":
            return httpx.Response(200, json=0)
        if request.method == "POST" and table == "ai_forecasts":
            row = {**json.loads(request.content), "id": f"fc-{len(self.forecasts) + 1}",
                   "created_at": datetime.now(timezone.utc).isoformat()}
            self.forecasts.insert(0, row)
            return httpx.Response(201, json=[row])
        self.queries.append(request.url)
        horizon = request.url.params.get("metadata->>horizon", "").removeprefix("eq.")
        forecasts = [f for f in self.forecasts if not horizon or str(f["metadata"]["horizon"]) == horizon]
        data = {
            "profiles": [{"active_wallet_id": "w1"}],
            "wallets": [{"id": "w1", "name": "Cash", "budget": 20000}],
            "expenses": self.expenses,
            "incomes": [],
            "goals": [],
            "ai_forecasts": forecasts[:1] if horizon else forecasts,
        }.get(table, [])
        return httpx.Response(200, json=data)


class ForecastApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        get_settings.cache_clear()
        auth.clear_auth_cache()
        rate_limit.reset()
        self.supa = FakeSupabase()
        set_http(httpx.AsyncClient(transport=httpx.MockTransport(self.supa.handler)))
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://buck-ai")
        self.gen = mock.AsyncMock(return_value=dict(NARRATIVE))
        patcher = mock.patch.object(groq, "generate_json", self.gen)
        patcher.start()
        self.addCleanup(patcher.stop)

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_requires_a_token_and_a_valid_horizon(self):
        self.assertEqual((await self.client.get("/forecast")).status_code, 401)
        self.assertEqual((await self.client.get("/forecast?horizon=45", headers=GOOD)).status_code, 422)

    async def test_get_returns_numbers_without_waiting_for_the_ai(self):
        r = await self.client.get("/forecast?horizon=60", headers=GOOD)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["explanationPending"])
        self.assertEqual(body["generatedWith"], "rules")
        self.assertEqual(len(body["forecast"]["days"]), 60)
        self.assertIn("next 60 days", body["narrative"]["headline"])
        # Nothing saved and the AI never called.
        self.assertEqual(self.supa.forecasts, [])
        self.assertEqual(self.gen.await_count, 0)

    async def test_explain_saves_and_get_then_serves_from_database(self):
        r = await self.client.post("/forecast/explain?horizon=60", headers=GOOD)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertFalse(body["cached"])
        self.assertFalse(body["explanationPending"])
        self.assertEqual(body["generatedWith"], "groq")
        self.assertEqual(len(body["forecast"]["days"]), 60)
        # Explanation is cleaned: no angle brackets or phone numbers, max 3 notes.
        narrative = body["narrative"]
        self.assertNotIn("<", narrative["explanation"])
        self.assertIn("[phone]", narrative["explanation"])
        self.assertEqual(len(narrative["habitNotes"]), 3)
        self.assertEqual(narrative["watchOut"], "GCash may run out by ₱7,066.56, not ₱1,234.56 or ₱500.")
        # The emergency expense is left out of the baseline and shown as excluded.
        self.assertEqual([e["reason"] for e in body["forecast"]["excluded"]], ["emergency"])
        self.assertAlmostEqual(body["forecast"]["movingAverages"]["d30"], 150.0, delta=0.01)

        saved = self.supa.forecasts[0]
        self.assertEqual(saved["period_type"], "custom")
        self.assertEqual(saved["metadata"]["horizon"], 60)
        self.assertEqual(len(saved["daily_forecast"]), 60)
        self.assertEqual(saved["generated_by"], "on_demand")
        self.assertNotEqual(saved["model_name"], "rules")
        # The AI saw no descriptions.
        self.assertNotIn("lunch", self.gen.call_args.args[1])

        again = (await self.client.get("/forecast?horizon=60", headers=GOOD)).json()
        self.assertTrue(again["cached"])
        self.assertFalse(again["explanationPending"])
        self.assertEqual(again["narrative"], narrative)
        explained_again = (await self.client.post("/forecast/explain?horizon=60", headers=GOOD)).json()
        self.assertTrue(explained_again["cached"])
        self.assertEqual(self.gen.await_count, 1)
        self.assertEqual(len(self.supa.forecasts), 1)

    async def test_a_logging_gap_leads_the_explanation(self):
        self.gen.return_value = {**NARRATIVE, "explanation": "Food leads. It looks steady."}
        body = (await self.client.post("/forecast/explain", headers=GOOD)).json()
        self.assertFalse(body["forecast"]["model"]["loggingGap"])
        self.assertEqual(body["narrative"]["explanation"], "Food leads. It looks steady.")

        # Nothing logged for the last 25 days: the gap sentence goes first.
        cutoff = (TODAY - timedelta(days=25)).isoformat()
        self.supa.expenses = [e for e in self.supa.expenses if e["spent_on"] <= cutoff]
        self.supa.forecasts.clear()
        body = (await self.client.post("/forecast/explain", headers=GOOD)).json()
        self.assertTrue(body["forecast"]["model"]["loggingGap"])
        self.assertTrue(body["narrative"]["explanation"].startswith("Nothing has been logged for 25 days"))

    def test_rounded_amounts_are_restored(self):
        figures = service._figures({"total": {"p50": 2423.43, "p90": 7156.62}, "wallet": [62.74, 150.0], "days": 30})
        self.assertEqual(figures, {2423.43, 7156.62, 62.74})
        self.assertEqual(service._commas(service._exact("about ₱2,423, up to ₱7157. Low ₱63; ₱2423 in all.", figures)),
                         "about ₱2,423.43, up to ₱7,156.62. Low ₱62.74; ₱2,423.43 in all.")
        # Exact amounts, amounts with no match and ambiguous ones stay as written.
        self.assertEqual(service._exact("₱2,423.43, ₱500, ₱63", figures | {63.2}), "₱2,423.43, ₱500, ₱63")

    async def test_horizons_are_saved_separately(self):
        await self.client.post("/forecast/explain?horizon=60", headers=GOOD)
        body = (await self.client.get("/forecast?horizon=30", headers=GOOD)).json()
        self.assertTrue(body["explanationPending"])

    async def test_ai_failure_saves_a_rule_explanation(self):
        self.gen.side_effect = groq.GroqUnavailable("quota")
        body = (await self.client.post("/forecast/explain", headers=GOOD)).json()
        self.assertEqual(body["generatedWith"], "rules")
        self.assertIn("next 30 days", body["narrative"]["headline"])
        self.assertEqual(self.supa.forecasts[0]["model_name"], "rules")

    async def test_refresh_respects_cooldown(self):
        await self.client.post("/forecast/explain", headers=GOOD)
        body = (await self.client.post("/forecast/explain?refresh=true", headers=GOOD)).json()
        self.assertTrue(body["cached"])
        self.assertFalse(body["stale"])  # same data, so not stale, but still cooling down
        until = datetime.fromisoformat(body["cooldownUntil"])
        self.assertLess(until - datetime.now(timezone.utc), timedelta(seconds=61))
        self.assertEqual(self.gen.await_count, 1)
        # A plain (non-refresh) read of a current explanation is not cooling down.
        self.assertIsNone((await self.client.get("/forecast", headers=GOOD)).json()["cooldownUntil"])

    async def test_history(self):
        await self.client.post("/forecast/explain", headers=GOOD)
        rows = (await self.client.get("/forecast/history", headers=GOOD)).json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["generatedWith"], "groq")


if __name__ == "__main__":
    unittest.main()
