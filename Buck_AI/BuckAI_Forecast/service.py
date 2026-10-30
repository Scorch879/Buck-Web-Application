"""AI Forecaster: per-user forecast plus a Gemini explanation, saved in ai_forecasts.

Two steps, so the numbers never wait for Gemini:
1. `get_forecast` (GET /forecast) loads 180 days of history as the user, fits
   the model and returns the numbers in well under a second. It reuses the
   saved explanation when the latest row for this horizon has the same
   fingerprint and has not expired (PH midnight); otherwise it returns a
   rule-written one with `explanationPending: true`. It never writes.
2. `explain` (POST /forecast/explain) writes the explanation with Gemini
   (rule-written when Gemini is unavailable) and saves a row. Cooldowns stop
   rapid edits or refresh taps from burning the free quota; during one, the
   saved explanation is returned marked `stale`.
"""

import hashlib
import json
import logging
import re
from datetime import datetime, time, timedelta, timezone
from typing import Any

from shared import gemini
from shared.config import get_settings
from shared.money import PH_TZ, peso
from shared.safety import clean_text, limit_sentences
from shared.supabase import DbError, UserDb

from . import prompts
from .forecast import ai_view, build_forecast
from .history import load_history

log = logging.getLogger("buck_ai.forecast")

PERIOD_TYPE = "custom"
DATA_CHANGE_COOLDOWN = timedelta(minutes=5)
REFRESH_COOLDOWN = timedelta(seconds=60)
# POST /explain runs while the numbers are already on screen, so it can wait.
# A full card takes ~10-15 s unstreamed: give each model 20 s, 45 s in total.
NARRATIVE_TIMEOUT = 45.0
NARRATIVE_ATTEMPT = 20.0
_COLUMNS = "id,summary,warnings,metadata,created_at,expires_at,model_name"


