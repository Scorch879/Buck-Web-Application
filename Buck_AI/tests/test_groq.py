"""Tests for the Groq client, with Groq faked at the HTTP layer."""

import json
import os
import unittest
from unittest import mock

os.environ.setdefault("GROQ_API_KEY", "test-key")

import httpx  # noqa: E402

from shared import groq  # noqa: E402
from shared.config import get_settings  # noqa: E402
from shared.http import set_http  # noqa: E402

SCHEMA = {"type": "object", "properties": {"a": {"type": "string"}}, "required": ["a"], "additionalProperties": False}
ANSWER = {"choices": [{"message": {"content": json.dumps({"a": "hi"})}, "finish_reason": "stop"}]}


class GroqTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        get_settings.cache_clear()
        groq.reset_bench()
        self.replies: list[httpx.Response] = []
        self.bodies: list[dict] = []

        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.headers["authorization"], "Bearer test-key")
            self.bodies.append(json.loads(request.content))
            return self.replies.pop(0)

        set_http(httpx.AsyncClient(transport=httpx.MockTransport(handler)))

    async def test_strict_schema_on_gpt_oss(self):
        self.replies = [httpx.Response(200, json=ANSWER)]
        self.assertEqual(await groq.generate_json("sys", "prompt", SCHEMA), {"a": "hi"})
        body = self.bodies[0]
        self.assertEqual(body["model"], "openai/gpt-oss-120b")
        self.assertEqual(body["response_format"]["type"], "json_schema")
        self.assertTrue(body["response_format"]["json_schema"]["strict"])
        self.assertFalse(body["include_reasoning"])
        self.assertEqual(groq.answered_by.get(), "openai/gpt-oss-120b")

    async def test_rate_limit_moves_on_and_benches(self):
        self.replies = [httpx.Response(429, headers={"retry-after": "30"}, json={}),
                        httpx.Response(200, json=ANSWER)]
        await groq.generate_json("sys", "prompt", SCHEMA)
        llama = self.bodies[1]
        self.assertEqual(llama["model"], "llama-3.3-70b-versatile")
        # JSON mode for non-strict models, with the schema spelled out in the system message.
        self.assertEqual(llama["response_format"], {"type": "json_object"})
        self.assertIn('"required":["a"]', llama["messages"][0]["content"])
        self.assertNotIn("openai/gpt-oss-120b", groq.attempt_plan())

    async def test_invalid_json_moves_on(self):
        bad = {"choices": [{"message": {"content": '{"a": "cut'}, "finish_reason": "length"}]}
        self.replies = [httpx.Response(200, json=bad),
                        httpx.Response(400, json={"error": {"code": "json_validate_failed"}}),
                        httpx.Response(200, json=ANSWER)]
        self.assertEqual(await groq.generate_json("sys", "prompt", SCHEMA), {"a": "hi"})
        self.assertEqual(self.bodies[2]["model"], "openai/gpt-oss-20b")

    async def test_auth_error_fails_fast(self):
        self.replies = [httpx.Response(401, json={"error": "bad key"})]
        with self.assertRaises(groq.GroqUnavailable):
            await groq.generate_json("sys", "prompt", SCHEMA)
        self.assertEqual(len(self.bodies), 1)

    async def test_all_models_failing_raises(self):
        self.replies = [httpx.Response(503, json={}) for _ in range(3)]
        with self.assertRaises(groq.GroqUnavailable):
            await groq.generate_json("sys", "prompt", SCHEMA)

    async def test_not_configured(self):
        with mock.patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            get_settings.cache_clear()
            with self.assertRaises(groq.GroqUnavailable):
                await groq.generate_json("sys", "prompt", SCHEMA)
        get_settings.cache_clear()


if __name__ == "__main__":
    unittest.main()
