"""AI Financial Advisor: saved, self-updating advice plus chat and goal tips.

Advice lifecycle (the database is the source of truth):
1. Build a fresh snapshot of the user's money and its fingerprint.
2. If the latest saved advisory has the same fingerprint and is still valid,
   return it from the database. No Gemini call.
3. If the data moved materially (or the user asks to refresh), generate new
   advice with Gemini, telling it what the previous advice was and what
   changed, and save it as a new row. Old rows stay as history.
4. Cooldowns stop rapid data edits or refresh taps from burning free quota;
   during a cooldown the saved advice is returned marked `stale`.
"""

import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator
from datetime import date, datetime, timedelta, timezone
from typing import Any

from shared import gemini, groq
from shared.attitude import day_label, detect_attitude, goal_plan, load_inputs, save_detected
from shared.config import get_settings
from shared.money import peso
from shared.safety import clean_text, limit_sentences
from shared.supabase import DbError, UserDb

from . import prompts
from .fingerprint import changed_facts, fingerprint, fingerprint_parts
from .rules import offline_chat_answer, priority_for, rule_insight
from .snapshot import ATTITUDES, Snapshot, build_snapshot, money, today_ph
from .tools import advisor_tools

log = logging.getLogger("buck_ai.advisor")

ADVISORY_TYPE = "monthly_strategy"
VALID_FOR = timedelta(days=7)
DATA_CHANGE_COOLDOWN = timedelta(minutes=5)
REFRESH_COOLDOWN = timedelta(seconds=60)
# Covers a tool round plus walking past a few busy models (8 s cap each).
FIRST_TEXT_TIMEOUT = 30.0
IDLE_TIMEOUT = 15.0

# The advice card is long and not streamed: one Gemini model needs more than
# the 8 s default to write it, and its thinking counts against the tokens.
INSIGHT_TIMEOUT = 20
INSIGHT_ATTEMPT = 10
INSIGHT_TOKENS = 4096
# Groq stands in when Gemini is busy, before the rule-written card.
INSIGHT_GROQ_TIMEOUT = 10
# The model that wrote the user's last card goes first if the card is this
# recent: a new server instance can't know which models are hung right now.
# Cards are rewritten only when the data moves, so this spans days; a model
# that has gone bad since costs only the usual race delay.
PREFER_RECENT_MODEL = timedelta(days=3)

_SAVED_COLUMNS = "id,title,suggestion,advice,financial_health_score,priority,metadata,created_at,valid_until,model_name"


def _parse_ts(value: Any) -> datetime:
    try:
        ts = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


async def latest_saved(db: UserDb) -> dict[str, Any] | None:
    rows = await db.select("ai_advisories", {
        "select": _SAVED_COLUMNS, "user_id": f"eq.{db.user_id}",
        "advisory_type": f"eq.{ADVISORY_TYPE}", "is_dismissed": "eq.false",
        "order": "created_at.desc", "limit": "1",
    })
    return rows[0] if rows else None


async def saved_history(db: UserDb, limit: int) -> list[dict[str, Any]]:
    rows = await db.select("ai_advisories", {
        "select": _SAVED_COLUMNS, "user_id": f"eq.{db.user_id}",
        "advisory_type": f"eq.{ADVISORY_TYPE}",
        "order": "created_at.desc", "limit": str(limit),
    })
    return [to_response(r, cached=True) for r in rows]


def to_response(row: dict[str, Any], *, cached: bool, stale: bool = False) -> dict[str, Any]:
    meta = row.get("metadata") or {}
    return {
        "id": row.get("id"),
        "title": row.get("title"),
        "suggestion": row.get("suggestion"),
        "advice": row.get("advice"),
        "financialHealthScore": row.get("financial_health_score"),
        "priority": row.get("priority"),
        "focus": meta.get("focus"),
        "walletAdvice": meta.get("wallet_advice"),
        # The window the numbers describe, e.g. {"monthStart": "2026-10-01", "asOf": "2026-10-16"}.
        "period": meta.get("period"),
        "changed": meta.get("changed", []),
        "generatedWith": meta.get("generated_with", "rules"),
        "createdAt": row.get("created_at"),
        "cached": cached,
        "stale": stale,
    }


