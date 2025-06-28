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

def generate_ai_tip(category, user_context=""):
    api_url = "https://api.together.xyz/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.getenv('TOGETHER_API_KEY')}",
        "Content-Type": "application/json"
    }
    prompt = f"Give a personalized money-saving tip for someone who spends a lot on {category}. {user_context}"
    payload = {
        "model": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",  # You can change this to any supported model
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 128,
        "temperature": 0.7
    }
    response = requests.post(api_url, headers=headers, json=payload)
    response.raise_for_status()
    result = response.json()
    return result["choices"][0]["message"]["content"]

