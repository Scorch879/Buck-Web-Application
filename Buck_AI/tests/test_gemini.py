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


def fake_client(models):
    client = type("C", (), {})()
    client.aio = type("Aio", (), {})()
    client.aio.models = models
    return client


def json_response(text):
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=[types.Part(text=text)]))]
    )


class ModelChainTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        get_settings.cache_clear()
        self.sleep = mock.AsyncMock()
        patcher = mock.patch.object(gemini.asyncio, "sleep", self.sleep)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(gemini.set_client, None)
        self.addCleanup(get_settings.cache_clear)
        gemini.reset_bench()
        self.addCleanup(gemini.reset_bench)

    async def test_stream_walks_the_chain_without_waiting(self):
        used = []

        class Models:
            async def generate_content_stream(self, model, contents, config):
                used.append(model)
                if model != "gemini-3.6-flash":
                    raise overloaded()

                async def gen():
                    yield chunk(types.Part(text="ok"))

                return gen()

        gemini.set_client(fake_client(Models()))
        self.assertEqual(await collect(gemini.stream_with_tools("sys", [], [])), ["ok"])
        self.assertEqual(used, ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"])
        self.sleep.assert_not_awaited()  # switching models needs no pause

    async def test_json_records_the_model_that_answered(self):
        used = []

        class Models:
            async def generate_content(self, model, contents, config):
                used.append(model)
                if model != "gemini-3.6-flash":
                    raise overloaded()
                return json_response('{"tip":"x"}')

        gemini.set_client(fake_client(Models()))
        self.assertEqual(await gemini.generate_json("sys", "p", {"type": "object"}), {"tip": "x"})
        self.assertEqual(used, ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"])
        self.assertEqual(gemini.answered_by.get(), "gemini-3.6-flash")

    async def test_all_models_down_and_non_transient_errors(self):
        from google.genai import errors

        used = []

        class Models:
            async def generate_content(self, model, contents, config):
                used.append(model)
                raise overloaded()

        gemini.set_client(fake_client(Models()))
        with self.assertRaises(gemini.GeminiUnavailable):
            await gemini.generate_json("sys", "p", {"type": "object"})
        self.assertEqual(used, list(get_settings().gemini_models))

        used.clear()

        async def bad_request(model, contents, config):
            used.append(model)
            raise errors.ClientError(400, {"error": {"code": 400, "message": "bad", "status": "INVALID_ARGUMENT"}})

        gemini._client.aio.models.generate_content = bad_request
        with self.assertRaises(gemini.GeminiUnavailable):
            await gemini.generate_json("sys", "p", {"type": "object"})
        self.assertEqual(used, ["gemini-3.8-flash"])  # fail fast

    async def test_single_model_gets_one_paused_retry(self):
        used = []

        class Models:
            async def generate_content(self, model, contents, config):
                used.append(model)
                if len(used) == 1:
                    raise overloaded()
                return json_response('{"ok":true}')

        with mock.patch.dict(os.environ, {"GEMINI_MODELS": "gemini-3.6-flash"}):
            get_settings.cache_clear()
            gemini.set_client(fake_client(Models()))
            await gemini.generate_json("sys", "p", {"type": "object"})
        self.assertEqual(used, ["gemini-3.6-flash", "gemini-3.6-flash"])
        self.sleep.assert_awaited_once()

    async def test_daily_quota_benches_the_model_and_slow_models_are_skipped(self):
        from google.genai import errors

        used = []
        quota = errors.ClientError(429, {"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": "quota",
                                                   "details": [{"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"},
                                                               {"retryDelay": "57894s"}]}})

        class Models:
            async def generate_content(self, model, contents, config):
                used.append(model)
                if model == "gemini-3.8-flash":
                    raise quota
                if model == "gemini-3.7-flash":
                    await gemini.asyncio.Event().wait()  # never answers
                return json_response('{"ok":true}')

        gemini.set_client(fake_client(Models()))
        with mock.patch.object(gemini, "ATTEMPT_TIMEOUT_SECONDS", 0.05):
            await gemini.generate_json("sys", "p", {"type": "object"})
            self.assertEqual(used, ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"])
            used.clear()
            await gemini.generate_json("sys", "p", {"type": "object"})
        self.assertEqual(used[0], "gemini-3.7-flash")  # 3.8 is out of quota for the day: skipped

    def test_gemma_drops_thinking_and_last_model_gets_the_rest_of_the_budget(self):
        from google.genai import types as t

        cfg = t.GenerateContentConfig(thinking_config=t.ThinkingConfig(thinking_level=t.ThinkingLevel.LOW))
        self.assertIsNone(gemini.config_for("gemma-4-31b-it", cfg).thinking_config)
        self.assertIsNotNone(gemini.config_for("gemini-3.6-flash", cfg).thinking_config)
        plan = ("a", "b")
        self.assertEqual(gemini.attempt_timeout(plan, 0, 15.0), gemini.ATTEMPT_TIMEOUT_SECONDS)
        self.assertEqual(gemini.attempt_timeout(plan, 1, 15.0), 15.0)
        self.assertIsNone(gemini.attempt_timeout(plan, 1))

    def test_all_benched_still_tries_everything(self):
        for m in get_settings().gemini_models:
            gemini._benched[m] = float("inf")
        self.assertEqual(gemini.attempt_plan(), get_settings().gemini_models)


class ModelConfigTests(unittest.TestCase):
    def tearDown(self):
        get_settings.cache_clear()

    def models(self, env):
        keys = {"GEMINI_MODELS": "", "GEMINI_MODEL": ""} | env
        with mock.patch.dict(os.environ, keys):
            get_settings.cache_clear()
            return get_settings().gemini_models

    def test_defaults_and_overrides(self):
        defaults = self.models({})
        self.assertGreaterEqual(len(defaults), 10)
        self.assertEqual(defaults[:3], ("gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"))
        self.assertTrue(defaults[-1].startswith("gemma-"))  # big free quota: last resort
        # GEMINI_MODEL goes first; duplicates drop out.
        self.assertEqual(self.models({"GEMINI_MODEL": "gemini-3.7-flash"})[:3],
                         ("gemini-3.7-flash", "gemini-3.8-flash", "gemini-3.6-flash"))
        # GEMINI_MODELS wins outright.
        self.assertEqual(self.models({"GEMINI_MODELS": " gemini-3.6-flash , gemini-3.5-flash,,", "GEMINI_MODEL": "x"}),
                         ("gemini-3.6-flash", "gemini-3.5-flash"))


if __name__ == "__main__":
    unittest.main()
