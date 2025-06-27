from fastapi import FastAPI
from pydantic import BaseModel
from ai_models import categorize_expense, get_multiplier, predict_future_expense, forecast_budget
from fastapi.middleware.cors import CORSMiddleware


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

class GoalInput(BaseModel):
    goal_amount: float
    end_date: str  # ISO format date
    saving_attitude: str  # "Normal", "Moderate", "Aggressive"
    max_budget: float
    surprise_expenses: list  # List of {"date": "YYYY-MM-DD", "amount": float}
    past_expenses: list  # Optional, for forecasting


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

@app.post("/forecast_goal/")
def forecast_goal(data: GoalInput):
    return forecast_budget(data)
