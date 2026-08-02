"""
Phone number normalization — MediAssist-facing lookups only.

Real `users.mobile` values may be stored as "9812345678", "+919812345678",
or "+91 98123 45678" interchangeably (no format validation at signup).
MediAssist sends E.164. Exact-string phone matching therefore misses real
patients and leads mediassist_inbound.py's whatsapp-bookings flow to create
duplicate patient identities.

This module intentionally does NOT touch the general signup flow — it exists
only to let MediAssist-facing phone comparisons treat equivalent-but-
differently-formatted numbers as the same number.
"""
import re


def normalize_phone(phone: str) -> str:
    """Strip all non-digit characters and return the last 10 digits.

    A reasonable canonical form for Indian mobile numbers: "+919812345678",
    "9812345678", and "+91 98123 45678" all normalize to "9812345678".
    Deliberately does not attempt general international support beyond
    this — out of scope for what MediAssist-facing lookups need.
    """
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    return digits[-10:] if len(digits) >= 10 else digits
