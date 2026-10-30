"""Buck_AI: the Gemini-powered AI service for Buck (web and mobile).

Two AIs for two jobs:
- BuckAI_Advisor   AI Financial Advisor (live): saved, self-updating advice,
                   chat and goal tips.
- BuckAI_Forecast  AI Forecaster (live): per-user daily spending forecast
                   with ranges, explained by Gemini.

Deployed as its own Vercel project (root directory `Buck_AI`). Vercel finds
the FastAPI `app` in this file. Local run: `uvicorn main:app --reload --port 8000`.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from BuckAI_Advisor.router import router as advisor_router
from BuckAI_Forecast.router import router as forecast_router
from shared.config import get_settings

logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)  # no per-request URL logs
log = logging.getLogger("buck_ai")

app = FastAPI(title="Buck_AI", docs_url=None, redoc_url=None, openapi_url=None)

# Browsers (the web app) need CORS; the mobile app does not. Auth is a bearer
# token, not a cookie, so credentialed CORS is unnecessary.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Buck-Error"],  # "mfa_required" from shared/auth.py
    max_age=600,
)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.get("/")
async def health():
    # Liveness only: no configuration state or model name for anonymous callers.
    return {"service": "buck-ai", "ok": True}


app.include_router(advisor_router)
app.include_router(forecast_router)
