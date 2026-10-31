"""Turns the fitted model and its simulated futures into the forecast payload.

Keys are camelCase: this dict is the API response (web and mobile) and is
saved as `ai_forecasts.metadata.forecast`. Every amount is in PHP, rounded to
2 decimals and never negative. `ai_view` is the part Gemini sees: numbers and
category names only, no descriptions or ids.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import numpy as np

from shared.money import ATTITUDES, SPEND_MULTIPLIER, month_bounds, peso

from .model import (BACKTEST_DAYS, MIN_DAYS, MIN_EXPENSES, SIMULATIONS, WINDOWS, Expense, Income,
                    backtest, find_outliers, find_recurring, first_day, fit, recurring_dates, seed_for,
                    simulate)

HORIZONS = (30, 60)
WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


@dataclass
class History:
    today: date
    expenses: list[Expense]
    incomes: list[Income]
    wallets: list[dict[str, Any]]   # {id, name, balance, active}
    attitude: str = "Normal"
    goal: dict[str, Any] | None = None  # {name, targetAmount, savedAmount, targetDate}


def _m(value: float) -> float:
    return round(max(0.0, float(value)), 2)


def _band(values: np.ndarray) -> dict[str, float]:
    p10, p50, p90 = np.percentile(values, [10, 50, 90])
    return {"p10": _m(p10), "p50": _m(p50), "p90": _m(p90)}


def _avg(expenses: list[Expense], start: date, end: date) -> float:
    days = (end - start).days + 1
    return sum(e.amount for e in expenses if start <= e.day <= end) / days if days > 0 else 0.0


def build_forecast(h: History, horizon: int = 30) -> dict[str, Any]:
    today = h.today
    horizon = horizon if horizon in HORIZONS else 30
    past = [e for e in h.expenses if e.day <= today]
    start = first_day(past, today)
    observed = (today - start).days + 1 if past else 0
    low_data = observed < MIN_DAYS or len(past) < MIN_EXPENSES
    attitude = h.attitude if h.attitude in ATTITUDES else "Normal"

    outliers = find_outliers(past)
    recurring = find_recurring(past, today, outliers)
    usual = [e for i, e in enumerate(past) if i not in outliers]  # one-offs left out of trends
    skip = outliers | {m for r in recurring for m in r.members}
    seed = seed_for(today.isoformat(), horizon, sorted((e.day.isoformat(), e.amount, e.category) for e in past))
    test = backtest(past, h.incomes, today, outliers, seed)
    model = fit(past, h.incomes, today, test.window, skip)

    days = [today + timedelta(days=i) for i in range(1, horizon + 1)]
    sim = simulate(model, recurring, days, SIMULATIONS, seed)
    cum = np.cumsum(sim.total, axis=1)
    lo, mid, hi = np.percentile(sim.total, [10, 50, 90], axis=0)
    clo, cmid, chi = np.percentile(cum, [10, 50, 90], axis=0)
    mean = sim.total.mean(axis=0)
    fixed_by_day = {d: 0.0 for d in days}
    for item in recurring:
        for d in recurring_dates(item, days[0], days[-1]):
            fixed_by_day[d] += item.amount

    day_rows = [
        {"date": d.isoformat(), "p10": _m(lo[i]), "p50": _m(mid[i]), "p90": _m(hi[i]), "expected": _m(mean[i]),
         "cumulative": {"p10": _m(clo[i]), "p50": _m(cmid[i]), "p90": _m(chi[i])},
         "recurring": _m(fixed_by_day[d])}
        for i, d in enumerate(days)
    ]

    # ---- rest of this month
    month_start, month_end = month_bounds(today)
    left = (month_end - today).days
    spent_month = sum(e.amount for e in past if e.day >= month_start)
    rest = _band(cum[:, left - 1]) if left > 0 else {"p10": 0.0, "p50": 0.0, "p90": 0.0}
    income_month = sum(i.amount for i in h.incomes if month_start <= i.day <= today)
    balance = sum(w["balance"] for w in h.wallets)
    if income_month > 0:
        basis, against = "income this month", income_month
        surplus = {k: round(against - spent_month - rest[k], 2) for k in ("p10", "p50", "p90")}
    else:
        basis, against = "current wallet balances", balance
        surplus = {k: round(against - rest[k], 2) for k in ("p10", "p50", "p90")}
    month = {
        "start": month_start.isoformat(), "end": month_end.isoformat(), "daysLeft": left,
        "spentSoFar": _m(spent_month),
        "restOfMonth": rest,
        "projectedTotal": {k: _m(spent_month + v) for k, v in rest.items()},
        # p10 spending gives the best surplus; keep "low/likely/high" meaning for the UI.
        "surplus": {"low": surplus["p90"], "likely": surplus["p50"], "high": surplus["p10"]},
        "surplusBasis": basis,
        "surplusAgainst": _m(against),
    }

    # ---- categories
    trend_now = {c: _avg([e for e in usual if e.category == c], today - timedelta(days=13), today)
                 for c in sim.by_category}
    trend_before = {c: _avg([e for e in usual if e.category == c], today - timedelta(days=43),
                            today - timedelta(days=14)) for c in sim.by_category}
    totals = {c: float(p.sum(axis=1).mean()) for c, p in sim.by_category.items()}
    grand = sum(totals.values()) or 1.0
    recurring_cats = {r.category for r in recurring}
    categories = sorted(
        ({"name": c, "expected": _m(t), "share": round(t / grand * 100, 1),
          "restOfMonth": _m(sim.by_category[c][:, :left].sum(axis=1).mean()) if left else 0.0,
          "trend": _trend(trend_now[c], trend_before[c], observed), "recurring": c in recurring_cats}
         for c, t in totals.items() if t > 0),
        key=lambda r: r["expected"], reverse=True)

    # ---- wallets
    wallets = _wallets(h, past, skip, recurring, sim, days)

    # ---- attitude target
    expected_daily = float(mean.mean())
    multiplier = SPEND_MULTIPLIER[attitude]
    target = {"attitude": attitude, "multiplier": multiplier,
              "expectedDaily": _m(expected_daily), "dailyTarget": _m(expected_daily * multiplier),
              # Target = expected x multiplier, so the gap is the attitude's ask, not a forecast miss.
              "gapPerDay": _m(expected_daily * (1 - multiplier)),
              "restOfMonthTarget": _m(expected_daily * multiplier * left)}

    goal = _goal(h, observed, sim, horizon)
    gap = _logging_gap(past, usual, today, observed)
    habits = _habits(model, recurring, usual, today, observed, gap["gap"])
    excluded = [{"date": past[i].day.isoformat(), "category": past[i].category, "amount": _m(past[i].amount),
                 "label": past[i].label, "reason": "emergency" if past[i].emergency else "one-off"}
                for i in sorted(outliers, key=lambda i: past[i].day, reverse=True)][:10]
    # One-offs excluded, like the baseline.
    moving = {f"d{w}": (_m(_avg(usual, today - timedelta(days=w - 1), today)) if observed >= w else None)
              for w in WINDOWS}

    if test.error is None:
        confidence = 0.15 if low_data else 0.3
    else:
        confidence = max(0.05, min(0.95, 1 - test.error) * min(1.0, observed / 60))
    warnings = _warnings(month, wallets, categories, month_end, gap)

    return {
        "today": today.isoformat(),
        "horizonDays": horizon,
        "days": day_rows,
        "total": _band(cum[:, -1]),
        "month": month,
        "categories": categories,
        "wallets": wallets,
        "target": target,
        "goal": goal,
        "habits": habits,
        "recurring": [{"category": r.category, "label": r.label, "cadence": r.cadence, "amount": _m(r.amount),
                       "nextDue": r.next_due.isoformat()} for r in recurring],
        "excluded": excluded,
        "movingAverages": moving,
        "warnings": warnings,
        "model": {
            "method": "per-user intermittent spending model with Monte Carlo ranges",
            "windowDays": test.window, "observedDays": observed, "simulations": SIMULATIONS,
            "backtestDays": BACKTEST_DAYS if test.error is not None else 0,
            "backtestError": None if test.error is None else round(test.error, 3),
            "bandCoverage": None if test.coverage is None else round(test.coverage, 2),
            "confidence": round(confidence, 2), "lowData": low_data,
            "lastExpense": gap["last"], "quietDays": gap["quietDays"], "loggingGap": gap["gap"],
        },
    }


def _trend(now: float, before: float, observed: int) -> str:
    if observed < 28 or before <= 0:
        return "new" if now > 0 and before <= 0 and observed >= 28 else "steady"
    ratio = now / before
    return "rising" if ratio >= 1.2 else "falling" if ratio <= 0.8 else "steady"


def _wallets(h: History, past: list[Expense], skip: set[int], recurring, sim, days) -> list[dict[str, Any]]:
    if not h.wallets:
        return []
    ids = {w["id"] for w in h.wallets}
    active = next((w["id"] for w in h.wallets if w.get("active")), h.wallets[0]["id"])
    recent = h.today - timedelta(days=89)
    share: dict[str, dict[str, float]] = {}
    for e in past:
        if e.day < recent:
            continue
        wallet = e.wallet if e.wallet in ids else active
        share.setdefault(e.category, {}).setdefault(wallet, 0.0)
        share[e.category][wallet] += e.amount
    n, horizon = sim.total.shape
    paths = {w["id"]: np.zeros((n, horizon)) for w in h.wallets}
    for cat, p in sim.by_category.items():
        split = share.get(cat) or {active: 1.0}
        total = sum(split.values()) or 1.0
        for wallet, amount in split.items():
            paths[wallet] += p * (amount / total)
    out = []
    for w in h.wallets:
        cum = np.cumsum(paths[w["id"]], axis=1)
        spend = _band(cum[:, -1])
        runway = None
        if w["balance"] > 0 and spend["p50"] > 0:
            hit = np.where(cum >= w["balance"], np.arange(horizon), horizon).min(axis=1)
            early, likely, late = np.percentile(hit, [10, 50, 90])

            def when(k: float) -> str | None:
                return days[int(k)].isoformat() if k < horizon else None
            runway = {"early": when(early), "likely": when(likely), "late": when(late)}
        out.append({"name": w["name"], "active": bool(w.get("active")), "balance": _m(w["balance"]),
                    "projectedSpend": spend, "runsOut": runway,
                    # Already empty, but spending usually comes out of it.
                    "empty": w["balance"] <= 0 and spend["p50"] > 0})
    return out


def _goal(h: History, observed: int, sim, horizon: int) -> dict[str, Any] | None:
    g = h.goal
    if not g:
        return None
    remaining = _m(g["targetAmount"] - g["savedAmount"])
    target_date = g.get("targetDate")
    days_left = (date.fromisoformat(target_date) - h.today).days if target_date else None
    out: dict[str, Any] = {"name": g["name"], "remaining": remaining, "targetDate": target_date,
                           "requiredPerDay": _m(remaining / days_left) if days_left and days_left > 0 else None,
                           "freeCashPerDay": None, "reachBy": None, "onTrack": None}
    incomes = [i for i in h.incomes if h.today - timedelta(days=89) <= i.day <= h.today]
    if not incomes or observed < 30 or remaining <= 0:
        return out
    span = min(90, observed)
    income_daily = sum(i.amount for i in incomes) / span
    spend_daily = sim.total.sum(axis=1) / horizon
    free = income_daily - spend_daily
    band = np.percentile(free, [10, 50, 90])
    out["freeCashPerDay"] = {"low": round(float(band[0]), 2), "likely": round(float(band[1]), 2),
                             "high": round(float(band[2]), 2)}

    def reach(per_day: float) -> str | None:
        return (h.today + timedelta(days=int(np.ceil(remaining / per_day)))).isoformat() if per_day > 0 else None
    out["reachBy"] = {"early": reach(band[2]), "likely": reach(band[1]), "late": reach(band[0])}
    if target_date and out["reachBy"]["likely"]:
        out["onTrack"] = out["reachBy"]["likely"] <= target_date
    elif target_date:
        out["onTrack"] = False
    return out


def _habits(model, recurring, past: list[Expense], today: date, observed: int,
            logging_gap: bool = False) -> list[dict[str, str]]:
    habits = []
    if observed >= 28:
        ranked = sorted(range(7), key=lambda d: model.weekday[d], reverse=True)
        top = ranked[0]
        if model.weekday[top] >= 1.3:
            if set(ranked[:2]) <= {4, 5, 6} and model.weekday[ranked[1]] >= 1.2:
                text = (f"Weekend spender: {WEEKDAYS[ranked[0]]}s and {WEEKDAYS[ranked[1]]}s are "
                        f"{model.weekday[top]:.1f}x your usual day.")
            else:
                text = f"Spends most on {WEEKDAYS[top]}s ({model.weekday[top]:.1f}x a usual day)."
            habits.append({"kind": "weekday", "text": text})
        if model.payday >= 1.25:
            habits.append({"kind": "payday", "text": f"Spends {model.payday:.1f}x more in the 3 days after income lands."})
        now = _avg(past, today - timedelta(days=13), today)
        before = _avg(past, today - timedelta(days=43), today - timedelta(days=14))
        # During a logging gap the drop is missing entries, not a habit; the gap warning covers it.
        if before > 0 and abs(now / before - 1) >= 0.2 and not logging_gap:
            change = round((now / before - 1) * 100)
            habits.append({"kind": "trend", "text": f"Daily spending is {'up' if change > 0 else 'down'} "
                                                     f"{abs(change)}% vs. the 30 days before."})
    for r in recurring[:3]:
        habits.append({"kind": "recurring",
                       "text": f"{r.category}: {peso(r.amount)} every {'week' if r.cadence == 'weekly' else 'month'}, "
                               f"next around {r.next_due.strftime('%b %d').replace(' 0', ' ')}."})
    rhythm = ("weekly" if any(x["kind"] == "weekday" for x in habits)
              else "monthly" if any(x["kind"] in ("payday", "recurring") for x in habits) else "steady")
    habits.insert(0, {"kind": "rhythm", "value": rhythm, "text": f"Spending rhythm: {rhythm}."})
    return habits


def _logging_gap(past: list[Expense], usual: list[Expense], today: date, observed: int) -> dict[str, Any]:
    """Nothing logged for much longer than usual: the user may have stopped logging, not spending."""
    if not past:
        return {"last": None, "quietDays": None, "gap": False}
    last = max(e.day for e in past)
    quiet = (today - last).days
    spend_days = sorted({e.day for e in usual})
    gaps = [(b - a).days for a, b in zip(spend_days, spend_days[1:])]
    typical = float(np.median(gaps)) if gaps else 1.0
    return {"last": last.isoformat(), "quietDays": quiet,
            "gap": observed >= 28 and quiet >= 7 and quiet > 3 * typical}


def _warnings(month, wallets, categories, month_end: date, gap: dict[str, Any]) -> list[str]:
    out = []
    if gap["gap"]:
        out.append(f"Nothing logged for {gap['quietDays']} days (last on {gap['last']}). If you've been "
                   f"spending without logging it, this forecast is too low.")
    if month["surplus"]["likely"] < 0:
        out.append(f"Likely to spend {peso(-month['surplus']['likely'])} more than your "
                   f"{month['surplusBasis'].replace(' this month', '')} this month.")
    for w in wallets:
        if w["empty"]:
            out.append(f"{w['name']} is empty, but you usually spend about {peso(w['projectedSpend']['p50'])} "
                       f"from it over this period.")
        likely = (w["runsOut"] or {}).get("likely")
        if likely and likely <= month_end.isoformat():
            out.append(f"{w['name']} may run out around {likely}.")
    for c in categories[:5]:
        if c["trend"] == "rising":
            out.append(f"{c['name']} spending is rising.")
    return out[:5]


def _target_status(target: dict[str, Any]) -> str:
    """Where the expected pace sits against the attitude target, so the AI never has to judge "close"."""
    gap = target["gapPerDay"]
    return "above target" if gap > 0 else "below target" if gap < 0 else "on target"


def ai_view(f: dict[str, Any]) -> dict[str, Any]:
    """What the AI sees: numbers and category names, no descriptions or ids."""
    days = f["days"]
    checkpoints = {f"day{n}": days[n - 1]["cumulative"] for n in (7, 14, 30, 60) if n <= len(days)}
    return {
        "today": f["today"], "horizonDays": f["horizonDays"],
        "cumulativeSpending": checkpoints,
        "month": f["month"], "target": {**f["target"], "status": _target_status(f["target"])}, "goal": f["goal"],
        "categories": [{k: c[k] for k in ("name", "expected", "share", "trend", "recurring")}
                       for c in f["categories"][:8]],
        "wallets": [{k: w[k] for k in ("name", "balance", "projectedSpend", "runsOut", "empty")}
                    for w in f["wallets"]],
        "habits": [h["text"] for h in f["habits"] if h["kind"] != "recurring"],
        "recurring": [{k: r[k] for k in ("category", "cadence", "amount", "nextDue")} for r in f["recurring"]],
        "excludedOneOffs": [{k: e[k] for k in ("date", "category", "amount")} for e in f["excluded"]],
        "movingAverages": f["movingAverages"],
        "model": f["model"],
    }
