"""Environment settings for the Buck_AI service.

Secrets live only in the server environment (Vercel project settings, or a
local `.env` that is git-ignored). Clients never see any of them.
"""

import os
from dataclasses import dataclass
from functools import lru_cache

try:  # Local development only; Vercel injects variables directly.
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    # Tried in order: the first is the primary, the rest are fallbacks for
    # overload (503) or exhausted free quota (429). Each model has its own
    # capacity and per-model quota.
    gemini_models: tuple[str, ...]
    supabase_url: str
    supabase_anon_key: str
    allowed_origins: tuple[str, ...]

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def gemini_model(self) -> str:
        return self.gemini_models[0]


DEFAULT_GEMINI_MODELS = ("gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash")


def _gemini_models() -> tuple[str, ...]:
    """GEMINI_MODELS (comma-separated) wins. Otherwise GEMINI_MODEL, if set, goes
    first and the defaults follow. Duplicates and blanks are dropped."""
    explicit = [m.strip() for m in os.getenv("GEMINI_MODELS", "").split(",") if m.strip()]
    if not explicit:
        primary = os.getenv("GEMINI_MODEL", "").strip()
        explicit = ([primary] if primary else []) + list(DEFAULT_GEMINI_MODELS)
    return tuple(dict.fromkeys(explicit))


@lru_cache
def get_settings() -> Settings:
    origins = os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS)
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_models=_gemini_models(),
        supabase_url=os.getenv("SUPABASE_URL", "").strip().rstrip("/"),
        # The public anon key: every database call runs as the signed-in user
        # under Row-Level Security, so no service-role key is needed here.
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", "").strip(),
        allowed_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
    )
