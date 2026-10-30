"""Money, dates and saving attitudes shared by both AIs.

Philippine time (UTC+8, no DST) decides what "today" and "this month" mean.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any

PH_TZ = timezone(timedelta(hours=8))
ATTITUDES = ("Normal", "Moderate", "Aggressive")
# CLAUDE.md §6.5: spending target and savings target per attitude.
SPEND_MULTIPLIER = {"Normal": 1.0, "Moderate": 0.80, "Aggressive": 0.60}
SAVE_MULTIPLIER = {"Normal": 1.0, "Moderate": 1.15, "Aggressive": 1.30}


def today_ph() -> date:
    return datetime.now(PH_TZ).date()


def money(value: Any) -> float:
    try:
        return round(max(0.0, float(value)), 2)
    except (TypeError, ValueError):
        return 0.0


def peso(amount: float) -> str:
    return f"₱{amount:,.2f}"


def month_bounds(day: date) -> tuple[date, date]:
    start = day.replace(day=1)
    next_month = (start + timedelta(days=32)).replace(day=1)
    return start, next_month - timedelta(days=1)