def _public(row: dict[str, Any] | None) -> dict[str, Any] | None:
    """The part of a saved advisory that is shown back to Gemini."""
    if not row:
        return None
    return {"title": row.get("title"), "suggestion": row.get("suggestion"), "advice": row.get("advice"),
            "saved_on": str(row.get("created_at"))[:10]}


def _tidy_insight(out: dict[str, Any]) -> dict[str, Any] | None:
    text = {
        "title": clean_text(out.get("title"), 80),
        "suggestion": limit_sentences(clean_text(out.get("suggestion"), 300), 1),
        "advice": limit_sentences(clean_text(out.get("advice"), 1200), 5),
        "wallet_advice": limit_sentences(clean_text(out.get("wallet_advice"), 400), 2),
        "focus": out.get("focus") if out.get("focus") in ("spending", "category", "goal", "income", "buffer") else None,
    }
    return text if text["title"] and text["suggestion"] and text["advice"] else None


async def _write_with_ai(snapshot: Snapshot, previous: dict[str, Any] | None,
                         changed: list[str], priority: str,
                         prefer: str | None = None) -> tuple[dict[str, Any], str, str]:
    """(text, generated_with, model_name): Gemini first, then Groq.
    Raises GeminiUnavailable when neither wrote a usable card."""
    system = prompts.insight_system_prompt()
    prompt = prompts.insight_prompt(snapshot.data, _public(previous), changed, priority)
    try:
        out = await gemini.generate_json(system, prompt, prompts.INSIGHT_SCHEMA, timeout_seconds=INSIGHT_TIMEOUT,
                                         attempt_seconds=INSIGHT_ATTEMPT, max_output_tokens=INSIGHT_TOKENS,
                                         prefer=prefer)
        text = _tidy_insight(out)
        if text:
            return text, "gemini", gemini.answered_by.get() or get_settings().gemini_model
        reason = "Incomplete advisory."
    except gemini.GeminiUnavailable as exc:
        reason = str(exc)
    if not get_settings().groq_configured:
        raise gemini.GeminiUnavailable(reason)
    log.info("Advisor insight trying Groq after Gemini: %s", reason)
    try:
        out = await groq.generate_json(system, prompt, prompts.INSIGHT_SCHEMA_STRICT,
                                       timeout_seconds=INSIGHT_GROQ_TIMEOUT)
    except groq.GroqUnavailable as exc:
        raise gemini.GeminiUnavailable(f"{reason}; Groq: {exc}") from exc
    text = _tidy_insight(out)
    if not text:
        raise gemini.GeminiUnavailable(f"{reason}; Groq: incomplete advisory.")
    return text, "groq", groq.answered_by.get() or get_settings().groq_models[0]


def _recent_model(saved: dict[str, Any] | None, now: datetime) -> str | None:
    """The model that wrote the saved card, if recent: it likely answers again, so it goes first."""
    if saved and now - _parse_ts(saved.get("created_at")) < PREFER_RECENT_MODEL:
        return saved.get("model_name")
    return None


