"""HTTP API of the AI Forecaster (same for web and mobile).

All routes require `Authorization: Bearer <Supabase access token>`.

GET  /forecast?horizon=30                        numbers now; saved or rule-written explanation
POST /forecast/explain?horizon=30&refresh=false  Gemini explanation, saved (call when explanationPending)
GET  /forecast/history?limit=10                  previously saved forecasts, newest first
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from shared import rate_limit
from shared.auth import AuthUser, current_user
from shared.supabase import DbError, UserDb

from . import service
from .forecast import HORIZONS

router = APIRouter(prefix="/forecast", tags=["AI Forecaster"])


def _db(user: AuthUser) -> UserDb:
    return UserDb(user.id, user.token)


def _unavailable() -> HTTPException:
    return HTTPException(503, "Could not read your data right now. Try again shortly.")


def _check(horizon: int) -> None:
    if horizon not in HORIZONS:
        raise HTTPException(422, "horizon must be 30 or 60.")


@router.get("")
async def forecast(horizon: int = 30, user: AuthUser = Depends(current_user)):
    _check(horizon)
    await rate_limit.enforce(_db(user), "forecast")
    try:
        return await service.get_forecast(_db(user), horizon=horizon)
    except DbError:
        raise _unavailable()


@router.post("/explain")
async def explain(horizon: int = 30, refresh: bool = False, user: AuthUser = Depends(current_user)):
    _check(horizon)
    await rate_limit.enforce(_db(user), "forecast")
    try:
        return await service.explain(_db(user), horizon=horizon, refresh=refresh)
    except DbError:
        raise _unavailable()


@router.get("/history")
async def history(limit: int = Query(10, ge=1, le=20), user: AuthUser = Depends(current_user)):
    try:
        return await service.saved_history(_db(user), limit)
    except DbError:
        raise _unavailable()
