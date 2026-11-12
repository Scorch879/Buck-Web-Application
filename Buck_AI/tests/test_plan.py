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

    def test_logging_gap_uses_the_days_up_to_the_last_expense(self):
        p = plan(spent_last_30_days=6000, spend_days=30, spending_until="2026-10-11")
        self.assertEqual(p["typical_daily_spending"]["amount"], 200.0)  # not 0 because of the gap
        self.assertEqual(p["spending_logged_until"], "Oct 11, 2026")
        self.assertIn("up to Oct 11, 2026", p["typical_daily_spending"]["period"])
        self.assertIn("÷ 30", p["typical_daily_spending"]["basis"])
        self.assertIsNone(plan()["spending_logged_until"])

    def test_new_user_is_averaged_over_the_days_logged(self):
        p = plan(spent_last_30_days=1400, spend_days=7)
        self.assertEqual(p["typical_daily_spending"]["amount"], 200.0)
        self.assertEqual(p["typical_daily_spending"]["period"], "last-7-day average")

    def test_goal_pace_is_capped_by_what_is_affordable(self):
        # Income 20,000; cap 400/day x 31 = 12,400 -> 7,600 spare/month -> 1,716.13/week.
        p = plan(income_this_month=20000)
        pace = p["goal_pace"]
        self.assertAlmostEqual(pace["required_per_week"], 12521.25, places=2)
        self.assertAlmostEqual(p["affordable_saving_per_week"]["amount"], 1716.13, places=2)
        self.assertEqual(pace["recommended_per_week"], p["affordable_saving_per_week"]["amount"])
        self.assertFalse(pace["on_track_by_target_date"])
        # 53,662.50 / 1,716.13 = 31.3 weeks: the goal is reached in week 32, never "31".
        self.assertEqual(pace["weeks_to_goal_at_recommended"], 32)

    def test_weeks_to_goal_round_up(self):
        # Production case: 53,662.50 at 3,756.37 a week is 14.3 weeks -> 15.
        goal = {**GOAL, "target_date": "2027-03-01", "days_left": 115}
        pace = plan(goal=goal)["goal_pace"]
        self.assertAlmostEqual(pace["recommended_per_week"], 3756.37, places=2)
        self.assertEqual(pace["weeks_to_goal_at_recommended"], 15)

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

    def test_savings_wallet_is_never_the_spending_wallet(self):
        # Production case: the active wallet is the emergency fund.
        wallets = [
            {"name": "Emergency & Savings Fund", "balance": 79247.51, "active": True},
            {"name": "Main Spending Wallet", "balance": 372343.09, "active": False},
            {"name": "GCash / Digital Wallet", "balance": 0.0, "active": False},
        ]
        text = wallet_advice(snapshot(wallets=wallets))
        self.assertNotIn("Spend day to day from Emergency", text)
        self.assertIn("Keep Emergency & Savings Fund (₱79,247.51) for your Emergency Buffer goal", text)
        self.assertIn("make Main Spending Wallet (₱372,343.09) your active wallet", text)
        only_savings = wallet_advice(snapshot(wallets=wallets[:1]))
        self.assertIn("add a separate wallet for day-to-day spending", only_savings)


if __name__ == "__main__":
    unittest.main()