async def get_insight(db: UserDb, refresh: bool = False) -> dict[str, Any]:
    snapshot = await build_snapshot(db)
    parts, fp = fingerprint_parts(snapshot), fingerprint(snapshot)
    # Keep the active goal's saved attitude current (writes only on a change).
    latest, _ = await asyncio.gather(
        latest_saved(db),
        save_detected(db, snapshot.refs.get("goal_id"), snapshot.attitude, snapshot.goal_row),
    )
    now = datetime.now(timezone.utc)
    ai_on = get_settings().gemini_configured or get_settings().groq_configured

    if latest:
        meta = latest.get("metadata") or {}
        same_data = meta.get("fingerprint") == fp
        still_valid = _parse_ts(latest.get("valid_until")) > now
        age = now - _parse_ts(latest.get("created_at"))
        # Rule-based advice is upgraded to AI advice once an AI is available.
        good_enough = meta.get("generated_with") in ("gemini", "groq") or not ai_on
        if not refresh and same_data and still_valid and (good_enough or age < DATA_CHANGE_COOLDOWN):
            return to_response(latest, cached=True)
        if age < (REFRESH_COOLDOWN if refresh else DATA_CHANGE_COOLDOWN):
            return to_response(latest, cached=True, stale=not same_data)
    else:
        meta, same_data = {}, False

    changed = changed_facts(meta.get("fingerprint_parts"), parts) if latest else []
    priority = priority_for(snapshot)
    generated_with, model_name = "rules", "rules"
    try:
        # model_name is the model that actually answered (a fallback when the primary is busy).
        text, generated_with, model_name = await _write_with_ai(snapshot, latest, changed, priority,
                                                                _recent_model(latest, now))
    except gemini.GeminiUnavailable as exc:
        log.warning("Advisor insight fell back to rules: %s", exc)
        if latest and same_data:
            return to_response(latest, cached=True)  # never replace good advice with rules for the same data
        text = {**rule_insight(snapshot), "focus": None}

    row = {
        "user_id": db.user_id,
        "goal_id": snapshot.refs.get("goal_id"),
        "wallet_id": snapshot.refs.get("wallet_id"),
        "advisory_type": ADVISORY_TYPE,
        "title": text["title"],
        "suggestion": text["suggestion"],
        "advice": text["advice"],
        "financial_health_score": snapshot.data["financial_health_score"],
        "priority": priority,
        "model_name": model_name,
        "generated_by": "on_demand",
        "valid_until": (now + VALID_FOR).isoformat(),
        "metadata": {
            "fingerprint": fp,
            "fingerprint_parts": parts,
            "generated_with": generated_with,
            "focus": text.get("focus"),
            "wallet_advice": text.get("wallet_advice"),
            "period": {"monthStart": snapshot.data["month"]["start"], "asOf": snapshot.data["today"]},
            "changed": changed,
            "spent_this_month": snapshot.data["spent_this_month"],
            "spending_base": snapshot.spending_base,
        },
    }
    try:
        saved = await db.insert("ai_advisories", row)
    except DbError as exc:
        log.warning("Could not save advisory: %s", exc)
        saved = {**row, "id": None, "created_at": now.isoformat()}
    return to_response(saved or row, cached=False)


# ---------------------------------------------------------------- goal tips

_PESO_FIGURE = re.compile(r"₱\s?(\d[\d,]*(?:\.\d+)?)")


def _figures_ok(tip: str, allowed: set[float]) -> bool:
    """True when the tip quotes at least one ₱ figure and every one is a plan figure."""
    found = [float(m.replace(",", "")) for m in _PESO_FIGURE.findall(tip)]
    return bool(found) and all(any(abs(x - a) < 0.01 for a in allowed) for x in found)


def _date_label(value: str | None) -> str | None:
    try:
        return day_label(date.fromisoformat(value)) if value else None
    except ValueError:
        return None


def _peso_format(tip: str) -> str:
    """Write every ₱ figure as ₱1,234.56 (models sometimes drop a decimal: ₱15,600.0)."""
    return _PESO_FIGURE.sub(lambda m: peso(float(m.group(1).replace(",", ""))), tip)


def _plan_figures(data: dict[str, Any]) -> set[float]:
    plan = data.get("plan") or {}
    figures = {data["target_amount"], data["remaining_amount"]}
    for key in ("save", "spendingLimit"):
        figures.update((plan.get(key) or {}).values())
    return figures


def _tip_plan(plan: dict[str, Any]) -> dict[str, Any]:
    """What the tip may quote. `save` is the pace the goal needs (`required`, the
    page's "Save per day") when the user can afford it; otherwise the most they
    can save (`saving`), and the date is tight. Never the full spare income:
    saving ₱52,073.40 a month toward an ₱11,160 remainder is not a plan."""
    reaches = bool(plan.get("reachesByTargetDate"))
    return {
        "save": plan["required"] if reaches else plan["saving"],
        "spendingLimit": plan["spending"],
        "reachesByTargetDate": reaches,
        "daysToGoalAtThisPace": None if reaches else plan.get("daysToGoal"),
    }


