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
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone
from typing import Any

from shared import gemini
from shared.config import get_settings
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
FIRST_TEXT_TIMEOUT = 20.0
IDLE_TIMEOUT = 15.0

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


async def _write_with_gemini(snapshot: Snapshot, previous: dict[str, Any] | None,
                             changed: list[str], priority: str) -> dict[str, str]:
    out = await gemini.generate_json(
        prompts.insight_system_prompt(),
        prompts.insight_prompt(snapshot.data, _public(previous), changed, priority),
        prompts.INSIGHT_SCHEMA,
    )
    text = {
        "title": clean_text(out.get("title"), 80),
        "suggestion": limit_sentences(clean_text(out.get("suggestion"), 300), 1),
        "advice": limit_sentences(clean_text(out.get("advice"), 600), 2),
        "focus": out.get("focus") if out.get("focus") in ("spending", "category", "goal", "income", "buffer") else None,
    }
    if not (text["title"] and text["suggestion"] and text["advice"]):
        raise gemini.GeminiUnavailable("Incomplete advisory.")
    return text


async def get_insight(db: UserDb, refresh: bool = False) -> dict[str, Any]:
    snapshot = await build_snapshot(db)
    parts, fp = fingerprint_parts(snapshot), fingerprint(snapshot)
    latest = await latest_saved(db)
    now = datetime.now(timezone.utc)
    gemini_on = get_settings().gemini_configured

    if latest:
        meta = latest.get("metadata") or {}
        same_data = meta.get("fingerprint") == fp
        still_valid = _parse_ts(latest.get("valid_until")) > now
        age = now - _parse_ts(latest.get("created_at"))
        # Rule-based advice is upgraded to Gemini advice once Gemini is available.
        good_enough = meta.get("generated_with") == "gemini" or not gemini_on
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
        text = await _write_with_gemini(snapshot, latest, changed, priority)
        # The model that actually answered (a fallback when the primary is busy).
        generated_with, model_name = "gemini", gemini.answered_by.get() or get_settings().gemini_model
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

async def goal_tip(db: UserDb, goal: dict[str, Any]) -> str:
    """Two-sentence tip for a saved goal (`goal_id`) or one being created.
    Empty string when Gemini is unavailable; callers treat tips as optional."""
    today = today_ph()
    if goal.get("goal_id"):
        rows = await db.select("goals", {"select": "goal_name,target_amount,current_amount,target_date,attitude",
                                         "user_id": f"eq.{db.user_id}", "id": f"eq.{goal['goal_id']}", "limit": "1"})
        if not rows:
            raise LookupError("Goal not found.")
        r = rows[0]
        goal = {"name": r.get("goal_name"), "target_amount": r.get("target_amount"),
                "saved_amount": r.get("current_amount"), "target_date": r.get("target_date"),
                "attitude": r.get("attitude")}
    target, saved = money(goal.get("target_amount")), money(goal.get("saved_amount"))
    target_date = str(goal["target_date"])[:10] if goal.get("target_date") else None
    try:
        days_left = (datetime.fromisoformat(target_date).date() - today).days if target_date else None
    except ValueError:
        days_left = None
    data = {
        "goal": clean_text(goal.get("name"), 80) or "Goal",
        "target_amount": target,
        "remaining_amount": round(max(0.0, target - saved), 2),
        "saving_attitude": goal.get("attitude") if goal.get("attitude") in ATTITUDES else "Normal",
        "days_left": days_left,
        "today": today.isoformat(),
    }
    try:
        out = await gemini.generate_json(prompts.insight_system_prompt(), prompts.goal_tip_prompt(data),
                                         prompts.GOAL_TIP_SCHEMA)
        return limit_sentences(clean_text(out.get("tip"), 400), 2)
    except gemini.GeminiUnavailable as exc:
        log.warning("Advisor goal tip unavailable: %s", exc)
        return ""


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
            log.warning("Advisor chat failed: %s", exc)
            failed = True
        finally:
            await stream.aclose()

    if not sent_text:
        yield _event({"type": "meta", "source": "fallback"})
        yield _event({"type": "delta", "text": offline_chat_answer(snapshot)})
    elif failed:
        yield _event({"type": "error", "message": "The answer was cut short.", "retryable": True})
    yield _event({"type": "done"})
