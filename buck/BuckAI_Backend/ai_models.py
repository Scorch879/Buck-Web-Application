from prophet import Prophet
import openai
import numpy as np
from xgboost import XGBClassifier
import pandas as pd
import os
from dotenv import load_dotenv
import requests
import os

load_dotenv(dotenv_path=".env.local")
# Set your OpenAI key here
openai.api_key = os.getenv("OPENAI_API_KEY")

# --- OpenAI Embedding Model ---
def get_expense_category(text):
    embedding = openai.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    # Dummy categorization return (real would compare embedding similarity)
    return "Food"

# --- XGBoost Classifier ---
# Dummy trained model (in reality, train with real data)
def get_multiplier(user_data):
    # Simulated mapping based on user's saving attitude
    saving_attitude = user_data.get('saving_attitude')
    attitude_map = {"Normal": 1.0, "Moderate": 0.8, "Aggressive": 0.6}
    return attitude_map.get(saving_attitude, 1.0)

# --- Facebook Prophet ---
def predict_future_expense(past_expenses):
    df = pd.DataFrame({
        'ds': pd.date_range(start='2024-01-01', periods=len(past_expenses), freq='M'),
        'y': past_expenses
    })
    model = Prophet()
    model.fit(df)
    future = model.make_future_dataframe(periods=1, freq='M')
    forecast = model.predict(future)
    return forecast['yhat'].iloc[-1]  # Predicted next month expense


def categorize_expense(text):
    api_url = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"
    headers = {"Authorization": f"Bearer {os.getenv('HUGGINGFACE_API_KEY')}"}
    payload = {
        "inputs": text,
        "parameters": {
            "candidate_labels": ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other"]
        }
    }
    response = requests.post(api_url, headers=headers, json=payload)
    response.raise_for_status()
    result = response.json()
    # Get the category with the highest score
    best_category = result["labels"][0]
    return best_category

def recommend_saving_tip(category): #test
    tips = {
        "Food": "Try meal prepping to save on food expenses.",
        "Transport": "Consider public transport or carpooling.",
        "Shopping": "Look for discounts and avoid impulse buys.",
        "Bills": "Review your subscriptions and cut unused ones.",
        "Entertainment": "Find free or low-cost activities.",
        "Other": "Track your spending to find more ways to save."
    }
    return tips.get(category, "Track your expenses regularly for better savings.")

