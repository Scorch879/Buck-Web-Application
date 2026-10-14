"""Tests for the shared Gemini tool loop, with a fake SDK client."""

import os
import unittest

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from google.genai import types  # noqa: E402

from shared import gemini  # noqa: E402
from shared.config import get_settings  # noqa: E402


def chunk(*parts: types.Part):
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=list(parts)))]
    )


class FakeModels:
    def __init__(self, rounds):
        self.rounds = list(rounds)
        self.calls = []

    async def generate_content_stream(self, model, contents, config):
        self.calls.append(list(contents))
        parts = self.rounds.pop(0)

        async def gen():
            for part in parts:
                yield chunk(part)

        return gen()


class FakeClient:
    def __init__(self, rounds):
        self.aio = type("Aio", (), {})()
        self.aio.models = FakeModels(rounds)


async def collect(stream):
    return [piece async for piece in stream]


class ToolLoopTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        get_settings.cache_clear()

    def tearDown(self):
        gemini.set_client(None)

    async def test_runs_tools_hides_thoughts_and_keeps_signatures(self):
        fake = FakeClient([
            [types.Part(text="planning", thought=True),
             types.Part(function_call=types.FunctionCall(id="c1", name="get_goals", args={}),
                        thought_signature=b"sig")],
            [types.Part(text="You have "), types.Part(text="1 goal.")],
        ])
        gemini.set_client(fake)
        calls = []

        async def run(args):
            calls.append(args)
            return [{"name": "Laptop"}]

        tool = gemini.Tool("get_goals", "Goals", {"type": "object", "properties": {}}, run)
        out = await collect(gemini.stream_with_tools("sys", [gemini.user_turn("goals?")], [tool]))

        self.assertEqual("".join(out), "You have 1 goal.")
        self.assertEqual(calls, [{}])
        second = fake.aio.models.calls[1]
        model_turn, tool_turn = second[1], second[2]
        self.assertEqual(model_turn.role, "model")
        self.assertTrue(any(p.thought_signature == b"sig" for p in model_turn.parts))
        response = tool_turn.parts[0].function_response
        self.assertEqual((response.id, response.name, response.response), ("c1", "get_goals", {"result": [{"name": "Laptop"}]}))

    async def test_unknown_and_failing_tools_are_reported_to_the_model(self):
        fake = FakeClient([
            [types.Part(function_call=types.FunctionCall(name="drop_tables", args={})),
             types.Part(function_call=types.FunctionCall(name="boom", args={}))],
            [types.Part(text="ok")],
        ])
        gemini.set_client(fake)

        async def boom(_):
            raise RuntimeError("db down")

        out = await collect(gemini.stream_with_tools(
            "sys", [], [gemini.Tool("boom", "x", {"type": "object", "properties": {}}, boom)]))
        responses = [p.function_response.response for p in fake.aio.models.calls[1][1].parts]
        self.assertEqual(responses, [{"error": "Unknown tool drop_tables"}, {"error": "db down"}])
        self.assertEqual(out, ["ok"])

    async def test_round_limit(self):
        loop = [types.Part(function_call=types.FunctionCall(name="loop", args={}))]
        gemini.set_client(FakeClient([loop] * 4))

        async def run(_):
            return 1

        with self.assertRaises(gemini.GeminiUnavailable):
            await collect(gemini.stream_with_tools(
                "sys", [], [gemini.Tool("loop", "x", {"type": "object", "properties": {}}, run)]))

    async def test_missing_key_is_unavailable(self):
        os.environ["GEMINI_API_KEY"] = ""
        get_settings.cache_clear()
        try:
            with self.assertRaises(gemini.GeminiUnavailable):
                await collect(gemini.stream_with_tools("sys", [], []))
        finally:
            os.environ["GEMINI_API_KEY"] = "test-key"
            get_settings.cache_clear()


if __name__ == "__main__":
    unittest.main()
