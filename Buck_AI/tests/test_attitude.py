"""Saving-attitude detection and the goal plan (shared/attitude.py), plus the
`POST /advisor/attitude` route and the Forecaster's goal block."""

import json
import os
import unittest
from datetime import date, timedelta
from unittest import mock

os.environ.update({
    "SUPABASE_URL": "https://proj.supabase.co",
    "SUPABASE_ANON_KEY": "anon-key",
    "GEMINI_API_KEY": "test-key",
    "GROQ_API_KEY": "test-key",
    "ALLOWED_ORIGINS": "http://localhost:3000",
})

import httpx  # noqa: E402

from shared import auth, gemini, groq, rate_limit  # noqa: E402
from shared.attitude import attitude_inputs, detect_attitude, goal_plan, save_detected  # noqa: E402
from shared.config import get_settings  # noqa: E402
from shared.http import set_http  # noqa: E402
from shared.money import today_ph  # noqa: E402
import main  # noqa: E402

TODAY = date(2026, 11, 11)
IN_60 = (TODAY + timedelta(days=60)).isoformat()


def detect(typical=300.0, income=None, remaining=3000.0, target=IN_60, current=None):
    return detect_attitude(typical_daily=typical, income_daily=income, remaining=remaining,
                           target_date=target, today=TODAY, current=current)


class DetectTests(unittest.TestCase):
    def test_no_cut_needed_is_normal(self):
        d = detect(income=500)  # 500 income - 50 needed = 450 allowance > 300 usual
        self.assertEqual(d["attitude"], "Normal")
        self.assertLess(d["cutNeeded"], 0)
        self.assertIn("no cut is needed", d["reason"])

    def test_small_cut_is_moderate(self):
        d = detect()  # break-even: needs 50 of 300 a day = 16.7% cut
        self.assertEqual(d["attitude"], "Moderate")
        self.assertAlmostEqual(d["cutNeeded"], 0.167, places=3)
        self.assertTrue(d["assumesBreakEven"])
        self.assertIn("17% less", d["reason"])

    def test_big_cut_is_aggressive_and_flags_unreachable(self):
        d = detect(remaining=6000)  # 100 of 300 = 33%: aggressive, still feasible
        self.assertEqual((d["attitude"], d["feasible"]), ("Aggressive", True))
        d = detect(remaining=30000)  # 500 a day > usual spending
        self.assertEqual((d["attitude"], d["feasible"]), ("Aggressive", False))
        self.assertIn("more than 40%", d["reason"])

    def test_margin_stops_flip_flopping_on_a_boundary(self):
        # Cut of n% = n * 3 a day over 60 days (usual spending 300).
        self.assertEqual(detect(remaining=21 * 3 * 60)["attitude"], "Aggressive")
        self.assertEqual(detect(remaining=21 * 3 * 60, current="Moderate")["attitude"], "Moderate")
        self.assertEqual(detect(remaining=25 * 3 * 60, current="Moderate")["attitude"], "Aggressive")
        self.assertEqual(detect(remaining=19 * 3 * 60, current="Aggressive")["attitude"], "Aggressive")
        self.assertIn("close to the line, so Buck keeps your Aggressive plan",
                      detect(remaining=19 * 3 * 60, current="Aggressive")["reason"])
        self.assertNotIn("close to the line", detect(remaining=15 * 3 * 60, current="Aggressive")["reason"])
        self.assertEqual(detect(remaining=15 * 3 * 60, current="Aggressive")["attitude"], "Moderate")

    def test_edge_cases(self):
        self.assertEqual(detect(remaining=0)["reason"], "This goal is already reached.")
        past = detect(target=(TODAY - timedelta(days=1)).isoformat())
        self.assertEqual((past["attitude"], past["feasible"]), ("Aggressive", False))
        empty = detect(typical=0)
        self.assertEqual(empty["attitude"], "Normal")
        self.assertIn("Not enough spending", empty["reason"])
        self.assertIsNone(goal_plan(empty))


class PlanTests(unittest.TestCase):
    def test_daily_weekly_monthly_spending_and_saving(self):
        p = goal_plan(detect())  # Moderate: spend 0.80 x 300
        self.assertEqual(p["spending"], {"perDay": 240.0, "perWeek": 1680.0, "perMonth": 7200.0})
        self.assertEqual(p["saving"], {"perDay": 60.0, "perWeek": 420.0, "perMonth": 1800.0})
        self.assertEqual(p["required"]["perDay"], 50.0)
        self.assertEqual((p["daysToGoal"], p["reachesByTargetDate"]), (50, True))

    def test_spending_never_planned_below_aggressive_floor(self):
        p = goal_plan(detect(remaining=30000))
        self.assertEqual(p["spending"]["perDay"], 180.0)   # 0.60 x 300, not 0
        self.assertFalse(p["reachesByTargetDate"])         # shows the later, realistic finish
        self.assertEqual(p["daysToGoal"], 250)

    def test_normal_spends_usual_and_saves_the_rest_of_income(self):
        p = goal_plan(detect(income=500))
        self.assertEqual((p["spending"]["perDay"], p["saving"]["perDay"]), (300.0, 200.0))


