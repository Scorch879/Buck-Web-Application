from fastapi import FastAPI, Request
from pydantic import BaseModel
from ai_models import categorize_expense, get_multiplier, predict_future_expense, generate_ai_tip
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

# In-memory storage for demo/testing (resets on server restart)
goal_store = {}

class GoalInput(BaseModel):
    goal_name: str
    target_amount: float
    attitude: str
    target_date: str  # Expecting 'YYYY-MM-DD'

class TextInput(BaseModel):
    text: str

class TipInput(BaseModel):
    category: str
    user_context: str = ""

class GoalData(BaseModel):
    goal_id: str
    goal_name: str
    target_amount: float
    attitude: str
    target_date: str

@app.post("/ai/goal_recommendation/")
def ai_goal_recommendation(goal: GoalInput):
    # Calculate months left
    today = datetime.today()
    target_date = datetime.strptime(goal.target_date, "%Y-%m-%d")
    months_left = (target_date.year - today.year) * 12 + (target_date.month - today.month)
    if months_left <= 0:
        return {"recommendation": "The target date has already passed. Please set a future date."}
    if goal.target_amount <= 0:
        return {"recommendation": "Please set a valid target amount for your goal."}

    multiplier = get_multiplier({"saving_attitude": goal.attitude})
    monthly_target = goal.target_amount / months_left
    adjusted_monthly_target = monthly_target * multiplier

    return {
        "recommendation": f"To reach your goal, you should aim to save ₱{monthly_target:.2f} per month. With your \"{goal.attitude}\" attitude, try to keep your spending below ₱{adjusted_monthly_target:.2f} per month.",
        "months_left": months_left,
        "monthly_target": monthly_target,
        "adjusted_monthly_target": adjusted_monthly_target
    }

@app.post("/ai/test_huggingface/")
def test_huggingface(input: TextInput):
    try:
        category = categorize_expense(input.text)
        return {"category": category}
    except Exception as e:
        return {"error": str(e)}

@app.post("/ai/saving_tip/")
def saving_tip(input: TipInput):
    try:
        tip = generate_ai_tip(input.category, input.user_context)
        return {"tip": tip}
    except Exception as e:
        return {"error": str(e)}

@app.post("/demo/goal/")
def create_or_update_goal(goal: GoalData):
    # Generate AI recommendation
    user_context = f"Attitude: {goal.attitude}, Target Amount: {goal.target_amount}"
    ai_recommendation = generate_ai_tip(goal.goal_name, user_context)
    # Store in memory
    goal_store[goal.goal_id] = {
        "goal_name": goal.goal_name,
        "target_amount": goal.target_amount,
        "attitude": goal.attitude,
        "target_date": goal.target_date,
        "ai_recommendation": ai_recommendation
    }
    return {"success": True, "ai_recommendation": ai_recommendation}

@app.get("/demo/goal/{goal_id}")
def get_goal(goal_id: str):
    goal = goal_store.get(goal_id)
    if not goal:
        return {"error": "Goal not found"}
    return goal