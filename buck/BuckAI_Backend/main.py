from fastapi import FastAPI, Request, Body
from pydantic import BaseModel
from ai_models import get_multiplier, predict_future_expense, generate_ai_tip, get_expense_category
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional, List, Dict

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify ["http://localhost:3000"] for more security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for expenses: { (user_id, goal_id): [ {date, amount, description, category} ] }
expenses_db: Dict[str, List[dict]] = {}

class GoalInput(BaseModel):
    goal_name: str
    target_amount: float
    attitude: str
    target_date: str  # Expecting 'YYYY-MM-DD'

class TextInput(BaseModel):
    text: str

class TipInput(BaseModel):
    category: str
    user_context: Optional[str] = ""
    target_date: Optional[str] = None
    created_at: Optional[str] = None

class GoalData(BaseModel):
    goal_id: str
    goal_name: str
    target_amount: float
    attitude: str
    target_date: str

class ForecastInput(BaseModel):
    goal: dict
    budget: float

class ExpenseInput(BaseModel):
    user_id: str
    goal_id: str
    date: str  # 'YYYY-MM-DD'
    amount: float
    description: str

@app.post("/ai/goal_recommendation/")
def ai_goal_recommendation(goal: GoalInput):
    # Use TogetherAI for the recommendation
    try:
        user_context = f"Attitude: {goal.attitude}, Target Amount: {goal.target_amount}"
        tip = generate_ai_tip(
            category="goal recommendation",
            user_context=user_context,
            target_date=goal.target_date,
            created_at=datetime.today().strftime("%Y-%m-%d")
        )
        return {"recommendation": tip}
    except Exception as e:
        return {"error": str(e)}

@app.post("/ai/saving_tip/")
def saving_tip(input: TipInput):
    try:
        tip = generate_ai_tip(input.category, input.user_context or "", input.target_date, input.created_at)
        return {"tip": tip}
    except Exception as e:
        return {"error": str(e)}

@app.post("/expenses/")
def add_expense(expense: ExpenseInput):
    # Categorize with TogetherAI
    try:
        category = get_expense_category(expense.description)
    except Exception:
        category = "Uncategorized"
    key = f"{expense.user_id}:{expense.goal_id}"
    if key not in expenses_db:
        expenses_db[key] = []
    expenses_db[key].append({
        "date": expense.date,
        "amount": expense.amount,
        "description": expense.description,
        "category": category
    })
    return {"success": True, "category": category}

@app.get("/expenses/{user_id}/{goal_id}/")
def get_expenses(user_id: str, goal_id: str):
    key = f"{user_id}:{goal_id}"
    return expenses_db.get(key, [])

@app.post("/ai/forecast/")
def ai_forecast(input: ForecastInput = Body(...)):
    goal = input.goal
    budget = input.budget
    user_id = goal.get("userId") or goal.get("user_id")
    goal_id = goal.get("id") or goal.get("goal_id")
    try:
        target_amount = goal.get("targetAmount") or goal.get("target_amount")
        target_date = goal.get("targetDate") or goal.get("target_date")
        attitude = goal.get("attitude", "Normal")
        if target_amount is None or target_date is None or user_id is None or goal_id is None:
            return {"forecast": "Missing required goal/user info."}
        # Get expenses for this user/goal
        key = f"{user_id}:{goal_id}"
        expenses = expenses_db.get(key, [])
        # Aggregate actual expenses per day
        from collections import defaultdict
        actual_per_day = defaultdict(float)
        for exp in expenses:
            actual_per_day[exp["date"]] += exp["amount"]
        # Forecast future daily expenses (stub: even split of remaining budget)
        from datetime import datetime, timedelta
        today = datetime.today().date()
        target_dt = datetime.strptime(target_date, "%Y-%m-%d").date()
        days_left = (target_dt - today).days
        if days_left <= 0:
            return {"forecast": "The target date has already passed. Please set a future date."}
        spent = sum(actual_per_day.values())
        remaining = float(target_amount) - spent
        forecast_per_day = {}
        for i in range(days_left):
            day = (today + timedelta(days=i)).strftime("%Y-%m-%d")
            forecast_per_day[day] = max(0, remaining / days_left)
        # AI commentary
        user_context = f"Attitude: {attitude}, Target Amount: {target_amount}, Wallet Budget: {budget}, Days Left: {days_left}, Spent: {spent}"
        tip = generate_ai_tip(
            category="forecast",
            user_context=user_context,
            target_date=target_date,
            created_at=today.strftime("%Y-%m-%d")
        )
        return {
            "forecast": tip,
            "forecast_per_day": forecast_per_day,
            "actual_per_day": dict(actual_per_day),
            "days_left": days_left,
            "spent": spent,
            "remaining": remaining
        }
    except Exception as e:
        return {"error": str(e)}

