"""Deterministic money plan the Advisor must quote.

Gemini explains numbers; it never invents them. Every figure here carries a
`basis` string saying which period and data it came from, so advice can say
"your last-30-day average of ₱X/day" instead of an unexplained amount.

The goal pace is balanced against everyday spending: the weekly amount the
Advisor recommends is the pace needed to reach the goal on time (scaled by the
saving attitude), capped at what the user can actually spare after their
typical spending. It never asks the user to move the whole remaining amount
at once.
"""

from typing import Any

# CLAUDE.md §6.5: spending target and savings target per attitude.
SPEND_MULTIPLIER = {"Normal": 1.0, "Moderate": 0.80, "Aggressive": 0.60}
SAVE_MULTIPLIER = {"Normal": 1.0, "Moderate": 1.15, "Aggressive": 1.30}


def peso(amount: float) -> str:
    return f"₱{amount:,.2f}"


def _round(n: float) -> float:
    return round(max(0.0, n), 2)


def build_plan(
    *,
    attitude: str,
    spent_last_30_days: float,
    income_this_month: float | None,
    active_wallet_balance: float,
    days_in_month: int,
    days_remaining_in_month: int,
    goal: dict[str, Any] | None,
) -> dict[str, Any]:
    typical_daily = _round(spent_last_30_days / 30)
    spend_mult = SPEND_MULTIPLIER.get(attitude, 1.0)
    save_mult = SAVE_MULTIPLIER.get(attitude, 1.0)
    daily_cap = _round(typical_daily * spend_mult)

    plan: dict[str, Any] = {
        "typical_daily_spending": {
            "amount": typical_daily,
            "basis": f"last 30 days of expenses ({peso(spent_last_30_days)}) ÷ 30",
        },
        "daily_spending_cap": {
            "amount": daily_cap,
            "basis": f"typical daily spending × {spend_mult:.2f} ({attitude} attitude)",
        },
    }

    # What can be set aside each week without cutting below the daily cap.
    if income_this_month:
        spare_month = income_this_month - daily_cap * days_in_month
        affordable_week = _round(spare_month / days_in_month * 7)
        affordable_basis = (
            f"(income this month {peso(income_this_month)} − daily cap × {days_in_month} days) ÷ {days_in_month} × 7"
        )
    else:
        horizon = max((goal or {}).get("days_left") or 30, 7)
        spare = active_wallet_balance - daily_cap * days_remaining_in_month
        affordable_week = _round(spare / horizon * 7)
        affordable_basis = (
            f"(active wallet {peso(active_wallet_balance)} − daily cap × {days_remaining_in_month} days left this month)"
            f" spread over {horizon} days, × 7"
        )
    plan["affordable_saving_per_week"] = {"amount": affordable_week, "basis": affordable_basis}

    if goal and goal.get("remaining", 0) > 0:
        days_left = goal.get("days_left")
        if days_left and days_left > 0:
            required_week = _round(goal["remaining"] / days_left * 7)
            required_basis = f"remaining {peso(goal['remaining'])} ÷ {days_left} days to {goal['target_date']} × 7"
        else:
            required_week = None
            required_basis = "no future target date set"
        target_week = _round(required_week * save_mult) if required_week is not None else affordable_week
        recommended = _round(min(target_week, affordable_week)) if affordable_week > 0 else 0.0
        weeks_to_goal = (
            round(goal["remaining"] / recommended) if recommended > 0 else None
        )
        plan["goal_pace"] = {
            "required_per_week": required_week,
            "required_basis": required_basis,
            "recommended_per_week": recommended,
            "recommended_basis": (
                f"required pace × {save_mult:.2f} ({attitude} attitude), capped at affordable saving per week"
            ),
            "on_track_by_target_date": required_week is not None and recommended >= required_week,
            "weeks_to_goal_at_recommended": weeks_to_goal,
        }
    return plan
