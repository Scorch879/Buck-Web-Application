"""AI Forecaster model tests on synthetic users. Run from Buck_AI/: python -m unittest -v"""

import random
import time
import unittest
from datetime import date, timedelta

from BuckAI_Forecast.forecast import History, build_forecast
from BuckAI_Forecast.model import Expense, Income

TODAY = date(2026, 10, 30)
WALLETS = [{"id": "w1", "name": "Cash", "balance": 12000, "active": True},
           {"id": "w2", "name": "GCash", "balance": 3000, "active": False}]


def user(days=150, seed=1, *, weekend=False, bill=False, payday=False, one_off=False, end=TODAY):
    r = random.Random(seed)
    expenses, incomes = [], []
    for i in range(days):
        d = end - timedelta(days=i)
        expenses.append(Expense(d, round(max(20, r.gauss(150, 40)), 2), "Food", "w1", "lunch"))
        if d.weekday() < 5 and r.random() < 0.8:
            expenses.append(Expense(d, 50, "Fare", "w1", "jeep"))
        if weekend and d.weekday() >= 5:
            expenses.append(Expense(d, round(max(100, r.gauss(800, 150)), 2), "Entertainment", "w2", "movies"))
        if bill and d.day == 5:
            expenses.append(Expense(d, 1500, "Bills", "w1", "Meralco"))
        if payday:
            if d.day in (15, 30):
                incomes.append(Income(d, 15000))
            if d.day in (15, 16, 17, 30, 1, 2):
                expenses.append(Expense(d, round(max(200, r.gauss(1200, 200)), 2), "Shopping", "w1", "mall"))
    if one_off:
        expenses.append(Expense(end - timedelta(days=20), 20000, "Food", "w1", "party"))
    return expenses, incomes


def history(expenses, incomes=(), today=TODAY, attitude="Normal", goal=None):
    return History(today, list(expenses), list(incomes), WALLETS, attitude, goal)


