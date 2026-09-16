"""
CallMedex — Intern Account Verification Bypass Script
======================================================
Testing-phase utility to instantly verify and activate intern accounts
so they appear in the patient-facing directory (walk-in, teleconsult, etc.).

Usage:
    python backend/verify_intern_account.py

The script will interactively ask for:
  1. Role (doctor, organization, nurse, phlebotomist, pharmacy, etc.)
  2. Email address of the account to verify

It then:
  - Looks up the user by email
  - Confirms the account details before proceeding
  - Sets verification_status = "verified" on the role table, users table,
    and provider_directory table
  - Ensures provider_settings.is_listed = true so the account appears in search
  - Leaves an audit trail in the documents table

This script ONLY touches the verification_status and is_listed fields.
It does NOT modify any other user data, bookings, or workflows.
"""

import os
import sys
import json
from datetime import datetime, timezone

# ── Setup path and env ───────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.database import get_supabase_client

# ── Role → table mapping (mirrors VerificationService.VERIFICATION_RULES) ──
ROLE_CONFIG = {
    "doctor": {
        "table": "doctors",
        "display": "Doctor",
        "name_field": "full_name",
        "id_field": "medical_license_number",
        "extra_fields": ["specialization", "qualification"],
    },
    "organization": {
        "table": "organizations",
        "display": "Organization / Clinic / Hospital",
        "name_field": "organization_name",
        "id_field": "license_number",
        "extra_fields": ["organization_type"],
    },
    "phlebotomist": {
        "table": "phlebotomists",
        "display": "Phlebotomist (Lab Collector)",
        "name_field": "full_name",
        "id_field": "certification_number",
        "extra_fields": ["phleb_type", "qualification"],
    },
    "nurse": {
        "table": "nurses",
        "display": "Nurse",
        "name_field": "full_name",
        "id_field": "nursing_license_number",
        "extra_fields": ["qualification"],
    },
    "pharmacy": {
        "table": "pharmacies",
        "display": "Pharmacy",
        "name_field": "pharmacy_name",
        "id_field": "drug_license_number",
        "extra_fields": ["pharmacy_type", "registration_number"],
    },
    "dentist": {
        "table": "dentists",
        "display": "Dentist",
        "name_field": "full_name",
        "id_field": "dental_license_number",
        "extra_fields": ["qualification"],
    },
    "dietitian": {
        "table": "dietitians",
        "display": "Dietitian",
        "name_field": "full_name",
        "id_field": "dietitian_license_number",
        "extra_fields": ["qualification"],
    },
    "physiotherapist": {
        "table": "physiotherapists",
        "display": "Physiotherapist",
        "name_field": "full_name",
        "id_field": "physio_license_number",
        "extra_fields": ["qualification"],
    },
    "staff": {
        "table": "staff",
        "display": "Staff (Front-desk / Receptionist)",
        "name_field": "full_name",
        "id_field": "staff_role",
        "extra_fields": ["department", "linked_organization_id"],
    },
}


