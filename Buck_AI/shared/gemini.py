"""Gemini Flash client shared by the Buck AIs.

Each AI (BuckAI_Advisor, BuckAI_Forecast) brings its own system prompt and
tools; this module only knows how to talk to the model. The API key stays
in the server environment.
"""

import asyncio
import contextvars
import json
import logging
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import errors, types

from .config import get_settings

log = logging.getLogger("buck_ai.gemini")

MAX_TOOL_ROUNDS = 4
# Overloaded (503), internal (500), timeout (504), quota (429) and retired
# model (404) errors move on to the next model in the chain, as does a model
# that doesn't answer within ATTEMPT_TIMEOUT_SECONDS; anything else fails fast.
TRANSIENT_CODES = frozenset({404, 429, 500, 503, 504})
ATTEMPT_TIMEOUT_SECONDS = 8.0
# Chat only: a model still silent after this long gets the next model raced
# against it. Late enough that a normal first chunk (thinking + tool call)
# rarely triggers it, since each race spends quota on two models.
HEDGE_AFTER_SECONDS = 4.0
# The free tier allows about 20 requests a day per model. A model that runs
# out is skipped (per instance) until Google's retry delay passes, capped so
# a long delay can't bench it for the rest of the day on a warm instance.
# A slow model (timed out or lost a race) is skipped for a few minutes so
# the next requests start on a model that is answering.
BENCH_PER_MINUTE_SECONDS = 60.0
BENCH_SLOW_SECONDS = 300.0
BENCH_MAX_SECONDS = 3600.0
_RETRY_DELAY = re.compile(r"retryDelay'?\"?:\s*'?\"?(\d+)s")
# Pause before retrying the same model (only when a single model is configured).
RETRY_DELAY_SECONDS = 0.8
# Tools are declared, never Python callables, so the SDK's automatic function
# calling has nothing to do; disabling it also drops its "AFC is enabled" log.
_NO_AFC = types.AutomaticFunctionCallingConfig(disable=True)

_client: genai.Client | None = None
_benched: dict[str, float] = {}  # model -> time.monotonic() when it may be tried again

# The model that answered the latest generate_json call in this request
# (contextvars keep concurrent requests apart). Saved with the advice.
answered_by: contextvars.ContextVar[str | None] = contextvars.ContextVar("answered_by", default=None)


class GeminiUnavailable(RuntimeError):
    """Gemini is not configured, failed, timed out, or hit its free quota."""


def _get_client() -> genai.Client:
    global _client
    settings = get_settings()
    if not settings.gemini_configured:
        raise GeminiUnavailable("GEMINI_API_KEY is not configured.")
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def set_client(client: Any) -> None:
    """Tests inject a fake client."""
    global _client
    _client = client


def is_transient(exc: BaseException) -> bool:
    if isinstance(exc, asyncio.TimeoutError):
        return True
    return isinstance(exc, errors.APIError) and exc.code in TRANSIENT_CODES


def bench(model: str, exc: BaseException) -> None:
    """Skip a model that ran out of quota or is too slow until it may answer again."""
    if isinstance(exc, asyncio.TimeoutError):
        _benched[model] = time.monotonic() + BENCH_SLOW_SECONDS
        log.info("Gemini %s benched for %.0fs (slow)", model, BENCH_SLOW_SECONDS)
        return
    if not (isinstance(exc, errors.APIError) and exc.code in (404, 429)):
        return
    text = str(exc)
    if exc.code == 404:
        seconds = BENCH_MAX_SECONDS
    elif "PerDay" in text:
        match = _RETRY_DELAY.search(text)
        seconds = min(float(match.group(1)), BENCH_MAX_SECONDS) if match else BENCH_MAX_SECONDS
    else:
        seconds = BENCH_PER_MINUTE_SECONDS
    _benched[model] = time.monotonic() + seconds
    log.info("Gemini %s benched for %.0fs (%s)", model, seconds, exc.code)


def config_for(model: str, config: types.GenerateContentConfig) -> types.GenerateContentConfig:
    """Gemma models reject thinking settings; everything else is shared."""
    return config.model_copy(update={"thinking_config": None}) if model.startswith("gemma-") else config


def attempt_timeout(plan: tuple[str, ...], attempt: int, remaining: float | None = None) -> float | None:
    """The last model in the plan gets whatever time is left; earlier ones are capped."""
    if attempt + 1 >= len(plan):
        return remaining
    return ATTEMPT_TIMEOUT_SECONDS if remaining is None else min(ATTEMPT_TIMEOUT_SECONDS, remaining)


