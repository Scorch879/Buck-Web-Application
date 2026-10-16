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
    gemini_model: str
    gemini_fallback_model: str
    supabase_url: str
    supabase_anon_key: str
    allowed_origins: tuple[str, ...]

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    origins = os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS)
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_model=os.getenv("GEMINI_MODEL", "").strip() or "gemini-3.8-flash",
        # Used when the primary model is overloaded (503) or out of free quota
        # (429): a different model has its own capacity and per-model quota.
        gemini_fallback_model=os.getenv("GEMINI_FALLBACK_MODEL", "").strip() or "gemini-3.7-flash",
        supabase_url=os.getenv("SUPABASE_URL", "").strip().rstrip("/"),
        # The public anon key: every database call runs as the signed-in user
        # under Row-Level Security, so no service-role key is needed here.
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", "").strip(),
        allowed_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
    )
