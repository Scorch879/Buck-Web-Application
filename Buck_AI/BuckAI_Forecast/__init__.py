"""AI Forecaster: projects each user's daily spending with a range.

A separate AI from BuckAI_Advisor with its own model, prompts and routes
(`/forecast`). The numbers come from a per-user model fitted on every request
(model.py, forecast.py); Gemini only explains them (service.py).
"""
