"""Groq client (OpenAI-compatible chat completions) for the AI Forecaster.

The Forecaster writes its explanation with open models on Groq: free with no
billing account, and fast enough that the card arrives in about a second.
The Advisor stays on Gemini (shared/gemini.py). The API key stays in the
server environment.
"""

import asyncio
import contextvars
import json
import logging
import time
from typing import Any

import httpx

from .config import get_settings
from .http import get_http

log = logging.getLogger("buck_ai.groq")

API_URL = "https://api.groq.com/openai/v1/chat/completions"
# Rate limit (429), capacity (498, 503), server errors and a retired model
# (404) move on to the next model; anything else fails fast.
TRANSIENT_CODES = frozenset({404, 429, 498, 500, 502, 503, 504})
ATTEMPT_TIMEOUT_SECONDS = 8.0
BENCH_SLOW_SECONDS = 300.0
BENCH_MAX_SECONDS = 3600.0

_benched: dict[str, float] = {}  # model -> time.monotonic() when it may be tried again

# The model that answered the latest generate_json call in this request.
answered_by: contextvars.ContextVar[str | None] = contextvars.ContextVar("groq_answered_by", default=None)


class GroqUnavailable(RuntimeError):
    """Groq is not configured, failed, timed out, or hit its free rate limit."""


class _Retry(Exception):
    """This model failed in a way the next model may not."""

    def __init__(self, message: str, bench_seconds: float = 0.0):
        super().__init__(message)
        self.bench_seconds = bench_seconds


def reset_bench() -> None:
    _benched.clear()


def attempt_plan() -> tuple[str, ...]:
    """Each configured model once, leaving out benched ones (all benched: try anyway)."""
    models = get_settings().groq_models
    now = time.monotonic()
    return tuple(m for m in models if _benched.get(m, 0.0) <= now) or models


def _strict(model: str) -> bool:
    """gpt-oss models decode against the JSON schema; the others get JSON mode."""
    return model.startswith("openai/gpt-oss")


def _body(model: str, system: str, prompt: str, schema: dict[str, Any], max_tokens: int) -> dict[str, Any]:
    body: dict[str, Any] = {"model": model, "temperature": 0.4, "max_completion_tokens": max_tokens}
    if _strict(model):
        body["response_format"] = {"type": "json_schema",
                                   "json_schema": {"name": "answer", "strict": True, "schema": schema}}
        body["reasoning_effort"] = "low"
        body["include_reasoning"] = False  # reasoning is never shown or stored
    else:
        body["response_format"] = {"type": "json_object"}
        system += ("\nReply with one JSON object only, matching this JSON schema:\n"
                   + json.dumps(schema, separators=(",", ":")))
    body["messages"] = [{"role": "system", "content": system}, {"role": "user", "content": prompt}]
    return body


def _retry_after(response: httpx.Response) -> float:
    try:
        return min(float(response.headers.get("retry-after", "")), BENCH_MAX_SECONDS)
    except ValueError:
        return 60.0


async def _call(model: str, body: dict[str, Any], timeout: float) -> dict[str, Any]:
    key = get_settings().groq_api_key
    try:
        response = await get_http().post(API_URL, json=body, timeout=timeout,
                                         headers={"Authorization": f"Bearer {key}"})
    except httpx.TimeoutException as exc:
        raise _Retry(f"{model} timed out", BENCH_SLOW_SECONDS) from exc
    except httpx.TransportError as exc:
        raise _Retry(f"{model}: {type(exc).__name__}") from exc
    if response.status_code in TRANSIENT_CODES:
        bench = {429: _retry_after(response), 404: BENCH_MAX_SECONDS}.get(response.status_code, 0.0)
        raise _Retry(f"{model} returned {response.status_code}", bench)
    if response.status_code == 400 and "json_validate_failed" in response.text:
        raise _Retry(f"{model} could not produce valid JSON")
    if response.status_code >= 400:
        # Error bodies can echo the prompt; keep them out of logs and responses.
        raise GroqUnavailable(f"Groq returned {response.status_code}")
    choice = (response.json().get("choices") or [{}])[0]
    try:
        data = json.loads((choice.get("message") or {}).get("content") or "")
    except ValueError as exc:
        raise _Retry(f"{model} answer was not JSON (finish_reason={choice.get('finish_reason')})") from exc
    if not isinstance(data, dict):
        raise _Retry(f"{model} returned non-object JSON")
    return data


async def generate_json(
    system_instruction: str,
    prompt: str,
    schema: dict[str, Any],
    timeout_seconds: float = 20,
    attempt_seconds: float = ATTEMPT_TIMEOUT_SECONDS,
    max_output_tokens: int = 2048,
) -> dict[str, Any]:
    """One-shot structured output. `schema` must be strict-mode ready (every
    property required, additionalProperties false). Callers must still
    validate the result. Tries each model in turn within one time budget."""
    settings = get_settings()
    if not settings.groq_configured:
        raise GroqUnavailable("GROQ_API_KEY is not configured.")
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_seconds
    plan = attempt_plan()
    last = "no model tried"
    for attempt, model in enumerate(plan):
        remaining = deadline - loop.time()
        if remaining <= 0.5:
            break
        timeout = remaining if attempt + 1 == len(plan) else min(attempt_seconds, remaining)
        try:
            data = await _call(model, _body(model, system_instruction, prompt, schema, max_output_tokens), timeout)
        except _Retry as exc:
            last = str(exc)
            if exc.bench_seconds:
                _benched[model] = time.monotonic() + exc.bench_seconds
            log.info("Groq %s; trying the next model", last)
            continue
        answered_by.set(model)
        return data
    raise GroqUnavailable(last)
