"""Saving attitude detection and the goal spending plan, shared by both AIs.

The AI Financial Advisor detects the attitude; the AI Forecaster plans with
it. Both call these functions on the same raw rows, so they always agree.

How the attitude is chosen: the goal needs `remaining ÷ days left` set aside
each day. What is left to spend is income per day minus that amount (when no
income is logged, Buck assumes the user breaks even: income = usual spending).
The cut needed is how far that allowance sits below usual daily spending:

    cut <= 0          Normal      usual spending already reaches the goal
    0 < cut <= 20%    Moderate    spend about 0.80x usual
    cut > 20%         Aggressive  spend about 0.60x usual (feasible up to 40%)

A 3-point margin keeps the saved attitude from flipping back and forth when
the cut sits on a boundary. Every amount is PHP, 2 decimals, never negative.
"""

import asyncio
import logging
import math
from collections.abc import Iterable
from datetime import date, timedelta
from typing import Any

from .money import ATTITUDES, SAVE_MULTIPLIER, SPEND_MULTIPLIER, money, peso
from .supabase import DbError

BOUNDS = (0.0, 0.20)          # Normal | Moderate | Aggressive
MAX_FEASIBLE_CUT = 0.40       # Aggressive spends 0.60x usual: the most Buck asks
MARGIN = 0.03
SPEND_DAYS = 30               # usual spending: the last 30 days
QUIET_DAYS = 7                # nothing logged this long: measure up to the last logged day
INCOME_DAYS_MIN, INCOME_DAYS_MAX = 30, 90
WEEK, MONTH = 7, 30

log = logging.getLogger("buck_ai.attitude")


def _m(value: float) -> float:
    return round(max(0.0, float(value)), 2)


def attitude_inputs(expenses: Iterable[tuple[date, float]], incomes: Iterable[tuple[date, float]],
                    today: date) -> dict[str, Any]:
    """Usual daily spending and income per day from raw `(day, amount)` rows.

    Spending: the last 30 days, divided by the days actually logged when the
    user is newer than that (at least 7). Income: the last 30-90 days (as
    much history as exists), so a monthly allowance is spread over a month.
    When no expense has been logged for 7+ days, both windows end at the last
    logged expense instead of today, so a logging gap doesn't read as "spends
    nothing" (or as a missed payday). Only rows from the last 90 days count,
    whatever the caller loaded.
    """
    def recent(rows: Iterable[tuple[date, float]]) -> list[tuple[date, float]]:
        return [(d, a) for d, a in rows if 0 <= (today - d).days < INCOME_DAYS_MAX and a > 0]

    spent, earned = recent(expenses), recent(incomes)
    first = min([d for d, _ in spent] + [d for d, _ in earned], default=None)
    last = max((d for d, _ in spent), default=None)
    gap = last is not None and (today - last).days >= QUIET_DAYS
    end = last if gap else today
    observed = max(0, (end - first).days + 1) if first else 0
    spend_days = max(7, min(SPEND_DAYS, observed))
    last30 = sum(a for d, a in spent if 0 <= (end - d).days < SPEND_DAYS)
    income_days = max(INCOME_DAYS_MIN, min(INCOME_DAYS_MAX, observed))
    income = sum(a for d, a in earned if 0 <= (end - d).days < income_days)
    return {
        "typical_daily": round(last30 / spend_days, 2) if spent else 0.0,
        "income_daily": round(income / income_days, 2) if income > 0 else None,
        "spend_days": spend_days,
        "income_days": income_days if income > 0 else None,
        "observed_days": observed,
        "spending_until": end.isoformat() if gap else None,
    }


def _level(cut: float) -> int:
    return sum(cut > b for b in BOUNDS)


def _choose(cut: float, current: str | None) -> str:
    raw = _level(cut)
    if current in ATTITUDES:
        now = ATTITUDES.index(current)
        if raw > now:
            raw = max(now, _level(cut - MARGIN))
        elif raw < now:
            raw = min(now, _level(cut + MARGIN))
    return ATTITUDES[raw]