def reset_bench() -> None:
    _benched.clear()


def attempt_plan() -> tuple[str, ...]:
    """Models to try, in order: each configured model once (primary first),
    leaving out models still benched for quota. A single model gets one retry."""
    models = get_settings().gemini_models
    now = time.monotonic()
    ready = tuple(m for m in models if _benched.get(m, 0.0) <= now) or models  # all benched: try anyway
    return ready if len(ready) > 1 else ready * 2


async def _before_next(plan: tuple[str, ...], attempt: int, exc: BaseException) -> None:
    """Log the switch and pause only when retrying the same model."""
    log.info("Gemini %s busy (%s); trying %s", plan[attempt - 1], getattr(exc, "code", None) or type(exc).__name__, plan[attempt])
    if plan[attempt] == plan[attempt - 1]:
        await asyncio.sleep(RETRY_DELAY_SECONDS)


@dataclass
class Tool:
    """A read-only function the model may call. `run` gets the model's
    arguments and must validate them; the user scope is bound in by the caller."""

    name: str
    description: str
    parameters: dict[str, Any]
    run: Callable[[dict[str, Any]], Awaitable[Any]]

    def declaration(self) -> types.FunctionDeclaration:
        return types.FunctionDeclaration(
            name=self.name, description=self.description, parameters_json_schema=self.parameters
        )


def user_turn(text: str) -> types.Content:
    return types.Content(role="user", parts=[types.Part(text=text)])


def history_contents(history: list[dict[str, str]], question: str) -> list[types.Content]:
    contents = [
        types.Content(role="model" if t["role"] == "assistant" else "user", parts=[types.Part(text=t["content"])])
        for t in history
    ]
    contents.append(user_turn(question))
    return contents


async def stream_with_tools(
    system_instruction: str,
    contents: list[types.Content],
    tools: list[Tool],
    max_output_tokens: int = 1024,
) -> AsyncIterator[str]:
    """Streams user-visible text, running tool calls between rounds.

    Thought parts are never yielded. Model turns are replayed with their
    original parts so Gemini's thought signatures are preserved.
    """
    client = _get_client()
    contents = list(contents)
    by_name = {t.name: t for t in tools}
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        tools=[types.Tool(function_declarations=[t.declaration() for t in tools])] if tools else None,
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
        max_output_tokens=max_output_tokens,
        automatic_function_calling=_NO_AFC,
    )
    plan = attempt_plan()
    attempt = 0  # shared across rounds: once on a fallback model, stay there

    for _ in range(MAX_TOOL_ROUNDS):
        while True:
            model_parts: list[types.Part] = []
            calls: list[types.FunctionCall] = []
            try:
                attempt, chunks, chunk = await _open_round(client, plan, attempt, contents, config)
                while chunk is not None:
                    candidate = (chunk.candidates or [None])[0]
                    for part in (candidate.content.parts if candidate and candidate.content else None) or []:
                        model_parts.append(part)
                        if part.function_call:
                            calls.append(part.function_call)
                        elif part.text and not part.thought:
                            yield part.text
                    chunk = await anext(chunks, None)  # later chunks: the caller's idle limit applies
                break
            except GeminiUnavailable:
                raise
            except Exception as exc:  # SDK/network/quota errors
                bench(plan[attempt], exc)
                # Retry only before this round produced anything, so no text repeats.
                if not model_parts and is_transient(exc) and attempt + 1 < len(plan):
                    attempt += 1
                    await _before_next(plan, attempt, exc)
                    continue
                raise GeminiUnavailable(str(exc) or type(exc).__name__) from exc

        if not calls:
            return

        contents.append(types.Content(role="model", parts=model_parts))
        responses = await asyncio.gather(*(_run_tool(by_name, call) for call in calls))
        contents.append(types.Content(role="user", parts=list(responses)))

    raise GeminiUnavailable("Tool round limit reached.")


async def _open(client: Any, model: str, contents: list[types.Content], config: types.GenerateContentConfig):
    """Opens a stream and waits for its first chunk (None for an empty stream)."""
    stream = await client.aio.models.generate_content_stream(
        model=model, contents=contents, config=config_for(model, config)
    )
    chunks = aiter(stream)
    return chunks, await anext(chunks, None)