class InputsTests(unittest.TestCase):
    def test_windows(self):
        spend = [(TODAY - timedelta(days=i), 100.0) for i in range(120)]
        out = attitude_inputs(spend, [(TODAY - timedelta(days=10), 9000.0)], TODAY)
        self.assertEqual((out["typical_daily"], out["income_daily"], out["income_days"]), (100.0, 100.0, 90))

    def test_new_user_uses_days_logged_and_a_full_month_for_income(self):
        spend = [(TODAY - timedelta(days=i), 100.0) for i in range(10)]
        out = attitude_inputs(spend + [(TODAY + timedelta(days=1), 999.0)],
                              [(TODAY - timedelta(days=9), 3000.0)], TODAY)
        self.assertEqual(out["typical_daily"], 100.0)  # 1,000 over 10 days, future row ignored
        self.assertEqual(out["income_daily"], 100.0)   # 3,000 over at least 30 days
        self.assertIsNone(attitude_inputs([], [], TODAY)["income_daily"])

    def test_logging_gap_uses_the_30_days_up_to_the_last_expense(self):
        last = TODAY - timedelta(days=20)  # quiet for 20 days
        spend = [(last - timedelta(days=i), 200.0) for i in range(40)]
        out = attitude_inputs(spend, [(TODAY - timedelta(days=5), 9000.0)], TODAY)
        self.assertEqual(out["typical_daily"], 200.0)  # not (10 days x 200) / 30
        self.assertEqual(out["spending_until"], last.isoformat())
        d = detect_attitude(typical_daily=out["typical_daily"], income_daily=out["income_daily"],
                            remaining=3000.0, target_date=IN_60, today=TODAY,
                            spending_until=out["spending_until"])
        self.assertTrue(d["loggingGap"])
        self.assertTrue(d["reason"].startswith("You haven't logged spending since Oct 22, 2026"))

    def test_logging_gap_also_ends_the_income_window(self):
        last = TODAY - timedelta(days=30)
        spend = [(last - timedelta(days=i), 100.0) for i in range(60)]
        pay = [(last - timedelta(days=d), 6000.0) for d in (5, 35)]  # two monthly pays before the gap
        out = attitude_inputs(spend, pay, TODAY)
        self.assertEqual(out["income_days"], 60)       # Aug 14 .. Oct 12, not 90 days to today
        self.assertEqual(out["income_daily"], 200.0)   # 12,000 / 60

    def test_spending_above_income_says_so(self):
        d = detect(typical=1000.0, income=500.0)
        self.assertFalse(d["feasible"])
        self.assertIn("well above your income of ₱500.00 a day", d["reason"])
        self.assertEqual(goal_plan(d)["saving"]["perDay"], 0.0)

    def test_short_pause_is_not_a_gap(self):
        spend = [(TODAY - timedelta(days=3 + i), 100.0) for i in range(30)]
        out = attitude_inputs(spend, [], TODAY)
        self.assertIsNone(out["spending_until"])
        self.assertEqual(out["typical_daily"], 90.0)  # 27 rows inside the last 30 days
        self.assertFalse(detect()["loggingGap"])

    def test_rows_older_than_90_days_are_ignored(self):
        old = [(TODAY - timedelta(days=100 + i), 500.0) for i in range(30)]
        self.assertEqual(attitude_inputs(old, old, TODAY)["typical_daily"], 0.0)


class SaveTests(unittest.IsolatedAsyncioTestCase):
    async def test_skips_the_write_when_the_saved_goal_already_matches(self):
        db = mock.Mock(rpc=mock.AsyncMock())
        d = detect()
        basis = {k: v for k, v in d.items() if k != "attitude"}
        await save_detected(db, "g1", d, {"attitude": d["attitude"], "attitude_basis": basis})
        db.rpc.assert_not_called()
        await save_detected(db, "g1", d, {"attitude": "Normal", "attitude_basis": basis})
        db.rpc.assert_awaited_once()
        self.assertEqual(db.rpc.await_args.args[0], "save_goal_attitude")

    async def test_a_failed_write_never_raises(self):
        db = mock.Mock(rpc=mock.AsyncMock(side_effect=RuntimeError("down")))
        await save_detected(db, "g1", detect())


# ------------------------------------------------------------------ the API

GOAL_ID = "11111111-2222-3333-4444-555555555555"
NOW = today_ph()
GOOD = {"Authorization": "Bearer good"}


