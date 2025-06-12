from fastapi import FastAPI
from pydantic import BaseModel
from ai_models import get_expense_category, get_multiplier, predict_future_expense

app = FastAPI()

class ExpenseInput(BaseModel):
    text: str
    past_expenses: list
    saving_attitude: str  # "Normal", "Moderate", "Aggressive"

@app.post("/process_expense/")
def process_expense(data: ExpenseInput):
    category = get_expense_category(data.text)
    multiplier = get_multiplier({"saving_attitude": data.saving_attitude})
    base_forecast = predict_future_expense(data.past_expenses)
    adjusted_forecast = base_forecast * multiplier
    return {
        "category": category,
        "base_forecast": base_forecast,
        "adjusted_forecast": adjusted_forecast
    }