def rule_goal_tip(data: dict[str, Any]) -> str:
    """Two sentences built only from the plan, for when no model can write the tip."""
    plan = data.get("plan")
    if not plan:
        return ""
    save, spend = plan["save"], plan["spendingLimit"]
    first = (f"Save {peso(save['perWeek'])} a week ({peso(save['perDay'])} a day) by keeping spending "
             f"under {peso(spend['perDay'])} a day.")
    if plan["reachesByTargetDate"]:
        second = f"That pace reaches {data['goal']} by {data['target_date']}."
    elif plan.get("daysToGoalAtThisPace"):
        second = (f"At that pace {data['goal']} takes about {plan['daysToGoalAtThisPace']} days, so a later "
                  "target date or a smaller target would fit better.")
    else:
        second = "Log your income so Buck can see how much is left to save."
    return f"{first} {second}"


async def goal_tip(db: UserDb, goal: dict[str, Any]) -> dict[str, str]:
    """Two-sentence tip for a saved goal (`goal_id`) or one being created.

    Every ₱ figure comes from the goal plan (`shared/attitude.goal_plan`), the
    same numbers the Goals page and the Forecaster show. Gemini (then Groq)
    only words it; an answer that quotes any other ₱ figure is thrown away.
    When no model gives a valid tip, the rule-written tip is returned
    (`source: "rules"`) and not stored, so a later visit asks the AI again.
    An AI tip for a saved goal is stored on it (`goals.ai_recommendation`), so
    the page shows it at once and a new goal never waits for Gemini."""
    today = today_ph()
    goal_id = goal.get("goal_id")
    r: dict[str, Any] | None = None
    if goal_id:
        rows = await db.select("goals", {"select": "goal_name,target_amount,current_amount,target_date,attitude,"
                                                   "attitude_basis",
                                         "user_id": f"eq.{db.user_id}", "id": f"eq.{goal['goal_id']}", "deleted_at": "is.null", "limit": "1"})
        if not rows:
            raise LookupError("Goal not found.")
        r = rows[0]
        goal = {"name": r.get("goal_name"), "target_amount": r.get("target_amount"),
                "saved_amount": r.get("current_amount"), "target_date": r.get("target_date"),
                "attitude": r.get("attitude")}
    target, saved = money(goal.get("target_amount")), money(goal.get("saved_amount"))
    remaining = round(max(0.0, target - saved), 2)
    target_date = str(goal["target_date"])[:10] if goal.get("target_date") else None
    attitude = goal.get("attitude") if goal.get("attitude") in ATTITUDES else None
    inputs = await load_inputs(db, today)
    detection = detect_attitude(typical_daily=inputs["typical_daily"], income_daily=inputs["income_daily"],
                                remaining=remaining, target_date=target_date, today=today, current=attitude,
                                spending_until=inputs.get("spending_until"))
    if goal_id:
        # The tip quotes this plan, so the goal shows the same attitude (written only on a change).
        await save_detected(db, goal_id, detection, r)
    plan = goal_plan(detection)
    data = {
        "goal": clean_text(goal.get("name"), 80) or "Goal",
        "target_amount": target,
        "remaining_amount": remaining,
        "saving_attitude": detection["attitude"],
        "days_left": detection["daysLeft"],
        "today": day_label(today),
        "target_date": _date_label(target_date),
        "plan": plan and _tip_plan(plan),
    }
    if not plan:  # reached, date passed or no spending logged: the reason already says it
        return {"tip": detection["reason"], "source": "rules"}

    allowed = _plan_figures(data)
    tip, source = "", "rules"
    system, prompt = prompts.insight_system_prompt(), prompts.goal_tip_prompt(data)
    writers = [("ai", lambda: gemini.generate_json(system, prompt, prompts.GOAL_TIP_SCHEMA))]
    if get_settings().groq_configured:
        writers.append(("groq", lambda: groq.generate_json(system, prompt, prompts.GOAL_TIP_SCHEMA_STRICT,
                                                           timeout_seconds=INSIGHT_GROQ_TIMEOUT)))
    for name, write in writers:
        try:
            out = await write()
        except (gemini.GeminiUnavailable, groq.GroqUnavailable) as exc:
            log.warning("Goal tip from %s unavailable: %s", name, exc)
            continue
        text = limit_sentences(clean_text(out.get("tip"), 400), 2)
        if _figures_ok(text, allowed):
            tip, source = _peso_format(text), name
            break
        log.warning("Goal tip from %s quoted figures outside the plan; discarded.", name)
    if not tip:
        return {"tip": rule_goal_tip(data), "source": "rules"}
    if goal_id:
        try:
            await db.update("goals", {"id": f"eq.{goal_id}", "user_id": f"eq.{db.user_id}",
                                      "deleted_at": "is.null"}, {"ai_recommendation": tip})
        except DbError as exc:  # the tip is still returned; saving it is best effort
            log.warning("Could not save the goal tip: %s", exc)
    return {"tip": tip, "source": source}