class FakeSupabase:
    def __init__(self):
        self.saved: list[dict] = []
        self.goal = {"id": GOAL_ID, "goal_name": "Laptop", "target_amount": 10000, "current_amount": 1000,
                     "target_date": (NOW + timedelta(days=90)).isoformat(), "attitude": "Normal",
                     "attitude_basis": None, "is_active": True, "completed": False}

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/auth/v1/user":
            return httpx.Response(200, json={"id": "user-1"})
        table = path.rsplit("/", 1)[-1]
        if table == "ai_rate_limit_take":
            return httpx.Response(200, json=0)
        if table == "save_goal_attitude":
            self.saved.append(json.loads(request.content))
            return httpx.Response(200, json=True)
        if request.method == "POST":
            row = {**json.loads(request.content), "id": "row-1", "created_at": "2026-11-11T00:00:00+00:00"}
            return httpx.Response(201, json=[row])
        if table == "goals":
            wanted = request.url.params.get("id", "").removeprefix("eq.")
            return httpx.Response(200, json=[self.goal] if not wanted or wanted == GOAL_ID else [])
        data = {
            "profiles": [{"active_wallet_id": "w1"}],
            "wallets": [{"id": "w1", "name": "Cash", "budget": 5000}],
            # 200 a day for 60 days; no income logged, so the user is assumed to break even.
            "expenses": [{"amount": 200, "category_name": "Food", "wallet_id": "w1", "description": "food",
                          "spent_on": (NOW - timedelta(days=i)).isoformat(), "metadata": {}} for i in range(60)],
        }.get(table, [])
        return httpx.Response(200, json=data)


class AttitudeApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        get_settings.cache_clear()
        auth.clear_auth_cache()
        rate_limit.reset()
        self.supa = FakeSupabase()
        set_http(httpx.AsyncClient(transport=httpx.MockTransport(self.supa.handler)))
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://buck-ai")
        for module, exc in ((gemini, gemini.GeminiUnavailable), (groq, groq.GroqUnavailable)):
            patcher = mock.patch.object(module, "generate_json", mock.AsyncMock(side_effect=exc("off")))
            patcher.start()
            self.addCleanup(patcher.stop)

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_preview_detects_without_saving(self):
        r = await self.client.post("/advisor/attitude", headers=GOOD,
                                   json={"targetAmount": 9000, "targetDate": (NOW + timedelta(days=90)).isoformat()})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        # Needs 100 a day of a usual 200: a 50% cut, past what Buck asks for.
        self.assertEqual((body["attitude"], body["feasible"]), ("Aggressive", False))
        self.assertEqual(body["plan"]["spending"]["perDay"], 120.0)
        self.assertEqual(set(body["plan"]["spending"]), {"perDay", "perWeek", "perMonth"})
        self.assertEqual(self.supa.saved, [])

    async def test_saved_goal_is_detected_and_saved(self):
        r = await self.client.post("/advisor/attitude", headers=GOOD, json={"goalId": GOAL_ID})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["attitude"], "Aggressive")  # 9,000 over 90 days = 100 of 200 a day
        self.assertEqual(len(self.supa.saved), 1)
        self.assertEqual(self.supa.saved[0]["p_goal_id"], GOAL_ID)
        self.assertEqual(self.supa.saved[0]["p_attitude"], "Aggressive")
        self.assertNotIn("attitude", self.supa.saved[0]["p_basis"])

    async def test_validation(self):
        self.assertEqual((await self.client.post("/advisor/attitude", headers=GOOD, json={})).status_code, 422)
        bad = await self.client.post("/advisor/attitude", headers=GOOD, json={"goalId": "x or 1=1"})
        self.assertEqual(bad.status_code, 422)
        missing = await self.client.post("/advisor/attitude", headers=GOOD,
                                         json={"goalId": "99999999-2222-3333-4444-555555555555"})
        self.assertEqual(missing.status_code, 404)
        self.assertEqual((await self.client.post("/advisor/attitude", json={"goalId": GOAL_ID})).status_code, 401)

    async def test_forecaster_plans_the_active_goal_with_the_detected_attitude(self):
        self.supa.goal["current_amount"] = 8000  # 2,000 left over 90 days: 22/day of 200 = 11% cut
        r = await self.client.get("/forecast?horizon=30", headers=GOOD)
        self.assertEqual(r.status_code, 200, r.text)
        forecast = r.json()["forecast"]
        goal = forecast["goal"]
        self.assertEqual(goal["attitude"], "Moderate")
        self.assertEqual(forecast["target"]["attitude"], "Moderate")
        self.assertEqual(goal["plan"]["spending"]["perDay"], 160.0)
        self.assertEqual(goal["plan"]["saving"]["perWeek"], 280.0)
        self.assertIsInstance(goal["withinPlan"], bool)
        self.assertEqual(self.supa.saved[-1]["p_attitude"], "Moderate")

    async def test_inactive_goal_is_not_planned(self):
        self.supa.goal["is_active"] = False
        r = await self.client.get("/forecast?horizon=30", headers=GOOD)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIsNone(r.json()["forecast"]["goal"])
        self.assertEqual(self.supa.saved, [])


if __name__ == "__main__":
    unittest.main()