def _parse_ts(value: Any) -> datetime:
    try:
        ts = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def fingerprint(view: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(view, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


async def latest_saved(db: UserDb, horizon: int) -> dict[str, Any] | None:
    rows = await db.select("ai_forecasts", {
        "select": _COLUMNS, "user_id": f"eq.{db.user_id}", "period_type": f"eq.{PERIOD_TYPE}",
        "metadata->>horizon": f"eq.{horizon}", "order": "created_at.desc", "limit": "1",
    })
    return rows[0] if rows else None


async def saved_history(db: UserDb, limit: int) -> list[dict[str, Any]]:
    rows = await db.select("ai_forecasts", {
        "select": "id,summary,projected_spending,confidence_score,period_start,period_end,created_at,model_name",
        "user_id": f"eq.{db.user_id}", "period_type": f"eq.{PERIOD_TYPE}",
        "order": "created_at.desc", "limit": str(limit),
    })
    return [{"id": r.get("id"), "headline": r.get("summary"), "projectedSpending": r.get("projected_spending"),
             "confidence": r.get("confidence_score"), "periodStart": r.get("period_start"),
             "periodEnd": r.get("period_end"), "createdAt": r.get("created_at"),
             "generatedWith": "rules" if r.get("model_name") == "rules" else "gemini"} for r in rows]


def rule_narrative(f: dict[str, Any]) -> dict[str, Any]:
    total, month, model = f["total"], f["month"], f["model"]
    surplus = month["surplus"]["likely"]
    side = (f"leaving about {peso(surplus)} of your {month['surplusBasis']}" if surplus >= 0
            else f"about {peso(-surplus)} more than your {month['surplusBasis']}")
    top = " and ".join(c["name"] for c in f["categories"][:2])
    explanation = [
        f"This month is heading for about {peso(month['projectedTotal']['p50'])} in total, {side}.",
        f"Most of it goes to {top}." if top else "",
        f"The forecast is based on your last {model['windowDays']} days"
        + (" and is rough because there is little history yet." if model["lowData"] else "."),
        (f"Your {f['target']['attitude']} target is {peso(f['target']['dailyTarget'])} a day, against an "
         f"expected {peso(f['target']['expectedDaily'])}." if f["target"]["multiplier"] != 1 else ""),
    ]
    return {
        "headline": f"You're likely to spend {peso(total['p50'])} over the next {f['horizonDays']} days "
                    f"(between {peso(total['p10'])} and {peso(total['p90'])}).",
        "explanation": " ".join(s for s in explanation if s),
        "habitNotes": [h["text"] for h in f["habits"] if h["kind"] != "rhythm"][:3],
        "watchOut": f["warnings"][0] if f["warnings"] else "",
    }


_BARE_PESO = re.compile(r"₱(\d{4,}(?:\.\d{1,2})?)(?!\d)")


def _commas(text: str) -> str:
    """₱7066.56 -> ₱7,066.56 (the prompt asks for commas; the model sometimes forgets)."""
    return _BARE_PESO.sub(lambda m: peso(float(m.group(1))), text)


async def _gemini_narrative(f: dict[str, Any]) -> dict[str, Any]:
    out = await gemini.generate_json(prompts.system_prompt(), prompts.narrative_prompt(ai_view(f)),
                                     prompts.SCHEMA, timeout_seconds=NARRATIVE_TIMEOUT,
                                     attempt_seconds=NARRATIVE_ATTEMPT)
    notes = out.get("habit_notes") if isinstance(out.get("habit_notes"), list) else []
    text = {
        "headline": limit_sentences(clean_text(out.get("headline"), 300), 1),
        "explanation": limit_sentences(clean_text(out.get("explanation"), 1200), 4),
        "habitNotes": [n for n in (limit_sentences(clean_text(x, 240), 1) for x in notes[:3]) if n],
        "watchOut": limit_sentences(clean_text(out.get("watch_out"), 300), 1),
    }
    if not (text["headline"] and text["explanation"]):
        raise gemini.GeminiUnavailable("Incomplete forecast explanation.")
    text = {k: [_commas(n) for n in v] if isinstance(v, list) else _commas(v) for k, v in text.items()}
    return text


def _response(f: dict[str, Any], row: dict[str, Any] | None, *, narrative: dict[str, Any] | None = None,
              cached: bool, stale: bool = False, pending: bool = False) -> dict[str, Any]:
    meta = (row or {}).get("metadata") or {}
    return {
        "id": (row or {}).get("id"),
        "forecast": f,
        "narrative": narrative or meta.get("narrative") or rule_narrative(f),
        "generatedWith": "rules" if narrative is not None else meta.get("generated_with", "rules"),
        "explanationPending": pending,
        "createdAt": (row or {}).get("created_at"),
        "cached": cached,
        "stale": stale,
    }


def _next_ph_midnight(now: datetime) -> datetime:
    tomorrow = now.astimezone(PH_TZ).date() + timedelta(days=1)
    return datetime.combine(tomorrow, time(0), tzinfo=PH_TZ)


async def _compute(db: UserDb, horizon: int):
    history, refs = await load_history(db)
    f = build_forecast(history, horizon)
    return f, refs, fingerprint(ai_view(f)), await latest_saved(db, f["horizonDays"])


def _state(latest: dict[str, Any] | None, fp: str, now: datetime) -> tuple[bool, bool, timedelta | None]:
    """(saved row is current, saved row has the same data, age of the saved row)."""
    if not latest:
        return False, False, None
    meta = latest.get("metadata") or {}
    same = meta.get("fingerprint") == fp
    current = (same and _parse_ts(latest.get("expires_at")) > now
               and (meta.get("generated_with") == "gemini" or not get_settings().gemini_configured))
    return current, same, now - _parse_ts(latest.get("created_at"))


def _cooling(latest: dict[str, Any] | None, age: timedelta | None, limit: timedelta) -> bool:
    return bool(latest and age is not None and age < limit and (latest.get("metadata") or {}).get("narrative"))


async def get_forecast(db: UserDb, horizon: int = 30) -> dict[str, Any]:
    f, _, fp, latest = await _compute(db, horizon)
    current, same, age = _state(latest, fp, datetime.now(timezone.utc))
    if current:
        return _response(f, latest, cached=True)
    if _cooling(latest, age, DATA_CHANGE_COOLDOWN):
        return _response(f, latest, cached=True, stale=not same)  # explain would only hit the cooldown
    return _response(f, None, narrative=rule_narrative(f), cached=False, pending=True)


async def explain(db: UserDb, horizon: int = 30, refresh: bool = False) -> dict[str, Any]:
    f, refs, fp, latest = await _compute(db, horizon)
    now = datetime.now(timezone.utc)
    current, same, age = _state(latest, fp, now)
    if current and not refresh:
        return _response(f, latest, cached=True)
    if _cooling(latest, age, REFRESH_COOLDOWN if refresh else DATA_CHANGE_COOLDOWN):
        return _response(f, latest, cached=True, stale=not same)

    generated_with, model_name = "rules", "rules"
    try:
        if not get_settings().gemini_configured:
            raise gemini.GeminiUnavailable("GEMINI_API_KEY is not configured.")
        narrative = await _gemini_narrative(f)
        generated_with, model_name = "gemini", gemini.answered_by.get() or get_settings().gemini_model
    except gemini.GeminiUnavailable as exc:
        log.warning("Forecast explanation fell back to rules: %s", exc)
        narrative = rule_narrative(f)

    days = f["days"]
    row = {
        "user_id": db.user_id,
        "goal_id": refs.get("goal_id"),
        "wallet_id": refs.get("wallet_id"),
        "period_type": PERIOD_TYPE,
        "period_start": days[0]["date"],
        "period_end": days[-1]["date"],
        "projected_spending": f["total"]["p50"],
        "projected_savings": max(0.0, f["month"]["surplus"]["likely"]),
        "ai_recommended_budget": round(f["target"]["dailyTarget"] * f["horizonDays"], 2),
        "actual_spending_snapshot": f["month"]["spentSoFar"],
        "daily_forecast": {d["date"]: {k: d[k] for k in ("p10", "p50", "p90", "expected")} for d in days},
        "summary": narrative["headline"],
        "warnings": f["warnings"],
        "confidence_score": f["model"]["confidence"],
        "model_name": model_name,
        "generated_by": "on_demand",
        "expires_at": _next_ph_midnight(now).isoformat(),
        "metadata": {"horizon": f["horizonDays"], "fingerprint": fp, "generated_with": generated_with,
                     "narrative": narrative, "forecast": f},
    }
    try:
        saved = await db.insert("ai_forecasts", row)
    except DbError as exc:
        log.warning("Could not save forecast: %s", exc)
        saved = {}
    stored = saved or {**row, "id": None, "created_at": now.isoformat()}
    stored.setdefault("metadata", row["metadata"])
    return _response(f, stored, cached=False)
