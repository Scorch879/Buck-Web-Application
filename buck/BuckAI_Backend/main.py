from fastapi import FastAPI, Request, Body
from pydantic import BaseModel
from ai_models import get_multiplier, predict_future_expense, generate_ai_tip
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional
import requests
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify ["http://localhost:3000"] for more security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    target_date: str = None
    created_at: str = None

class GoalData(BaseModel):
    goal_id: str
    goal_name: str
    target_amount: float
    attitude: str
    target_date: str

class ForecastInput(BaseModel):
    goal: dict
    budget: float

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

@app.post("/ai/saving_tip/")
def saving_tip(input: TipInput):
    try:
        tip = generate_ai_tip(input.category, input.user_context, input.target_date, input.created_at)
        return {"tip": tip}
    except Exception as e:
        return {"error": str(e)}

@app.post("/ai/forecast/")
def ai_forecast(input: ForecastInput = Body(...)):
    goal = input.goal
    budget = input.budget
    try:
        target_amount = goal.get("targetAmount") or goal.get("target_amount")
        target_date = goal.get("targetDate") or goal.get("target_date")
        if target_amount is None or target_date is None:
            return {"forecast": "Missing target amount or target date in goal."}
        target_amount = float(target_amount)
        attitude = goal.get("attitude", "Normal")
        today = datetime.today()
        target_dt = datetime.strptime(target_date, "%Y-%m-%d")
        months_left = (target_dt.year - today.year) * 12 + (target_dt.month - today.month)
        if months_left <= 0:
            return {"forecast": "The target date has already passed. Please set a future date."}
        monthly_target = target_amount / months_left
        multiplier = get_multiplier({"saving_attitude": attitude})
        adjusted_monthly_target = monthly_target * multiplier
        # --- TogetherAI prompt ---
        prompt = (
            f"You are a financial assistant. The currency is in Philippine Peso. "
            f"The user has a goal to save ₱{target_amount:.2f} by {target_date} with a '{attitude}' saving attitude (multiplier: {multiplier}). "
            f"There are {months_left} months left. Their current wallet budget is ₱{budget:.2f}. "
            f"The recommended monthly savings target is ₱{monthly_target:.2f}, adjusted for attitude: ₱{adjusted_monthly_target:.2f}. "
            f"In 2-3 sentences, give a direct, encouraging, and actionable forecast for the user. Mention if their current budget is enough, and give a practical tip to help them reach their goal."
        )
        api_url = "https://api.together.xyz/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {os.getenv('TOGETHER_API_KEY')}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 180,
            "temperature": 0.2
        }
        response = requests.post(api_url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        ai_forecast = result["choices"][0]["message"]["content"].strip()
        return {
            "forecast": ai_forecast,
            "months_left": months_left,
            "monthly_target": monthly_target,
            "adjusted_monthly_target": adjusted_monthly_target
        }
    except Exception as e:
        return {"error": str(e)}