# --------------------------------------------------------- saving attitude

async def goal_attitude(db: UserDb, goal: dict[str, Any]) -> dict[str, Any]:
    """The saving attitude a goal needs, with the plan it implies.

    `{"goal_id"}`: a saved goal. The attitude is detected and saved on it.
    `{"target_amount", "saved_amount", "target_date"}`: a goal being created
    (nothing is saved; the web stores the attitude with the new goal).
    """
    today = today_ph()
    current = None
    goal_id = goal.get("goal_id")
    if goal_id:
        rows = await db.select("goals", {"select": "id,target_amount,current_amount,target_date,attitude,"
                                                   "attitude_basis,completed",
                                         "user_id": f"eq.{db.user_id}", "id": f"eq.{goal_id}", "deleted_at": "is.null", "limit": "1"})
        if not rows:
            raise LookupError("Goal not found.")
        r = rows[0]
        goal = {"target_amount": r.get("target_amount"), "saved_amount": r.get("current_amount"),
                "target_date": r.get("target_date")}
        current = r.get("attitude") if r.get("attitude") in ATTITUDES else None
    inputs = await load_inputs(db, today)
    remaining = max(0.0, money(goal.get("target_amount")) - money(goal.get("saved_amount")))
    target_date = str(goal["target_date"])[:10] if goal.get("target_date") else None
    detection = detect_attitude(typical_daily=inputs["typical_daily"], income_daily=inputs["income_daily"],
                                remaining=remaining, target_date=target_date, today=today, current=current,
                                spending_until=inputs.get("spending_until"))
    if goal_id:
        await save_detected(db, goal_id, detection, r)
    return {**detection, "goalId": goal_id, "plan": goal_plan(detection),
            "window": {"spendingDays": inputs["spend_days"], "incomeDays": inputs["income_days"]}}


# --------------------------------------------------------------------- chat

def _event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def chat_events(db: UserDb, question: str, history: list[dict[str, str]]) -> AsyncIterator[str]:
    """Server-Sent Events: `meta` (source ai|fallback), `delta`, `error`, `done`.

    Grounded on the live snapshot and the advice saved in the database, so the
    chat and the advisory card never contradict each other.
    """
    try:
        snapshot = await build_snapshot(db)
        saved = await latest_saved(db)
    except DbError:
        yield _event({"type": "error", "message": "Could not read your data right now. Try again shortly.", "retryable": True})
        yield _event({"type": "done"})
        return

    sent_text, failed = False, False
    if get_settings().gemini_configured:
        stream = gemini.stream_with_tools(
            prompts.chat_system_prompt(snapshot.data, _public(saved)),
            gemini.history_contents(history, question),
            advisor_tools(db),
            prefer=_recent_model(saved, datetime.now(timezone.utc)),
        )
        try:
            while True:
                try:
                    text = await asyncio.wait_for(stream.__anext__(), IDLE_TIMEOUT if sent_text else FIRST_TEXT_TIMEOUT)
                except StopAsyncIteration:
                    break
                if not sent_text:
                    yield _event({"type": "meta", "source": "ai"})
                sent_text = True
                yield _event({"type": "delta", "text": text})
        except (gemini.GeminiUnavailable, asyncio.TimeoutError) as exc:
            log.warning("Advisor chat failed: %s", str(exc) or type(exc).__name__)
            failed = True
        finally:
            await stream.aclose()

    if not sent_text:
        yield _event({"type": "meta", "source": "fallback"})
        yield _event({"type": "delta", "text": offline_chat_answer(snapshot)})
    elif failed:
        yield _event({"type": "error", "message": "The answer was cut short.", "retryable": True})
    yield _event({"type": "done"})
