"""Read-only tools the Advisor may call during chat.

Every tool is bound to one user's `UserDb`, which reads with that user's
token under Row-Level Security. The model never supplies a user id, and every
model argument is validated and clamped here.
"""

import re
from datetime import date, timedelta
from typing import Any

from shared.gemini import Tool
from shared.safety import clean_text
from shared.supabase import DbError, UserDb

from .snapshot import money, today_ph

MAX_RANGE_DAYS = 366
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def resolve_range(start: Any, end: Any, today: date | None = None) -> tuple[date, date]:
    """Defaults to the last 30 days, caps the span at one year."""
    today = today or today_ph()

    def parse(value: Any) -> date | None:
        if isinstance(value, str) and _DATE.match(value):
            try:
                return date.fromisoformat(value)
            except ValueError:
                return None
        return None

    end_d = parse(end) or today
    start_d = parse(start) or end_d - timedelta(days=29)
    if start_d > end_d:
        start_d = end_d
    if (end_d - start_d).days > MAX_RANGE_DAYS:
        start_d = end_d - timedelta(days=MAX_RANGE_DAYS)
    return start_d, end_d


def clamp_int(value: Any, low: int, high: int, default: int) -> int:
    try:
        return min(high, max(low, int(value)))
    except (TypeError, ValueError):
        return default


def _escape_like(value: str) -> str:
    return re.sub(r"([%_\\*,()])", r"\\\1", value)


RANGE_PARAMS = {
    "start_date": {"type": "string", "description": "Inclusive start, YYYY-MM-DD. Defaults to 30 days before end_date."},
    "end_date": {"type": "string", "description": "Inclusive end, YYYY-MM-DD. Defaults to today."},
}


def advisor_tools(db: UserDb) -> list[Tool]:
    uid = f"eq.{db.user_id}"

    async def expenses(args: dict[str, Any], limit: int | None = None, category: str | None = None):
        start, end = resolve_range(args.get("start_date"), args.get("end_date"))
        params = [("select", "spent_on,amount,category_name,description"), ("user_id", uid),
                  ("spent_on", f"gte.{start}"), ("spent_on", f"lte.{end}"), ("order", "spent_on.desc")]
        if category:
            params.append(("category_name", f"ilike.{_escape_like(category)}"))
        if limit:
            params.append(("limit", str(limit)))
        # An explicit limit is a single bounded page; otherwise read every row so totals are exact.
        rows = await (db.select if limit else db.select_all)("expenses", params)
        return start, end, [
            {"date": str(r.get("spent_on"))[:10], "amount": money(r.get("amount")),
             "category": clean_text(r.get("category_name"), 60) or "Uncategorized",
             # Free text: PII-scrubbed and shortened before it reaches Gemini.
             "description": clean_text(r.get("description"), 80)}
            for r in rows
        ]

    async def spending_summary(args: dict[str, Any]):
        start, end, rows = await expenses(args)
        totals: dict[str, list[float]] = {}
        for r in rows:
            entry = totals.setdefault(r["category"], [0.0, 0])
            entry[0] += r["amount"]
            entry[1] += 1
        return {
            "start": str(start), "end": str(end),
            "total": round(sum(r["amount"] for r in rows), 2), "transactions": len(rows),
            "categories": sorted(
                ({"category": k, "total": round(v[0], 2), "count": v[1]} for k, v in totals.items()),
                key=lambda c: c["total"], reverse=True,
            ),
        }

    async def list_expenses(args: dict[str, Any]):
        category = clean_text(args.get("category"), 60) or None
        _, _, rows = await expenses(args, limit=clamp_int(args.get("limit"), 1, 25, 15), category=category)
        return rows

    async def income(args: dict[str, Any]):
        start, end = resolve_range(args.get("start_date"), args.get("end_date"))
        try:
            rows = await db.select_all("incomes", [("select", "amount,source"), ("user_id", uid),
                                               ("received_on", f"gte.{start}"), ("received_on", f"lte.{end}")])
        except DbError:
            return {"tracked": False}
        by_source: dict[str, float] = {}
        for r in rows:
            src = clean_text(r.get("source"), 60) or "Other"
            by_source[src] = by_source.get(src, 0.0) + money(r.get("amount"))
        return {"tracked": True, "start": str(start), "end": str(end),
                "total": round(sum(by_source.values()), 2),
                "by_source": [{"source": k, "total": round(v, 2)} for k, v in by_source.items()]}

    async def goals(_: dict[str, Any]):
        rows = await db.select("goals", {"select": "goal_name,target_amount,current_amount,target_date,attitude,is_active,completed",
                                         "user_id": uid, "order": "created_at.desc", "limit": "20"})
        return [{"name": clean_text(g.get("goal_name"), 80) or "Goal", "target": money(g.get("target_amount")),
                 "saved": money(g.get("current_amount")), "target_date": g.get("target_date"),
                 "attitude": g.get("attitude"), "active": bool(g.get("is_active")), "completed": bool(g.get("completed"))}
                for g in rows]

    async def wallets(_: dict[str, Any]):
        profile = await db.select("profiles", {"select": "active_wallet_id", "id": uid})
        active = profile[0].get("active_wallet_id") if profile else None
        rows = await db.select("wallets", {"select": "id,name,budget", "user_id": uid, "deleted_at": "is.null"})
        return [{"name": clean_text(w.get("name"), 60) or "Wallet", "balance": money(w.get("budget")),
                 "active": w.get("id") == active} for w in rows]

    empty: dict[str, Any] = {"type": "object", "properties": {}}
    return [
        Tool("get_spending_summary", "Total spending and per-category totals for a date range (max one year).",
             {"type": "object", "properties": RANGE_PARAMS}, spending_summary),
        Tool("list_expenses", "Individual expenses (newest first) with date, amount, category and a short description.",
             {"type": "object", "properties": {**RANGE_PARAMS,
                                               "category": {"type": "string", "description": "Exact category name."},
                                               "limit": {"type": "integer", "description": "1-25, default 15."}}},
             list_expenses),
        Tool("get_income", "Income received in a date range, by source.",
             {"type": "object", "properties": RANGE_PARAMS}, income),
        Tool("get_goals", "All savings goals with target, saved amount, target date and status.", empty, goals),
        Tool("get_wallets", "Wallets with current balance and which one is active.", empty, wallets),
    ]
