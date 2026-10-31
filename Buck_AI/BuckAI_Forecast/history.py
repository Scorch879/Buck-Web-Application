"""Loads the history the Forecaster fits on: the last 180 days, as the user (RLS)."""

import asyncio
from datetime import date, timedelta
from typing import Any

from shared.money import ATTITUDES, money, today_ph
from shared.safety import clean_text
from shared.supabase import DbError, UserDb

from .forecast import History
from .model import HISTORY_DAYS, Expense, Income


def _day(value: Any) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


async def load_history(db: UserDb, today: date | None = None) -> tuple[History, dict[str, str | None]]:
    """Returns the history and `refs` (ids saved with the forecast row)."""
    today = today or today_ph()
    since = today - timedelta(days=HISTORY_DAYS - 1)
    uid = f"eq.{db.user_id}"

    async def incomes() -> list[dict[str, Any]]:
        try:
            return await db.select_all("incomes", [("select", "amount,received_on"), ("user_id", uid),
                                                   ("received_on", f"gte.{since}"), ("received_on", f"lte.{today}")])
        except DbError:
            return []  # income tracking not available on this database

    profile_rows, wallet_rows, expense_rows, goal_rows, income_rows = await asyncio.gather(
        db.select("profiles", {"select": "active_wallet_id", "id": uid}),
        db.select("wallets", {"select": "id,name,budget", "user_id": uid, "deleted_at": "is.null"}),
        db.select_all("expenses", [("select", "amount,category_name,wallet_id,description,spent_on,metadata"),
                                   ("user_id", uid), ("spent_on", f"gte.{since}"), ("spent_on", f"lte.{today}")]),
        db.select("goals", {"select": "id,goal_name,target_amount,current_amount,target_date,attitude,is_active,completed",
                            "user_id": uid, "order": "created_at.desc", "limit": "20"}),
        incomes(),
    )

    active_id = profile_rows[0].get("active_wallet_id") if profile_rows else None
    wallets = [{"id": w.get("id"), "name": clean_text(w.get("name"), 60) or "Wallet",
                "balance": money(w.get("budget")), "active": w.get("id") == active_id} for w in wallet_rows]
    if wallets and not any(w["active"] for w in wallets):
        wallets[0]["active"] = True

    expenses = []
    for row in expense_rows:
        day, amount = _day(row.get("spent_on")), money(row.get("amount"))
        if not day or amount <= 0:
            continue
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        expenses.append(Expense(day, amount, clean_text(row.get("category_name"), 60) or "Uncategorized",
                                row.get("wallet_id"), clean_text(row.get("description"), 60),
                                bool(meta.get("is_emergency"))))
    incomes_out = [Income(d, money(r.get("amount"))) for r in income_rows
                   if (d := _day(r.get("received_on"))) and money(r.get("amount")) > 0]

    # Active goal: the flagged one, else the newest unfinished one (same as the Advisor).
    goal_row = next((g for g in goal_rows if g.get("is_active") and not g.get("completed")), None) or next(
        (g for g in goal_rows if not g.get("completed")), None)
    goal, attitude = None, "Normal"
    if goal_row:
        attitude = goal_row.get("attitude") if goal_row.get("attitude") in ATTITUDES else "Normal"
        goal = {"name": clean_text(goal_row.get("goal_name"), 80) or "Goal",
                "targetAmount": money(goal_row.get("target_amount")),
                "savedAmount": money(goal_row.get("current_amount")),
                "targetDate": str(goal_row["target_date"])[:10] if goal_row.get("target_date") else None}

    history = History(today, expenses, incomes_out, wallets, attitude, goal)
    refs = {"goal_id": goal_row.get("id") if goal_row else None,
            "wallet_id": next((w["id"] for w in wallets if w["active"]), None)}
    return history, refs