def _periods(per_day: float) -> dict[str, float]:
    return {"perDay": _m(per_day), "perWeek": _m(per_day * WEEK), "perMonth": _m(per_day * MONTH)}


def _day_label(day: date) -> str:
    return day.strftime("%b %d, %Y").replace(" 0", " ")


def detect_attitude(*, typical_daily: float, income_daily: float | None, remaining: float,
                    target_date: str | None, today: date, current: str | None = None,
                    spending_until: str | None = None) -> dict[str, Any]:
    """The attitude a goal needs, with the figures behind it (saved as `goals.attitude_basis`).

    `spending_until`: the last logged expense when the user has been quiet for
    7+ days (`attitude_inputs`); the reason then says the figures stop there.
    It is kept in the basis, so the saved attitude refreshes once logging resumes.
    """
    result = _detect(typical_daily, income_daily, remaining, target_date, today, current)
    result["loggingGap"] = bool(spending_until)
    result["spendingUntil"] = spending_until
    if spending_until and result.get("requiredSavingPerDay") is not None:
        since = _day_label(date.fromisoformat(spending_until))
        result["reason"] = (f"You haven't logged spending since {since}, so this uses your figures up to then. "
                            + result["reason"])
    return result


def _detect(typical_daily: float, income_daily: float | None, remaining: float, target_date: str | None,
            today: date, current: str | None) -> dict[str, Any]:
    remaining = _m(remaining)
    try:
        days_left = (date.fromisoformat(target_date[:10]) - today).days if target_date else None
    except ValueError:
        days_left = None
    base: dict[str, Any] = {
        "asOf": today.isoformat(), "remaining": remaining, "daysLeft": days_left,
        "typicalDailySpending": _m(typical_daily),
        "incomePerDay": _m(income_daily) if income_daily else None,
        "assumesBreakEven": not income_daily,
        "requiredSavingPerDay": None, "cutNeeded": None, "feasible": True,
    }
    if remaining <= 0:
        return {**base, "attitude": current if current in ATTITUDES else "Normal",
                "reason": "This goal is already reached."}
    if days_left is None or days_left <= 0:
        return {**base, "attitude": "Aggressive", "feasible": False,
                "reason": "The target date has passed. Pick a new date to get a plan."}
    required = remaining / days_left
    base["requiredSavingPerDay"] = _m(required)
    if typical_daily <= 0:
        return {**base, "attitude": current if current in ATTITUDES else "Normal",
                "reason": "Not enough spending logged yet to judge. Log a few days of spending first."}

    income = income_daily if income_daily else typical_daily
    allowance = income - required
    cut = 1 - allowance / typical_daily
    attitude = _choose(cut, current)
    feasible = cut <= MAX_FEASIBLE_CUT
    by = _day_label(date.fromisoformat(target_date[:10]))
    if cut <= 0:
        reason = (f"Your usual spending of {peso(typical_daily)} a day already leaves room to save "
                  f"{peso(required)} a day, so no cut is needed.")
    elif feasible:
        reason = (f"To save {peso(required)} a day by {by}, spend about {round(cut * 100)}% less than your "
                  f"usual {peso(typical_daily)} a day.")
    elif income_daily and income_daily <= typical_daily * SPEND_MULTIPLIER["Aggressive"]:
        reason = (f"Your usual spending of {peso(typical_daily)} a day is well above your income of "
                  f"{peso(income_daily)} a day, so even a 40% cut leaves nothing for this goal. "
                  "Log any income that's missing, or bring spending under your income first.")
    else:
        reason = (f"Saving {peso(required)} a day by {by} would mean cutting your usual {peso(typical_daily)} a day "
                  f"by more than 40%. The plan below keeps a 40% cut; a later date or a smaller target fits it.")
    if attitude != ATTITUDES[_level(cut)]:  # held by the margin
        reason += f" You're close to the line, so Buck keeps your {attitude} plan for now."
    return {**base, "attitude": attitude, "cutNeeded": round(cut, 3), "feasible": feasible,
            "spendAllowancePerDay": _m(allowance), "reason": reason}


