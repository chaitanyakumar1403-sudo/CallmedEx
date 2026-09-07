"""
CallMedex Personas & Sandbox Account Guard
===========================================
Provides high-reliability detection for developer test personas,
master role preview accounts, and internal sandbox identities to ensure
they are NEVER exposed to real patients or live clinical dispatch.
"""
from typing import Any, Mapping

MASTER_DEV_EMAIL = "chaitanyakumarf11@gmail.com"
TEST_DOMAIN_SUFFIX = "@callmedex.internal"


def is_test_persona(user_or_dict: Any) -> bool:
    """
    Returns True if the given record belongs to an internal master test persona.
    Handles flat user records, nested {'users': ...} records, and provider objects.
    """
    if not isinstance(user_or_dict, (dict, Mapping)):
        return False

    # Extract user sub-dictionary if nested
    user = user_or_dict.get("users") if isinstance(user_or_dict.get("users"), (dict, Mapping)) else user_or_dict

    email = (user.get("email") or user_or_dict.get("email") or "").strip().lower()
    owner_email = (user.get("owner_email") or user_or_dict.get("owner_email") or "").strip().lower()
    registrant_role = (user.get("registrant_role") or user_or_dict.get("registrant_role") or "").strip().lower()
    role = (user.get("role") or user_or_dict.get("role") or "").strip().lower()

    # Check 1: Dedicated internal domain suffix for master developer personas
    if email.endswith(TEST_DOMAIN_SUFFIX) or email.endswith(".internal") or "@internal." in email or ".internal." in email or "@callmedex.internal" in email:
        return True

    # Check 2: Explicitly stamped registrant_role
    if registrant_role in ("master_persona", "test_persona", "sandbox"):
        return True

    # Check 3: Owned by master developer email (excluding the actual super admin account itself)
    if owner_email == MASTER_DEV_EMAIL.lower() and role != "admin":
        return True

    return False
