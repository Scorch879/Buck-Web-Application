import logging
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ai_models import generate_ai_tip, get_expense_category
from auth import enforce_rate_limit

logger = logging.getLogger("buckai")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

allowed_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://bucktbt-dev.vercel.app"
)
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

# Auth is a bearer token, not a cookie, so credentialed CORS is not needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
MAX_FORECAST_DAYS = 3650
MAX_FORECAST_EXPENSES = 2000

Attitude = Literal["Normal", "Moderate", "Aggressive"]


class GoalInput(BaseModel):
    goal_name: str = Field(min_length=1, max_length=120)
    target_amount: float = Field(ge=0, le=1_000_000_000_000)
    attitude: Attitude
    target_date: str = Field(pattern=DATE_PATTERN)  # 'YYYY-MM-DD'


class TipInput(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    user_context: Optional[str] = Field(default="", max_length=1000)
    target_date: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    created_at: Optional[str] = Field(default=None, pattern=DATE_PATTERN)


class ForecastExpense(BaseModel):
    date: str = Field(pattern=DATE_PATTERN)
    amount: float = Field(ge=0, le=1_000_000_000_000)


class ForecastInput(BaseModel):
    goal: Dict[str, Any]
    budget: float = Field(default=0, ge=0, le=1_000_000_000_000)
    # Spent-to-date comes from the caller's own records (Supabase); the service keeps no state.
    expenses: List[ForecastExpense] = Field(default_factory=list, max_length=MAX_FORECAST_EXPENSES)


class CategorizeInput(BaseModel):
    description: str = Field(min_length=1, max_length=300)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


def _ai_unavailable(context: str) -> HTTPException:
    logger.exception("AI provider call failed: %s", context)
    return HTTPException(status_code=502, detail="The AI service is unavailable right now.")


@app.post("/ai/goal_recommendation/")
def ai_goal_recommendation(goal: GoalInput, user_id: str = Depends(enforce_rate_limit)):
    try:
        tip = generate_ai_tip(
            category="goal recommendation",
            user_context=f"Attitude: {goal.attitude}, Target Amount: {goal.target_amount:.2f}",
            target_date=goal.target_date,
            created_at=datetime.today().strftime("%Y-%m-%d"),
        )
    except Exception:
        raise _ai_unavailable("goal_recommendation")
    return {"recommendation": tip}


@app.post("/ai/saving_tip/")
def saving_tip(input: TipInput, user_id: str = Depends(enforce_rate_limit)):
    try:
        tip = generate_ai_tip(input.category, input.user_context or "", input.target_date, input.created_at)
    except Exception:
        raise _ai_unavailable("saving_tip")
    return {"tip": tip}


@app.post("/ai/forecast/")
def ai_forecast(input: ForecastInput, user_id: str = Depends(enforce_rate_limit)):
    goal = input.goal
    target_amount = goal.get("targetAmount", goal.get("target_amount"))
    target_date = goal.get("targetDate", goal.get("target_date"))
    attitude = goal.get("attitude", "Normal")

    if attitude not in ("Normal", "Moderate", "Aggressive"):
        attitude = "Normal"

    try:
        target_amount = float(target_amount)
        target_dt = datetime.strptime(str(target_date), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="A valid goal target amount and target date are required.")

    if target_amount < 0 or target_amount > 1_000_000_000_000:
        raise HTTPException(status_code=422, detail="Goal target amount is out of range.")

    today = datetime.today().date()
    days_left = (target_dt - today).days
    if days_left <= 0:
        return {"forecast": "The target date has already passed. Please set a future date."}
    if days_left > MAX_FORECAST_DAYS:
        raise HTTPException(status_code=422, detail="Target date is too far in the future.")

    actual_per_day: Dict[str, float] = defaultdict(float)
    for exp in input.expenses:
        actual_per_day[exp.date] += exp.amount

    spent = round(sum(actual_per_day.values()), 2)
    remaining = round(target_amount - spent, 2)
    per_day = round(max(0, remaining / days_left), 2)
    forecast_per_day = {
        (today + timedelta(days=i)).strftime("%Y-%m-%d"): per_day for i in range(days_left)
    }

    user_context = (
        f"Attitude: {attitude}, Target Amount: {target_amount:.2f}, "
        f"Wallet Budget: {input.budget:.2f}, Days Left: {days_left}, Spent: {spent:.2f}"
    )
    try:
        tip = generate_ai_tip(
            category="forecast",
            user_context=user_context,
            target_date=target_dt.strftime("%Y-%m-%d"),
            created_at=today.strftime("%Y-%m-%d"),
        )
    except Exception:
        raise _ai_unavailable("forecast")

    ai_recommended_budget = None
    match = re.search(
        r"save\s+([\d,]+)\s*(?:per month|monthly|a month|each month|every month|per week|weekly|a week|each week|every week)?",
        tip.replace(",", ""),
    )
    if match:
        try:
            ai_recommended_budget = float(match.group(1).replace(",", ""))
        except ValueError:
            ai_recommended_budget = None

    return {
        "forecast": tip,
        "forecast_per_day": forecast_per_day,
        "actual_per_day": dict(actual_per_day),
        "days_left": days_left,
        "spent": spent,
        "remaining": remaining,
        "ai_recommended_budget": ai_recommended_budget,
    }


@app.post("/ai/categorize_expense/")
def categorize_expense(expense: CategorizeInput, user_id: str = Depends(enforce_rate_limit)):
    try:
        category = get_expense_category(expense.description)
    except Exception:
        raise _ai_unavailable("categorize_expense")
    return {"category": category}
