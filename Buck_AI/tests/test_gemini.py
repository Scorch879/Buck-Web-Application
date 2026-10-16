"""Tests for the shared Gemini tool loop, with a fake SDK client."""

import os
import unittest
from unittest import mock

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
        self.assertEqual(responses, [{"error": "Unknown tool drop_tables"}, {"error": "Tool failed. Answer from the snapshot or say the data is unavailable."}])
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


def overloaded():
    from google.genai import errors

    return errors.ServerError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})


class RetryFallbackTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        get_settings.cache_clear()
        self.sleep = mock.patch.object(gemini.asyncio, "sleep", mock.AsyncMock())
        self.sleep.start()

    def tearDown(self):
        self.sleep.stop()
        gemini.set_client(None)

    async def test_stream_retries_then_uses_fallback_model(self):
        models_used = []

        class Models:
            async def generate_content_stream(self, model, contents, config):
                models_used.append(model)
                if len(models_used) < 3:
                    raise overloaded()

                async def gen():
                    yield chunk(types.Part(text="ok"))

                return gen()

        client = type("C", (), {})()
        client.aio = type("Aio", (), {})()
        client.aio.models = Models()
        gemini.set_client(client)
        out = await collect(gemini.stream_with_tools("sys", [], []))
        self.assertEqual(out, ["ok"])
        self.assertEqual(models_used, ["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.7-flash"])

    async def test_json_falls_back_and_non_transient_errors_do_not_retry(self):
        from google.genai import errors

        calls = []

        class Models:
            async def generate_content(self, model, contents, config):
                calls.append(model)
                if model == "gemini-3.8-flash":
                    raise overloaded()
                return types.GenerateContentResponse(
                    candidates=[types.Candidate(content=types.Content(role="model", parts=[types.Part(text='{"tip":"x"}')]))]
                )

        client = type("C", (), {})()
        client.aio = type("Aio", (), {})()
        client.aio.models = Models()
        gemini.set_client(client)
        self.assertEqual(await gemini.generate_json("sys", "p", {"type": "object"}), {"tip": "x"})
        self.assertEqual(calls, ["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.7-flash"])

        calls.clear()

        async def bad_request(model, contents, config):
            calls.append(model)
            raise errors.ClientError(400, {"error": {"code": 400, "message": "bad", "status": "INVALID_ARGUMENT"}})

        client.aio.models.generate_content = bad_request
        with self.assertRaises(gemini.GeminiUnavailable):
            await gemini.generate_json("sys", "p", {"type": "object"})
        self.assertEqual(calls, ["gemini-3.8-flash"])


if __name__ == "__main__":
    unittest.main()
