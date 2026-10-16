"""Deterministic advice used when Gemini is unavailable (no key, error, or
free quota exhausted). Every number comes straight from the snapshot, so the
fallback is always accurate, just less personal."""

from .snapshot import Snapshot

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


def wallet_advice(snapshot: Snapshot) -> str:
    """Which wallet to spend from and which to leave alone, from real names and balances."""
    wallets = snapshot.data.get("wallets") or []
    active = next((w for w in wallets if w["active"]), None)
    others = sorted((w for w in wallets if not w["active"]), key=lambda w: w["balance"], reverse=True)
    if not wallets:
        return "Add a wallet so Buck can track where your spending comes from."
    if not active:
        return "Pick an active wallet on the Wallet tab so day-to-day spending comes from one place."
    text = f"Spend day to day from {active['name']} ({peso(active['balance'])})."
    if others:
        keep = others[0]
        goal = snapshot.data.get("active_goal")
        purpose = f"your {goal['name']} goal" if goal else "an emergency buffer"
        text += f" Leave {keep['name']} ({peso(keep['balance'])}) untouched for {purpose}."
    return text


def rule_insight(snapshot: Snapshot) -> dict[str, str]:
    d = snapshot.data
    plan = d["plan"]
    base = snapshot.spending_base
    spent = d["spent_this_month"]
    ratio = spent / base if base > 0 else 0.5
    top = (d["top_categories_this_month"] or [None])[0]
    goal = d["active_goal"]
    pace = plan.get("goal_pace")
    cap = plan["daily_spending_cap"]["amount"]
    typical = plan["typical_daily_spending"]["amount"]
    month = f"this month so far ({d['month']['start']} to {d['today']})"
    spending_line = (
        f"You have spent {peso(spent)} {month}, and your last-30-day average is {peso(typical)} a day. "
        f"Your {d['saving_attitude']} saving attitude sets a daily cap of {peso(cap)}."
    )

    if ratio > 0.9:
        return {
            "title": "Budget Threshold Alert",
            "suggestion": f"Keep spending under {peso(cap)} a day this week and pause non-essential purchases.",
            "advice": (
                f"{spending_line} That is {round(ratio * 100)}% of your {peso(base)} budget {month}. "
                f"Hold {top['name'] if top else 'leisure'} spending until the month resets to avoid a deficit."
            ),
            "wallet_advice": wallet_advice(snapshot),
        }
    if goal and pace and pace["recommended_per_week"] > 0:
        weekly = pace["recommended_per_week"]
        if pace["on_track_by_target_date"]:
            pace_line = f"Saving {peso(weekly)} a week keeps {goal['name']} on track for {goal['target_date']}."
        else:
            weeks = pace["weeks_to_goal_at_recommended"]
            pace_line = (
                f"Finishing by {goal['target_date']} would need {peso(pace['required_per_week'] or 0)} a week, "
                f"more than you can spare, so {peso(weekly)} a week reaches it in about {weeks} weeks instead."
            )
        return {
            "title": f"Steady Pace: {goal['name']}"[:60],
            "suggestion": (
                f"Set aside {peso(weekly)} for {goal['name']} this week and keep daily spending near {peso(cap)}."
            ),
            "advice": f"{spending_line} {pace_line}",
            "wallet_advice": wallet_advice(snapshot),
        }
    if top and base > 0 and top["amount"] > base * 0.35:
        return {
            "title": f"High Spending on {top['name']}",
            "suggestion": f"Trim {top['name']} this week and keep daily spending near {peso(cap)}.",
            "advice": f"{spending_line} {top['name']} is your biggest category {month} at {peso(top['amount'])}.",
            "wallet_advice": wallet_advice(snapshot),
        }
    return {
        "title": "Monthly Budget Check",
        "suggestion": f"Keep daily spending near {peso(cap)} this week to protect your buffer.",
        "advice": spending_line,
        "wallet_advice": wallet_advice(snapshot),
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