def goal_plan(detection: dict[str, Any]) -> dict[str, Any] | None:
    """Daily, weekly and monthly spending limit and saving for the detected attitude.

    Spending limit = the lower of what the goal allows and the attitude's cap
    (usual spending x 1.00 / 0.80 / 0.60), never below 0.60x usual. Saving =
    income (or usual spending, when no income is logged) minus that limit.
    """
    required = detection.get("requiredSavingPerDay")
    typical = detection.get("typicalDailySpending") or 0.0
    if required is None or typical <= 0:
        return None
    attitude = detection["attitude"]
    income = detection.get("incomePerDay") or typical
    cap = typical * SPEND_MULTIPLIER[attitude]
    # Never below the Aggressive floor: an unreachable date shows a later finish, not ₱0 a day.
    floor = typical * SPEND_MULTIPLIER["Aggressive"]
    spend = max(floor, min(detection.get("spendAllowancePerDay", cap), cap))
    save = max(0.0, income - spend)
    remaining = detection["remaining"]
    days_to_goal = math.ceil(round(remaining / save, 6)) if save > 0 else None
    return {
        "attitude": attitude,
        "spendMultiplier": SPEND_MULTIPLIER[attitude],
        "saveMultiplier": SAVE_MULTIPLIER[attitude],
        "spending": _periods(spend),
        "saving": _periods(save),
        "required": _periods(required),
        "daysToGoal": days_to_goal,
        "reachesByTargetDate": days_to_goal is not None and detection["daysLeft"] is not None
        and days_to_goal <= detection["daysLeft"],
        "basis": ("spending limit = lower of (income − required saving) and usual spending × "
                  f"{SPEND_MULTIPLIER[attitude]:.2f}, at least usual spending × 0.60; saving = "
                  f"{'income' if detection.get('incomePerDay') else 'usual spending (no income logged)'} − spending limit"),
    }


async def save_detected(db: Any, goal_id: str | None, detection: dict[str, Any] | None,
                        stored: dict[str, Any] | None = None) -> None:
    """Store the attitude on the goal (as the user; the database writes only on a
    change). `stored` is the goal row already read: when it matches, no call is made.
    Best effort: advice and forecasts never fail over this."""
    if not goal_id or not detection:
        return
    basis = {k: v for k, v in detection.items() if k != "attitude"}
    if stored and stored.get("attitude") == detection["attitude"] and stored.get("attitude_basis") == basis:
        return
    try:
        await db.rpc("save_goal_attitude", {"p_goal_id": goal_id, "p_attitude": detection["attitude"],
                                            "p_basis": basis})
    except Exception as exc:  # noqa: BLE001  never fail advice or a forecast over this
        log.warning("Could not save the detected attitude: %s", exc)


async def load_inputs(db: Any, today: date) -> dict[str, Any]:
    """The 90 days of spending and income `attitude_inputs` needs, read as the user (RLS)."""
    since = today - timedelta(days=INCOME_DAYS_MAX - 1)
    uid = f"eq.{db.user_id}"

    async def incomes() -> list[dict[str, Any]]:
        try:
            return await db.select_all("incomes", [("select", "amount,received_on"), ("user_id", uid),
                                                   ("received_on", f"gte.{since}"), ("received_on", f"lte.{today}")])
        except DbError:
            return []  # income tracking not available on this database

    expense_rows, income_rows = await asyncio.gather(
        db.select_all("expenses", [("select", "amount,spent_on"), ("user_id", uid),
                                   ("spent_on", f"gte.{since}"), ("spent_on", f"lte.{today}")]),
        incomes(),
    )

    def rows(items: list[dict[str, Any]], key: str) -> list[tuple[date, float]]:
        out = []
        for r in items:
            try:
                out.append((date.fromisoformat(str(r.get(key))[:10]), money(r.get("amount"))))
            except ValueError:
                continue
        return out

    return attitude_inputs(rows(expense_rows, "spent_on"), rows(income_rows, "received_on"), today)
