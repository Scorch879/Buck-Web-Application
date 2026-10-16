"""Deterministic advice used when Gemini is unavailable (no key, error, or
free quota exhausted). Every number comes straight from the snapshot, so the
fallback is always accurate, just less personal."""

from .snapshot import Snapshot

ATTITUDE_SPEND_MULTIPLIER = {"Normal": 1.0, "Moderate": 0.8, "Aggressive": 0.6}


def peso(amount: float) -> str:
    return f"₱{amount:,.2f}"


def priority_for(snapshot: Snapshot) -> str:
    d = snapshot.data
    base = snapshot.spending_base
    ratio = d["spent_this_month"] / base if base > 0 else 0.5
    if ratio > 1.0:
        return "urgent"
    if ratio > 0.9:
        return "high"
    top = (d["top_categories_this_month"] or [None])[0]
    if top and base > 0 and top["amount"] > base * 0.35:
        return "high"
    return "medium"


def rule_insight(snapshot: Snapshot) -> dict[str, str]:
    d = snapshot.data
    base = snapshot.spending_base
    spent = d["spent_this_month"]
    ratio = spent / base if base > 0 else 0.5
    top = (d["top_categories_this_month"] or [None])[0]
    goal = d["active_goal"]
    multiplier = ATTITUDE_SPEND_MULTIPLIER[d["saving_attitude"]]

    if ratio > 0.9:
        return {
            "title": "Budget Threshold Alert",
            "suggestion": f"You have used {round(ratio * 100)}% of this month's budget, so pause non-essential purchases now.",
            "advice": (
                f"You have spent {peso(spent)} against {peso(base)} this month. "
                f"Freeze spending on {top['name'] if top else 'leisure'} until the month resets to avoid a deficit."
            ),
        }
    if top and base > 0 and top["amount"] > base * 0.35:
        cap = round(top["amount"] * multiplier * 0.8, 2)
        return {
            "title": f"High Spending on {top['name']}",
            "suggestion": f"{top['name']} is your biggest expense at {peso(top['amount'])}, so aim to cut it by 15% next week.",
            "advice": (
                f"Based on your {d['saving_attitude']} saving attitude, keep {top['name']} under {peso(cap)} for the rest of this month. "
                "Plan those purchases ahead so your goal stays funded."
            ),
        }
    if goal and goal["remaining"] > 0:
        weekly = round(goal["remaining"] / 4 * multiplier, 2)
        return {
            "title": f"Goal Progress: {goal['name']}",
            "suggestion": f"{goal['name']} still needs {peso(goal['remaining'])} to reach its target.",
            "advice": (
                f"Move {peso(weekly)} into {goal['name']} each week to stay on track. "
                "Do it right after you receive money so it never feels like spending."
            ),
        }
    room = max(0.0, d["active_wallet_balance"] - spent)
    return {
        "title": "Monthly Budget Check",
        "suggestion": "Keep your current spending discipline to protect your wallet buffer.",
        "advice": (
            f"You have {peso(room)} of room left in your active wallet. "
            "Set aside at least 15% of it as savings before any discretionary purchase."
        ),
    }


def offline_chat_answer(snapshot: Snapshot) -> str:
    d = snapshot.data
    base = snapshot.spending_base
    share = f" ({round(d['spent_this_month'] / base * 100)}% of your budget)" if base > 0 else ""
    lines = [
        "Buck's AI Advisor is unavailable right now, so here is a summary straight from your numbers:",
        "",
        f"- You have spent **{peso(d['spent_this_month'])}** this month{share}.",
    ]
    top = (d["top_categories_this_month"] or [None])[0]
    if top:
        lines.append(f"- Your biggest category is **{top['name']}** at **{peso(top['amount'])}**.")
    lines.append(
        f"- At **{peso(d['average_daily_spending'])}** a day, you will spend about **{peso(d['projected_month_spending'])}** by month-end."
    )
    if d["active_goal"]:
        lines.append(f"- **{d['active_goal']['name']}** still needs **{peso(d['active_goal']['remaining'])}**.")
    lines += ["", rule_insight(snapshot)["suggestion"], "", "Try again in a minute for a full answer."]
    return "\n".join(lines)
