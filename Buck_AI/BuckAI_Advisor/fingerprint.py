"""Decides when saved advice is out of date.

The fingerprint captures only *material* facts, bucketed so small changes (a
₱40 snack) do not trigger a new Gemini call, while meaningful ones (a big
purchase, a new top category, goal progress, a new month) do. Saved advice
whose fingerprint still matches is served straight from the database.
"""

import hashlib
import json
import math
from typing import Any

from .snapshot import Snapshot


def _bucket(amount: float, step: float) -> int:
    return math.floor(amount / step) if step > 0 else 0


def fingerprint_parts(snapshot: Snapshot) -> dict[str, Any]:
    d = snapshot.data
    base = snapshot.spending_base
    # Spending moves in steps of 5% of the budget (at least ₱500).
    step = max(500.0, base * 0.05)
    goal = d["active_goal"]
    goal_step = max(500.0, goal["target_amount"] * 0.05) if goal else 0
    return {
        "month": d["month"]["start"],
        "attitude": d["saving_attitude"],
        "spent": _bucket(d["spent_this_month"], step),
        "income": _bucket(d["income_this_month"], step) if d["income_this_month"] else None,
        "wallet": _bucket(d["active_wallet_balance"], step),
        "top_categories": [c["name"] for c in d["top_categories_this_month"][:3]],
        "goal": [goal["name"], goal["target_date"], _bucket(goal["remaining"], goal_step)] if goal else None,
    }


def fingerprint(snapshot: Snapshot) -> str:
    raw = json.dumps(fingerprint_parts(snapshot), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def changed_facts(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    """Which material facts moved since the saved advice (shown to Gemini so
    the new advice can say what changed)."""
    if not old:
        return []
    return sorted(key for key in new if old.get(key) != new.get(key))
