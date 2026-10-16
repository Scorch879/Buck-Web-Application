"""Tests for the Advisor's deterministic plan and its rule-based fallback."""

import os
import unittest

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from BuckAI_Advisor.plan import build_plan  # noqa: E402
from BuckAI_Advisor.rules import rule_insight, wallet_advice  # noqa: E402
from BuckAI_Advisor.snapshot import Snapshot  # noqa: E402

GOAL = {"name": "Emergency Buffer", "target_amount": 60000, "saved_amount": 6337.5,
        "remaining": 53662.5, "target_date": "2026-11-15", "days_left": 30}


def plan(**overrides):
    args = dict(attitude="Moderate", spent_last_30_days=15000, income_this_month=None,
                active_wallet_balance=372343.09, days_in_month=31, days_remaining_in_month=15, goal=GOAL)
    args.update(overrides)
    return build_plan(**args)


class PlanTests(unittest.TestCase):
    def test_every_figure_states_its_basis(self):
        p = plan()
        self.assertEqual(p["typical_daily_spending"]["amount"], 500.0)
        self.assertIn("last 30 days", p["typical_daily_spending"]["basis"])
        self.assertEqual(p["daily_spending_cap"]["amount"], 400.0)  # 500 x 0.80 Moderate
        self.assertIn("Moderate", p["daily_spending_cap"]["basis"])
        self.assertIn("2026-11-15", p["goal_pace"]["required_basis"])

    def test_goal_pace_is_capped_by_what_is_affordable(self):
        # Income 20,000; cap 400/day x 31 = 12,400 -> 7,600 spare/month -> 1,716.13/week.
        p = plan(income_this_month=20000)
        pace = p["goal_pace"]
        self.assertAlmostEqual(pace["required_per_week"], 12521.25, places=2)
        self.assertAlmostEqual(p["affordable_saving_per_week"]["amount"], 1716.13, places=2)
        self.assertEqual(pace["recommended_per_week"], p["affordable_saving_per_week"]["amount"])
        self.assertFalse(pace["on_track_by_target_date"])
        self.assertEqual(pace["weeks_to_goal_at_recommended"], 31)

    def test_attitude_scales_pace_when_affordable(self):
        pace = plan()["goal_pace"]  # large wallet: affordable is not the limit
        self.assertAlmostEqual(pace["recommended_per_week"], round(12521.25 * 1.15, 2), places=2)
        self.assertTrue(pace["on_track_by_target_date"])

    def test_no_goal_or_no_date(self):
        self.assertNotIn("goal_pace", plan(goal=None))
        pace = plan(goal={**GOAL, "target_date": None, "days_left": None})["goal_pace"]
        self.assertIsNone(pace["required_per_week"])


def snapshot(goal=GOAL, wallets=None, spent=8000.0):
    p = plan(goal=goal)
    data = {
        "today": "2026-10-16", "month": {"start": "2026-10-01"}, "saving_attitude": "Moderate",
        "wallets": wallets if wallets is not None else [
            {"name": "Cash", "balance": 372343.09, "active": True},
            {"name": "BDO Savings", "balance": 90000.0, "active": False},
            {"name": "GCash", "balance": 2500.0, "active": False},
        ],
        "active_wallet_balance": 372343.09, "income_this_month": None, "spent_this_month": spent,
        "top_categories_this_month": [{"name": "Food", "amount": 4000.0}], "active_goal": goal, "plan": p,
    }
    return Snapshot(data)


class RuleFallbackTests(unittest.TestCase):
    def test_goal_advice_uses_the_plan_not_the_whole_remaining(self):
        out = rule_insight(snapshot())
        self.assertIn("this week", out["suggestion"])
        self.assertNotIn("53,662.50", out["suggestion"])  # never "move everything now"
        self.assertIn("last-30-day average", out["advice"])
        self.assertIn("2026-10-01", out["advice"])  # the period is named

    def test_wallet_advice_names_real_wallets(self):
        text = wallet_advice(snapshot())
        self.assertIn("Cash (₱372,343.09)", text)
        self.assertIn("BDO Savings (₱90,000.00)", text)  # largest non-active wallet kept for the goal
        self.assertIn("Emergency Buffer", text)
        self.assertIn("Add a wallet", wallet_advice(snapshot(wallets=[])))


if __name__ == "__main__":
    unittest.main()
