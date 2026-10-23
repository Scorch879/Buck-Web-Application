"""The Advisor's view of a user's money: a numbers-only snapshot.

Built fresh on every request from the user's own rows (read under RLS), so
advice always reflects current data. The `data` dict is what Gemini sees: no
ids, emails or free-text descriptions. `refs` keeps ids for saving.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

from shared.safety import clean_text
from shared.supabase import DbError, UserDb

from .plan import build_plan

# Philippine time (UTC+8, no DST) decides what "this month" and "today" mean.
PH_TZ = timezone(timedelta(hours=8))
ATTITUDES = ("Normal", "Moderate", "Aggressive")


def today_ph() -> date:
    return datetime.now(PH_TZ).date()


def money(value: Any) -> float:
    try:
        return round(max(0.0, float(value)), 2)
    except (TypeError, ValueError):
        return 0.0


def month_bounds(day: date) -> tuple[date, date]:
    start = day.replace(day=1)
    next_month = (start + timedelta(days=32)).replace(day=1)
    return start, next_month - timedelta(days=1)


@dataclass
class Snapshot:
    data: dict[str, Any]
    refs: dict[str, str | None] = field(default_factory=dict)

    @property
    def spending_base(self) -> float:
        """What this month's spending is measured against: income when tracked, else the active wallet."""
        income = self.data.get("income_this_month")
        return income if income else self.data["active_wallet_balance"]


def health_score(spent: float, base: float) -> int:
    ratio = spent / base if base > 0 else 0.5
    if ratio < 0.5:
        return 90
    if ratio < 0.8:
        return 78
    if ratio <= 1.0:
        return 62
    return max(20, round(50 - (ratio - 1.0) * 40))


async def build_snapshot(db: UserDb, today: date | None = None) -> Snapshot:
    today = today or today_ph()
    month_start, month_end = month_bounds(today)
    prev_start, _ = month_bounds(month_start - timedelta(days=1))
    # Enough history for both last month and a full last-30-day window.
    history_start = min(prev_start, today - timedelta(days=29))
    uid = f"eq.{db.user_id}"

    async def incomes() -> list[dict[str, Any]] | None:
        try:
            return await db.select(
                "incomes",
                [("select", "amount"), ("user_id", uid),
                 ("received_on", f"gte.{month_start}"), ("received_on", f"lte.{month_end}")],
            )
        except DbError:
            return None  # income tracking not available on this database

    # Independent reads run in parallel to keep latency to one round trip.
    profile_rows, wallet_rows, expense_rows, goal_rows, income_rows = await asyncio.gather(
        db.select("profiles", {"select": "active_wallet_id", "id": uid}),
        db.select("wallets", {"select": "id,name,budget", "user_id": uid, "deleted_at": "is.null"}),
        db.select(
            "expenses",
            [("select", "amount,category_name,spent_on"), ("user_id", uid),
             ("spent_on", f"gte.{history_start}"), ("spent_on", f"lte.{month_end}")],
        ),
        db.select(
            "goals",
            {"select": "id,goal_name,target_amount,current_amount,target_date,attitude,is_active,completed",
             "user_id": uid, "order": "created_at.desc", "limit": "20"},
        ),
        incomes(),
    )

    active_wallet_id = (profile_rows[0].get("active_wallet_id") if profile_rows else None)
    wallets = [
        {"name": clean_text(w.get("name"), 60) or "Wallet", "balance": money(w.get("budget")),
         "active": w.get("id") == active_wallet_id}
        for w in wallet_rows
    ]
    active_balance = next((w["balance"] for w in wallets if w["active"]), 0.0)

    # Expense aggregates
    by_category: dict[str, float] = {}
    spent_month = spent_prev = last7 = prior7 = last30 = 0.0
    for row in expense_rows:
        amount = money(row.get("amount"))
        try:
            spent_on = date.fromisoformat(str(row.get("spent_on"))[:10])
        except ValueError:
            continue
        if spent_on > today:
            continue
        if spent_on >= month_start:
            spent_month += amount
            name = clean_text(row.get("category_name"), 60) or "Uncategorized"
            by_category[name] = by_category.get(name, 0.0) + amount
        elif spent_on >= prev_start:
            spent_prev += amount
        age = (today - spent_on).days
        if age < 30:
            last30 += amount
        if age < 7:
            last7 += amount
        elif age < 14:
            prior7 += amount

    days_elapsed = today.day
    days_total = month_end.day
    avg_daily = spent_month / days_elapsed if days_elapsed else 0.0
    projected = spent_month + avg_daily * (days_total - days_elapsed)

    income = round(sum(money(r.get("amount")) for r in income_rows), 2) if income_rows is not None else None

    # Active goal: the flagged one, else the newest unfinished one.
    goal_row = next((g for g in goal_rows if g.get("is_active") and not g.get("completed")), None) or next(
        (g for g in goal_rows if not g.get("completed")), None
    )
    goal = None
    attitude = "Normal"
    if goal_row:
        attitude = goal_row.get("attitude") if goal_row.get("attitude") in ATTITUDES else "Normal"
        target, saved = money(goal_row.get("target_amount")), money(goal_row.get("current_amount"))
        target_date = str(goal_row["target_date"])[:10] if goal_row.get("target_date") else None
        days_left = (date.fromisoformat(target_date) - today).days if target_date else None
        goal = {
            "name": clean_text(goal_row.get("goal_name"), 80) or "Goal",
            "target_amount": target,
            "saved_amount": saved,
            "remaining": round(max(0.0, target - saved), 2),
            "target_date": target_date,
            "days_left": days_left,
        }

    total_spent = round(spent_month, 2)
    top = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)[:8]
    data = {
        "today": today.isoformat(),
        "month": {"start": month_start.isoformat(), "end": month_end.isoformat(),
                  "days_elapsed": days_elapsed, "days_remaining": days_total - days_elapsed},
        "saving_attitude": attitude,
        "wallets": wallets,
        "active_wallet_balance": active_balance,
        "total_wallet_balance": round(sum(w["balance"] for w in wallets), 2),
        "income_this_month": income,
        "spent_this_month": total_spent,
        "spent_previous_month": round(spent_prev, 2),
        "spent_last_7_days": round(last7, 2),
        "spent_prior_7_days": round(prior7, 2),
        "spent_last_30_days": round(last30, 2),
        "average_daily_spending": round(avg_daily, 2),
        "projected_month_spending": round(projected, 2),
        "top_categories_this_month": [
            {"name": n, "amount": round(a, 2), "share_pct": round(a / total_spent * 100) if total_spent else 0}
            for n, a in top
        ],
        "active_goal": goal,
        "plan": build_plan(
            attitude=attitude,
            spent_last_30_days=last30,
            income_this_month=income,
            active_wallet_balance=active_balance,
            days_in_month=days_total,
            days_remaining_in_month=days_total - days_elapsed,
            goal=goal,
        ),
    }
    snapshot = Snapshot(data, {"goal_id": goal_row.get("id") if goal_row else None,
                               "wallet_id": active_wallet_id})
    data["financial_health_score"] = health_score(total_spent, snapshot.spending_base)
    return snapshot