def main():
    print()
    print("=" * 64)
    print("  CallMedex - Intern Account Verification Tool")
    print("  (Testing Phase - Bypass Verification Pipeline)")
    print("=" * 64)
    print()

    # ── Step 1: Select Role ─────────────────────────────────────────────
    roles = list(ROLE_CONFIG.keys())
    print("Available roles:")
    for i, role in enumerate(roles, 1):
        cfg = ROLE_CONFIG[role]
        print(f"  {i}. {cfg['display']} ({role})")
    print()

    while True:
        choice = input("Select role number: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(roles):
            selected_role = roles[int(choice) - 1]
            break
        print(f"  Invalid choice. Enter a number from 1 to {len(roles)}.")

    cfg = ROLE_CONFIG[selected_role]
    print(f"\n  Selected: {cfg['display']}\n")

    # ── Step 2: Enter Email ─────────────────────────────────────────────
    email = input("Enter the account email: ").strip().lower()
    if not email or "@" not in email:
        print("  ERROR: Invalid email address.")
        sys.exit(1)

    # ── Step 3: Look up the user ────────────────────────────────────────
    print(f"\n  Looking up '{email}' ...")
    supabase = get_supabase_client()

    # Find user in users table
    user_res = (
        supabase.table("users")
        .select("id, email, full_name, phone, role, city, state, district, verification_status")
        .eq("email", email)
        .execute()
    ).data or []

    if not user_res:
        print(f"  ERROR: No user found with email '{email}'.")
        print("  Make sure the intern has completed registration first.")
        sys.exit(1)

    # If multiple users match (shouldn't happen), pick the one with matching role
    user = None
    for u in user_res:
        if u.get("role") == selected_role:
            user = u
            break
    if not user:
        # Fall back to first result
        user = user_res[0]
        actual_role = user.get("role", "unknown")
        if actual_role != selected_role:
            print(f"  WARNING: User's actual role is '{actual_role}', not '{selected_role}'.")
            confirm = input(f"  Continue verifying as '{actual_role}' instead? (y/n): ").strip().lower()
            if confirm != "y":
                sys.exit(0)
            # Switch to the actual role config if we have it
            if actual_role in ROLE_CONFIG:
                selected_role = actual_role
                cfg = ROLE_CONFIG[selected_role]
            else:
                print(f"  ERROR: Role '{actual_role}' is not a provider role that needs verification.")
                sys.exit(1)

    user_id = user["id"]
    current_status = user.get("verification_status", "unknown")

    # ── Step 4: Fetch role-specific profile ─────────────────────────────
    profile = None
    try:
        profile_res = (
            supabase.table(cfg["table"])
            .select("*")
            .eq("user_id", user_id)
            .execute()
        ).data
        if profile_res:
            profile = profile_res[0]
    except Exception as e:
        print(f"  WARNING: Could not fetch {cfg['table']} profile: {e}")

    # ── Step 5: Display account details for confirmation ────────────────
    print()
    print("-" * 50)
    print("  ACCOUNT DETAILS")
    print("-" * 50)
    print(f"  User ID:     {user_id}")
    print(f"  Email:       {user.get('email')}")
    print(f"  Name:        {user.get('full_name', 'N/A')}")
    print(f"  Phone:       {user.get('phone', 'N/A')}")
    print(f"  Role:        {selected_role}")
    print(f"  Location:    {user.get('city', 'N/A')}, {user.get('state', 'N/A')}")
    print(f"  Current Status: {current_status}")

    if profile:
        name_val = profile.get(cfg["name_field"], "N/A")
        id_val = profile.get(cfg["id_field"], "N/A")
        print(f"  Profile Name: {name_val}")
        print(f"  License/ID:   {id_val}")
        for extra in cfg["extra_fields"]:
            print(f"  {extra}: {profile.get(extra, 'N/A')}")
        profile_status = profile.get("verification_status", "unknown")
        print(f"  Profile Verification: {profile_status}")

    print("-" * 50)

    if current_status == "verified":
        print("\n  This account is ALREADY VERIFIED.")
        reconfirm = input("  Re-run verification anyway? (y/n): ").strip().lower()
        if reconfirm != "y":
            print("  Exiting — no changes made.")
            sys.exit(0)

    # ── Step 6: Confirm before proceeding ───────────────────────────────
    print()
    confirm = input("  Verify this account and make it LIVE? (y/n): ").strip().lower()
    if confirm != "y":
        print("  Cancelled — no changes made.")
        sys.exit(0)

    # ── Step 7: Apply verification ──────────────────────────────────────
    now = datetime.now(timezone.utc).isoformat()
    errors = []
    successes = []

    # 7a. Update role table
    try:
        supabase.table(cfg["table"]).update({
            "verification_status": "verified",
        }).eq("user_id", user_id).execute()
        successes.append(f"{cfg['table']}.verification_status = verified")
    except Exception as e:
        errors.append(f"Failed to update {cfg['table']}: {e}")

    # 7b. Update users table
    try:
        supabase.table("users").update({
            "verification_status": "verified",
        }).eq("id", user_id).execute()
        successes.append("users.verification_status = verified")
    except Exception as e:
        errors.append(f"Failed to update users: {e}")

    # 7c. Update provider_directory (if row exists)
    try:
        supabase.table("provider_directory").update({
            "verification_status": "verified",
        }).eq("user_id", user_id).execute()
        successes.append("provider_directory.verification_status = verified")
    except Exception as e:
        # Not all roles have a provider_directory row — that's okay
        pass

    # 7d. Ensure provider_settings.is_listed = true (so they appear in search)
    try:
        supabase.table("provider_settings").upsert({
            "provider_user_id": user_id,
            "is_listed": True,
        }).execute()
        successes.append("provider_settings.is_listed = true")
    except Exception as e:
        errors.append(f"Failed to upsert provider_settings: {e}")

    # 7e. Insert audit trail document
    try:
        supabase.table("documents").insert({
            "id": str(__import__("uuid").uuid4()),
            "user_id": user_id,
            "document_type": "verification_report",
            "file_url": "",
            "file_name": "testing_phase_bypass.json",
            "verification_status": "verified",
            "verification_notes": json.dumps({
                "pipeline": "testing_bypass",
                "role": selected_role,
                "email": email,
                "bypassed_at": now,
                "reason": "Testing phase — intern account activated for end-to-end feature validation",
            }),
            "uploaded_at": now,
        }).execute()
        successes.append("Audit trail logged in documents table")
    except Exception as e:
        # Non-critical — don't block on this
        pass

    # ── Step 8: Report results ──────────────────────────────────────────
    print()
    print("=" * 50)
    if errors:
        print("  PARTIAL SUCCESS (some updates failed)")
    else:
        print("  VERIFICATION COMPLETE")
    print("=" * 50)

    for s in successes:
        print(f"  [OK] {s}")
    for e in errors:
        print(f"  [!!] {e}")

    print()
    print(f"  Account '{email}' is now VERIFIED and LISTED.")
    print(f"  It will appear in the CallMedex patient directory.")
    print()
    print("  Tip: The intern can now log in and their profile")
    print("  will be visible to patients for booking.")
    print()


if __name__ == "__main__":
    main()
