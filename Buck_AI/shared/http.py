"""One shared async HTTP client per process (connection reuse across requests)."""

import httpx

_client: httpx.AsyncClient | None = None


def get_http() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=10)
    return _client


def set_http(client: httpx.AsyncClient) -> None:
    """Tests inject a client backed by a mock transport."""
    global _client
    _client = client
