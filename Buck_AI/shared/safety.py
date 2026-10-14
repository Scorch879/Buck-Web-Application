"""Text hygiene for anything that reaches Gemini or comes back from it."""

import re

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PH_MOBILE = re.compile(r"(?:\+?63|0)9\d{2}[\s\-]?\d{3}[\s\-]?\d{4}")
_LONG_NUMBER = re.compile(r"\b\d(?:[\s\-]?\d){8,}\b")  # account / card numbers: 9+ digits
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def scrub_pii(text: str) -> str:
    """Redacts emails, PH mobile numbers and long account/card numbers."""
    text = _EMAIL.sub("[email]", text)
    text = _PH_MOBILE.sub("[phone]", text)
    return _LONG_NUMBER.sub("[number]", text)


def clean_text(value: object, max_chars: int) -> str:
    """Normalises user-controlled text before it reaches Gemini: drops control
    characters and angle brackets (so it cannot forge the <financial_data>
    fence), scrubs PII and caps the length."""
    if not isinstance(value, str):
        return ""
    text = _CONTROL.sub("", value).replace("<", " ").replace(">", " ").strip()
    return scrub_pii(text)[:max_chars]


def limit_sentences(text: str, count: int) -> str:
    """Keeps at most `count` sentences; models occasionally run long."""
    sentences = [s for s in _SENTENCE_SPLIT.split(text.strip()) if s]
    return " ".join(sentences[:count])
