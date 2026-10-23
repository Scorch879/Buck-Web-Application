"""Two-factor check in shared/auth.py (ADR-048). Run from Buck_AI/: python -m unittest -v"""

import base64
import json
import os
import unittest

os.environ.update({
    "SUPABASE_URL": "https://proj.supabase.co",
    "SUPABASE_ANON_KEY": "anon-key",
    "GEMINI_API_KEY": "test-key",
    "ALLOWED_ORIGINS": "http://localhost:3000",
})

import httpx  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from starlette.requests import Request  # noqa: E402

from shared import auth  # noqa: E402
from shared.config import get_settings  # noqa: E402
from shared.http import set_http  # noqa: E402


def jwt(claims: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return f"header.{payload}.signature"


AAL1 = jwt({"sub": "user-1", "aal": "aal1"})
AAL2 = jwt({"sub": "user-1", "aal": "aal2"})
VERIFIED = [{"id": "f1", "factor_type": "totp", "status": "verified"}]
UNVERIFIED = [{"id": "f1", "factor_type": "totp", "status": "unverified"}]


def request_with(token: str) -> Request:
    return Request({"type": "http", "headers": [(b"authorization", f"Bearer {token}".encode())]})


class TwoFactorTests(unittest.IsolatedAsyncioTestCase):
    def use(self, factors: list[dict]):
        get_settings.cache_clear()
        auth.clear_auth_cache()
        self.user_calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            self.user_calls += 1
            return httpx.Response(200, json={"id": "user-1", "factors": factors})

        set_http(httpx.AsyncClient(transport=httpx.MockTransport(handler)))

    async def test_user_without_2fa_passes_at_aal1(self):
        self.use([])
        self.assertEqual((await auth.current_user(request_with(AAL1))).id, "user-1")

    async def test_unverified_factor_does_not_count(self):
        self.use(UNVERIFIED)
        self.assertEqual((await auth.current_user(request_with(AAL1))).id, "user-1")

    async def test_2fa_user_needs_aal2(self):
        self.use(VERIFIED)
        with self.assertRaises(HTTPException) as caught:
            await auth.current_user(request_with(AAL1))
        self.assertEqual(caught.exception.status_code, 403)
        self.assertEqual(caught.exception.headers, {"X-Buck-Error": "mfa_required"})
        self.assertEqual((await auth.current_user(request_with(AAL2))).id, "user-1")

    async def test_cached_token_is_still_checked(self):
        self.use(VERIFIED)
        for _ in range(2):
            with self.assertRaises(HTTPException):
                await auth.current_user(request_with(AAL1))
        self.assertEqual(self.user_calls, 1)

    async def test_connected_app_token_is_refused_without_a_lookup(self):
        self.use([])
        with self.assertRaises(HTTPException) as caught:
            await auth.current_user(request_with(jwt({"sub": "user-1", "aal": "aal2", "client_id": "app-1"})))
        self.assertEqual(caught.exception.status_code, 403)
        self.assertEqual(caught.exception.headers, {"X-Buck-Error": "connected_app"})
        self.assertEqual(self.user_calls, 0)
        self.assertFalse(auth.is_connected_app(AAL2))
        self.assertFalse(auth.is_connected_app(jwt({"client_id": ""})))

    def test_unreadable_token_counts_as_aal1(self):
        self.assertEqual(auth.token_aal("opaque"), "aal1")
        self.assertEqual(auth.token_aal("a.%%%.c"), "aal1")
        self.assertEqual(auth.token_aal(AAL2), "aal2")
        self.assertFalse(auth.mfa_satisfied("aal1", {"factors": VERIFIED}))
        self.assertTrue(auth.mfa_satisfied("aal1", {"factors": None}))


if __name__ == "__main__":
    unittest.main()
