from prophet import Prophet
import pandas as pd
import os
import re
from dotenv import load_dotenv
import requests

load_dotenv(dotenv_path=".env.local")

LLM_TIMEOUT_SECONDS = 20
MAX_PROMPT_FIELD_CHARS = 1000

# --- PII scrubbing (applied to every free-text field before it reaches the LLM) ---
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?:\+?63|0)9\d{2}[\s\-]?\d{3}[\s\-]?\d{4}")
_LONG_NUMBER_RE = re.compile(r"\b\d(?:[\s\-]?\d){8,}\b")  # accounts / cards: 9+ digits
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]+")


def scrub_pii(text):
    """Redact emails, PH mobile numbers and long account/card numbers."""
    text = _EMAIL_RE.sub("[email]", text)
    text = _PHONE_RE.sub("[phone]", text)
    return _LONG_NUMBER_RE.sub("[number]", text)


def sanitize_prompt_field(value, max_chars=MAX_PROMPT_FIELD_CHARS):
    """Scrub PII, flatten control characters/newlines, drop quotes and cap length."""
    text = _CONTROL_RE.sub(" ", str(value or ""))
    text = text.replace("'", "").replace('"', "").replace("`", "")
    return scrub_pii(text).strip()[:max_chars]


# Reference categories for classification
# Reference categories for classification
REFERENCE_CATEGORIES = [
    "Food",
    "Fare",
    "Gas Money",
    "Video Games",
    "Shopping",
    "Bills",
    "Education",
    "Electronics",
    "Entertainment",
    "Health",
    "Home",
    "Insurance",
    "Social",
    "Sport",
    "Tax",
    "Telephone",
    "Transportation"
]

def get_expense_category(description):
    description = sanitize_prompt_field(description, 300)
    api_url = "https://api.together.xyz/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.getenv('TOGETHER_API_KEY')}",
        "Content-Type": "application/json"
    }
    prompt = (
        f"Given the following expense description: '{description}', "
        f"which of these categories does it belong to: {', '.join(REFERENCE_CATEGORIES)}? "
        "Only return the category name."
    )
    payload = {
        "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 16,
        "temperature": 0
    }
    response = requests.post(api_url, headers=headers, json=payload, timeout=LLM_TIMEOUT_SECONDS)
    response.raise_for_status()
    result = response.json()
    category = result["choices"][0]["message"]["content"].strip()
    # Fallback if the model returns something unexpected
    if category not in REFERENCE_CATEGORIES:
        category = "Uncategorized"
    return category

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



def clean_llama_output(text):
    # Drop reasoning: closed <think>...</think> blocks, a stray closing tag
    # (reasoning-only prefix) and any unterminated trailing <think>.
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    if '</think>' in text:
        text = text.split('</think>')[-1]
    text = text.split('<think>', 1)[0]
    text = text.strip()
    sentences = re.split(r'(?<=[.!?])\s+', text)
    cleaned = ' '.join(sentences[:2]).strip()
    cleaned = cleaned.replace('<think>', '').strip()
    return cleaned

def generate_ai_tip(category, user_context="", target_date=None, created_at=None):
    category = sanitize_prompt_field(category, 80)
    user_context = sanitize_prompt_field(user_context)
    api_url = "https://api.together.xyz/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.getenv('TOGETHER_API_KEY')}",
        "Content-Type": "application/json"
    }
    import datetime
    # Calculate months or weeks left if dates are provided
    time_context = ""
    if target_date and created_at:
        try:
            d1 = datetime.datetime.strptime(created_at, "%Y-%m-%d")
            d2 = datetime.datetime.strptime(target_date, "%Y-%m-%d")
            days_left = (d2 - d1).days
            if days_left < 30:
                time_context = f"You have only {days_left} days left to reach your goal."
            else:
                months_left = round(days_left / 30)
                time_context = f"You have {months_left} months left to reach your goal."
        except Exception:
            pass
    # Add attitude explanation
    attitude_guide = (
        "Saving attitude multipliers: Normal = 1.0, Moderate = 0.8, Aggressive = 0.6. "
        "The user's attitude and multiplier are provided. Use the multiplier to adjust the recommended saving amount. "
        "For example, if the base amount is 1000 and the multiplier is 0.8, recommend 800. "
    )
    prompt = (
        f"You are a financial assistant. The currency is in Philippine Peso. In exactly 2 sentences, give a direct, actionable money-saving tip for someone who spends a lot of money on {category}. "
        f"{attitude_guide} Based on this context: {user_context}. {time_context} Tell them exactly how much they should save per period (month or week, depending on the time left) and one practical way to achieve it. "
        "Do NOT show your thought process, do NOT use <think>, and do NOT include any commentary or explanation. Only output the final tip and the amount."
    )
    payload = {
        "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", 
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 128,
        "temperature": 0.2
    }
    response = requests.post(api_url, headers=headers, json=payload, timeout=LLM_TIMEOUT_SECONDS)
    response.raise_for_status()
    result = response.json()
    raw_tip = result["choices"][0]["message"]["content"]
    return clean_llama_output(raw_tip)