async def _open_round(client: Any, plan: tuple[str, ...], attempt: int,
                      contents: list[types.Content], config: types.GenerateContentConfig):
    """Starts a round on plan[attempt] and returns (index, chunks, first chunk)
    of the model that answers first.

    Each model gets ATTEMPT_TIMEOUT_SECONDS to send its first chunk. If the
    current one is still silent after HEDGE_AFTER_SECONDS, the next model is
    started alongside it (at most two in flight) and the first to answer wins,
    so one slow model costs seconds instead of the whole timeout. A model that
    fails or loses the race to a later one is benched as slow.
    """
    loop = asyncio.get_running_loop()
    pending: dict[asyncio.Task, int] = {}
    next_up = attempt
    last_launch = 0.0
    last_exc: BaseException | None = None

    def launch() -> None:
        nonlocal next_up, last_launch
        task = asyncio.ensure_future(asyncio.wait_for(
            _open(client, plan[next_up], contents, config), attempt_timeout(plan, next_up)))
        pending[task] = next_up
        next_up += 1
        last_launch = loop.time()

    launch()
    try:
        while pending:
            hedge = len(pending) == 1 and next_up < len(plan) and plan[next_up] != plan[next_up - 1]
            # Counted from the latest launch: when one of two racers fails, the
            # survivor may already be overdue and the next model starts at once.
            wait = max(0.0, last_launch + HEDGE_AFTER_SECONDS - loop.time()) if hedge else None
            done, _ = await asyncio.wait(pending, timeout=wait, return_when=asyncio.FIRST_COMPLETED)
            if not done:
                log.info("Gemini %s slow; racing %s", plan[next_up - 1], plan[next_up])
                launch()
                continue
            for task in sorted(done, key=pending.__getitem__):
                index = pending.pop(task)
                exc = task.exception()
                if exc is None:
                    for i in pending.values():
                        if i < index:  # started earlier and still silent
                            bench(plan[i], asyncio.TimeoutError())
                    return index, *task.result()
                bench(plan[index], exc)
                if not is_transient(exc):
                    raise GeminiUnavailable(str(exc) or type(exc).__name__) from exc
                last_exc = exc
                log.info("Gemini %s busy (%s)", plan[index], getattr(exc, "code", None) or type(exc).__name__)
            if not pending and next_up < len(plan):
                if plan[next_up] == plan[next_up - 1]:
                    await asyncio.sleep(RETRY_DELAY_SECONDS)  # single model: pause before its retry
                launch()
    finally:
        for task in pending:
            task.cancel()
    raise GeminiUnavailable(str(last_exc) or type(last_exc).__name__) from last_exc


async def _run_tool(by_name: dict[str, Tool], call: types.FunctionCall) -> types.Part:
    tool = by_name.get(call.name or "")
    try:
        response = {"result": await tool.run(dict(call.args or {}))} if tool else {"error": f"Unknown tool {call.name}"}
    except Exception as exc:  # report back to the model instead of crashing
        # Details stay in the log: database error text must not reach the model or the user.
        log.warning("Tool %s failed: %s", call.name, exc)
        response = {"error": "Tool failed. Answer from the snapshot or say the data is unavailable."}
    return types.Part(function_response=types.FunctionResponse(id=call.id, name=call.name, response=response))


async def generate_json(
    system_instruction: str,
    prompt: str,
    schema: dict[str, Any],
    timeout_seconds: float = 20,
) -> dict[str, Any]:
    """One-shot structured output constrained to `schema`. Callers must still
    validate the result."""
    client = _get_client()
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        response_json_schema=schema,
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
        max_output_tokens=1024,
        automatic_function_calling=_NO_AFC,
    )
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_seconds  # one budget across all attempts
    plan = attempt_plan()
    attempt = 0
    while True:
        try:
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=plan[attempt], contents=[user_turn(prompt)], config=config_for(plan[attempt], config)
                ),
                timeout=max(0.1, attempt_timeout(plan, attempt, deadline - loop.time())),
            )
            data = json.loads(response.text or "")
            answered_by.set(plan[attempt])
            break
        except Exception as exc:
            bench(plan[attempt], exc)
            if is_transient(exc) and attempt + 1 < len(plan) and deadline - loop.time() > 2 * RETRY_DELAY_SECONDS:
                attempt += 1
                await _before_next(plan, attempt, exc)
                continue
            raise GeminiUnavailable(str(exc) or type(exc).__name__) from exc
    if not isinstance(data, dict):
        raise GeminiUnavailable("Model returned non-object JSON.")
    return data
