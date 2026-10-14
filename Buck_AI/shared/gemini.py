"""Gemini Flash client shared by the Buck AIs.

Each AI (BuckAI_Advisor, BuckAI_Forecast) brings its own system prompt and
tools; this module only knows how to talk to the model. The API key stays
in the server environment.
"""

import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import types

from .config import get_settings

MAX_TOOL_ROUNDS = 4

_client: genai.Client | None = None


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
    )

    for _ in range(MAX_TOOL_ROUNDS):
        model_parts: list[types.Part] = []
        calls: list[types.FunctionCall] = []
        try:
            stream = await client.aio.models.generate_content_stream(
                model=get_settings().gemini_model, contents=contents, config=config
            )
            async for chunk in stream:
                candidate = (chunk.candidates or [None])[0]
                for part in (candidate.content.parts if candidate and candidate.content else None) or []:
                    model_parts.append(part)
                    if part.function_call:
                        calls.append(part.function_call)
                    elif part.text and not part.thought:
                        yield part.text
        except GeminiUnavailable:
            raise
        except Exception as exc:  # SDK/network/quota errors
            raise GeminiUnavailable(str(exc)) from exc

        if not calls:
            return

        contents.append(types.Content(role="model", parts=model_parts))
        responses = await asyncio.gather(*(_run_tool(by_name, call) for call in calls))
        contents.append(types.Content(role="user", parts=list(responses)))

    raise GeminiUnavailable("Tool round limit reached.")


async def _run_tool(by_name: dict[str, Tool], call: types.FunctionCall) -> types.Part:
    tool = by_name.get(call.name or "")
    try:
        response = {"result": await tool.run(dict(call.args or {}))} if tool else {"error": f"Unknown tool {call.name}"}
    except Exception as exc:  # report back to the model instead of crashing
        response = {"error": str(exc) or "Tool failed."}
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
    )
    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=get_settings().gemini_model, contents=[user_turn(prompt)], config=config
            ),
            timeout=timeout_seconds,
        )
        data = json.loads(response.text or "")
    except Exception as exc:
        raise GeminiUnavailable(str(exc)) from exc
    if not isinstance(data, dict):
        raise GeminiUnavailable("Model returned non-object JSON.")
    return data
