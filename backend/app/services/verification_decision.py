"""Pure verification matching + decision logic. No I/O — unit-tested."""
import re
from difflib import SequenceMatcher

_HONORIFIC_RE = re.compile(r"\b(m/s|ms|dr|mr|mrs|prof)\b\.?", re.IGNORECASE)

def normalize_identifier(s: str) -> str:
    if not s:
        return ""
    s = _HONORIFIC_RE.sub("", s.lower())
    return re.sub(r"[^a-z0-9]", "", s)

def license_match(stored: str, extracted: str) -> bool:
    a, b = normalize_identifier(stored), normalize_identifier(extracted)
    return bool(a) and bool(b) and a == b

def names_match(stored: str, extracted: str, threshold: float = 0.85) -> bool:
    a, b = normalize_identifier(stored), normalize_identifier(extracted)
    if not a or not b:
        return False
    if a == b:
        return True
    return SequenceMatcher(None, a, b).ratio() >= threshold
