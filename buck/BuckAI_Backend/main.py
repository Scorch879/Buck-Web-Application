from fastapi import FastAPI
from pydantic import BaseModel
from ai_models import categorize_expense, get_multiplier, predict_future_expense
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify ["http://localhost:3000"] for more security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExpenseInput(BaseModel):
    text: str
    past_expenses: list
    saving_attitude: str  # "Normal", "Moderate", "Aggressive"

@app.post("/process_expense/")
def process_expense(data: ExpenseInput):
    category = categorize_expense(data.text)
    multiplier = get_multiplier({"saving_attitude": data.saving_attitude})
    base_forecast = predict_future_expense(data.past_expenses)
    adjusted_forecast = base_forecast * multiplier
    return {
        "category": category,
        "base_forecast": base_forecast,
        "adjusted_forecast": adjusted_forecast
    }

class GoalInput(BaseModel):
    goal_amount: float
    end_date: str  # ISO format date
    saving_attitude: str  # "Normal", "Moderate", "Aggressive"
    max_budget: float
    surprise_expenses: list  # List of {"date": "YYYY-MM-DD", "amount": float}
    past_expenses: list  # Optional, for forecasting



def forecast_budget(goal_input):
    today = datetime.today().date()
    end_date = datetime.fromisoformat(goal_input.end_date).date()
    days_left = (end_date - today).days
    if days_left <= 0:
        return {"error": "Goal end date must be in the future."}

    # Sum surprise expenses up to today
    total_surprise = sum(e['amount'] for e in goal_input.surprise_expenses if datetime.fromisoformat(e['date']).date() <= today)
    remaining_budget = goal_input.max_budget - total_surprise

    # Get multiplier based on attitude
    multiplier = get_multiplier({"saving_attitude": goal_input.saving_attitude})

    # Calculate per day and per week
    base_daily = remaining_budget / days_left
    adjusted_daily = base_daily * multiplier
    adjusted_weekly = adjusted_daily * 7

    return {
        "days_left": days_left,
        "remaining_budget": remaining_budget,
        "adjusted_daily_budget": adjusted_daily,
        "adjusted_weekly_budget": adjusted_weekly
    }