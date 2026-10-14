"""Text hygiene for anything that reaches Gemini or comes back from it."""

import re

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# Bounded parts (RFC 5321 limits) and a lookbehind so a match can only start at
# the beginning of a local-part run: keeps matching linear on inputs like "%%%%...".
_EMAIL = re.compile(r"(?<![A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9\-]{1,63}(?:\.[A-Za-z0-9\-]{1,63}){0,8}\.[A-Za-z]{2,24}")
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
    # Cap before the regexes run so their cost is bounded by max_chars, not by
    # whatever length the client sent (placeholders can grow the text a little).
    text = _CONTROL.sub("", value[: max_chars * 2]).replace("<", " ").replace(">", " ").strip()
    return scrub_pii(text)[:max_chars]


def limit_sentences(text: str, count: int) -> str:
    """Keeps at most `count` sentences; models occasionally run long."""
    sentences = [s for s in _SENTENCE_SPLIT.split(text.strip()) if s]
    return " ".join(sentences[:count])