def money_values(node, path=""):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from money_values(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from money_values(v, f"{path}[{i}]")
    elif isinstance(node, float):
        yield path, node


class ForecastModelTests(unittest.TestCase):
    def test_band_covers_most_held_out_days(self):
        coverage = []
        for seed in range(4):
            expenses, incomes = user(seed=seed, weekend=True, bill=True)
            cut = TODAY - timedelta(days=30)
            f = build_forecast(history([e for e in expenses if e.day <= cut], incomes, today=cut), 30)
            actual, inside = 0.0, 0
            for row in f["days"]:
                actual += sum(e.amount for e in expenses if e.day.isoformat() == row["date"])
                c = row["cumulative"]
                inside += c["p10"] * 0.97 <= actual <= c["p90"] * 1.03
            coverage.append(inside / len(f["days"]))
        self.assertGreaterEqual(sum(coverage) / len(coverage), 0.6, coverage)

    def test_weekend_spender(self):
        f = build_forecast(history(*user(weekend=True)), 30)
        by_day = {date.fromisoformat(d["date"]).weekday(): d["expected"] for d in f["days"]}
        self.assertGreater(by_day[5], 2 * by_day[2])  # Saturday vs. Wednesday
        self.assertTrue(any("Weekend spender" in h["text"] for h in f["habits"]), f["habits"])
        self.assertEqual(f["habits"][0]["value"], "weekly")

    def test_monthly_bill_lands_on_its_due_date(self):
        f = build_forecast(history(*user(bill=True)), 60)
        self.assertEqual([r["nextDue"] for r in f["recurring"]], ["2026-11-05"])
        rows = {d["date"]: d for d in f["days"]}
        self.assertEqual(rows["2026-11-05"]["recurring"], 1500.0)
        self.assertEqual(rows["2026-12-05"]["recurring"], 1500.0)
        self.assertGreater(rows["2026-11-05"]["p10"], 1500.0)

    def test_payday_spender(self):
        f = build_forecast(history(*user(payday=True)), 30)
        self.assertTrue(any(h["kind"] == "payday" for h in f["habits"]), f["habits"])
        rows = {d["date"]: d["expected"] for d in f["days"]}
        self.assertGreater(rows["2026-11-15"], 2 * rows["2026-11-10"])

    def test_one_off_is_excluded_from_the_baseline(self):
        with_it = build_forecast(history(*user(one_off=True)), 30)
        without = build_forecast(history(*user()), 30)
        self.assertEqual([e["amount"] for e in with_it["excluded"]], [20000.0])
        self.assertAlmostEqual(with_it["total"]["p50"], without["total"]["p50"], delta=without["total"]["p50"] * 0.1)
        self.assertNotIn("up", " ".join(h["text"] for h in with_it["habits"] if h["kind"] == "trend"))

    def test_new_user_is_low_data_with_a_wide_band(self):
        expenses = [Expense(TODAY - timedelta(days=i), 200, "Food", "w1", "x") for i in range(4)]
        f = build_forecast(history(expenses), 30)
        self.assertTrue(f["model"]["lowData"])
        self.assertLessEqual(f["model"]["confidence"], 0.2)
        self.assertGreater(f["total"]["p90"], 1.3 * f["total"]["p10"])

    def test_no_data_at_all(self):
        f = build_forecast(history([]), 30)
        self.assertEqual(f["total"], {"p10": 0.0, "p50": 0.0, "p90": 0.0})
        self.assertTrue(f["model"]["lowData"])

    def test_same_data_same_forecast(self):
        a = build_forecast(history(*user(weekend=True, bill=True)), 60)
        b = build_forecast(history(*user(weekend=True, bill=True)), 60)
        self.assertEqual(a, b)

    def test_money_is_rounded_and_attitude_scales_the_target(self):
        goal = {"name": "Laptop", "targetAmount": 50000, "savedAmount": 10000, "targetDate": "2027-03-01"}
        f = build_forecast(history(*user(payday=True, bill=True, weekend=True), attitude="Aggressive", goal=goal), 60)
        for path, value in money_values({k: f[k] for k in ("days", "total", "month", "categories", "wallets", "target")}):
            if "surplus" in path or "share" in path or "multiplier" in path:
                continue
            self.assertGreaterEqual(value, 0, path)
            self.assertEqual(round(value, 2), value, path)
        self.assertAlmostEqual(f["target"]["dailyTarget"], f["target"]["expectedDaily"] * 0.6, delta=0.01)
        self.assertIsNotNone(f["goal"]["reachBy"])
        self.assertEqual(len(f["days"]), 60)

    def test_wallet_runway(self):
        f = build_forecast(history(*user(weekend=True)), 60)
        gcash = next(w for w in f["wallets"] if w["name"] == "GCash")
        self.assertIsNotNone(gcash["runsOut"]["likely"])  # ₱3,000 vs. ~₱1,600 of weekend outings a week
        self.assertLessEqual(gcash["runsOut"]["early"], gcash["runsOut"]["late"])
        self.assertFalse(gcash["empty"])

    def test_empty_wallet_still_spent_from_is_flagged(self):
        h = history(*user(weekend=True))
        h.wallets = [WALLETS[0], {**WALLETS[1], "balance": 0}]
        f = build_forecast(h, 30)
        gcash = next(w for w in f["wallets"] if w["name"] == "GCash")
        self.assertTrue(gcash["empty"])
        self.assertTrue(any(w.startswith("GCash is empty") for w in f["warnings"]))

    def test_logging_gap_is_flagged(self):
        daily = build_forecast(history(*user()), 30)
        self.assertFalse(daily["model"]["loggingGap"])
        self.assertEqual(daily["model"]["quietDays"], 0)
        # A daily spender who logged nothing for the last 19 days.
        f = build_forecast(history(*user(end=TODAY - timedelta(days=19))), 30)
        self.assertTrue(f["model"]["loggingGap"])
        self.assertEqual(f["model"]["quietDays"], 19)
        self.assertTrue(f["warnings"][0].startswith("Nothing logged for 19 days"))

    def test_target_gap(self):
        f = build_forecast(history(*user(), attitude="Moderate"), 30)
        t = f["target"]
        self.assertAlmostEqual(t["gapPerDay"], t["expectedDaily"] - t["dailyTarget"], delta=0.02)
        self.assertEqual(build_forecast(history(*user()), 30)["target"]["gapPerDay"], 0)

    def test_fast_enough(self):
        r = random.Random(3)
        expenses = [Expense(TODAY - timedelta(days=i), round(r.uniform(50, 900), 2), f"Cat{c}", "w1", f"item {c}")
                    for i in range(180) for c in range(17) if r.random() < 0.5]
        start = time.perf_counter()
        build_forecast(history(expenses), 60)
        self.assertLess(time.perf_counter() - start, 1.5)  # ~0.3-0.5 s locally; slack for CI


if __name__ == "__main__":
    unittest.main()
