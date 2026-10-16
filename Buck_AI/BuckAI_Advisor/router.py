"""HTTP API of the AI Financial Advisor (same for web and mobile).

All routes require `Authorization: Bearer <Supabase access token>`.

GET  /advisor/insight?refresh=false  saved advice, regenerated when the data moved
GET  /advisor/history?limit=10       previously saved advice, newest first
POST /advisor/chat                   streaming chat (text/event-stream)
POST /advisor/goal-tip               two-sentence tip for a goal
POST /advisor/categorize             file descriptions under the user's own categories
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from shared import rate_limit
from shared.auth import AuthUser, current_user
from shared.safety import clean_text
from shared.supabase import DbError, UserDb

from . import categorize as categorizer
from . import service

router = APIRouter(prefix="/advisor", tags=["AI Financial Advisor"])


def _db(user: AuthUser) -> UserDb:
    return UserDb(user.id, user.token)


def _unavailable() -> HTTPException:
    return HTTPException(503, "Could not read your data right now. Try again shortly.")


@router.get("/insight")
async def insight(refresh: bool = False, user: AuthUser = Depends(current_user)):
    await rate_limit.enforce(_db(user), "insight")
    try:
        return await service.get_insight(_db(user), refresh=refresh)
    except DbError:
        raise _unavailable()


@router.get("/history")
async def history(limit: int = Query(10, ge=1, le=20), user: AuthUser = Depends(current_user)):
    try:
        return await service.saved_history(_db(user), limit)
    except DbError:
        raise _unavailable()


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1500)


class ChatInput(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)


@router.post("/chat")
async def chat(body: ChatInput, user: AuthUser = Depends(current_user)):
    await rate_limit.enforce(_db(user), "chat")
    question = clean_text(body.question, 500)
    if not question:
        raise HTTPException(422, "Ask a question first.")
    turns = [{"role": t.role, "content": clean_text(t.content, 1500)} for t in body.history]
    turns = [t for t in turns if t["content"]]
    while turns and turns[0]["role"] == "assistant":  # Gemini expects a user turn first
        turns.pop(0)
    return StreamingResponse(
        service.chat_events(_db(user), question, turns),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


class GoalTipInput(BaseModel):
    """Either `goalId` (a saved goal) or the fields of a goal being created."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    goal_id: str | None = Field(default=None, max_length=64)
    goal_name: str | None = Field(default=None, max_length=120)
    target_amount: float | None = Field(default=None, gt=0, le=1_000_000_000_000)
    attitude: Literal["Normal", "Moderate", "Aggressive"] = "Normal"
    target_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    @model_validator(mode="after")
    def _one_goal(self):
        if not self.goal_id and not (self.goal_name and self.target_amount):
            raise ValueError("Send goalId, or goalName and targetAmount.")
        return self


@router.post("/goal-tip")
async def goal_tip(body: GoalTipInput, user: AuthUser = Depends(current_user)):
    await rate_limit.enforce(_db(user), "tip")
    goal = (
        {"goal_id": body.goal_id}
        if body.goal_id
        else {"name": body.goal_name, "target_amount": body.target_amount, "saved_amount": 0,
              "attitude": body.attitude, "target_date": body.target_date}
    )
    try:
        return {"tip": await service.goal_tip(_db(user), goal)}
    except LookupError:
        raise HTTPException(404, "Goal not found.")
    except DbError:
        raise _unavailable()


class CategorizeInput(BaseModel):
    kind: Literal["expense", "income"]
    descriptions: list[str] = Field(min_length=1, max_length=categorizer.BATCH_MAX)


@router.post("/categorize")
async def categorize(body: CategorizeInput, user: AuthUser = Depends(current_user)):
    """`{ categories: (name | null)[] }` in input order. null means "no confident
    match" (or AI unavailable): leave the item in the fallback category."""
    await rate_limit.enforce(_db(user), "categorize")
    try:
        names = await categorizer.categorize(_db(user), body.kind, [d[:300] for d in body.descriptions])
    except DbError:
        raise _unavailable()
    return {"categories": names}
