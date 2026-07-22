"""
Authentication Router — Next-Gen CallMedex
Universal signup with role-specific MOU workflow for ALL non-patient roles.
MOU acceptance via secure email link with full audit trail.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from app.models.schemas import (
    UserSignup, UserLogin, TokenResponse, UserResponse, APIResponse, UserRole
)
from app.utils.security import hash_password, verify_password, create_access_token
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.email import EmailService, EMAIL_TOKEN_SECRET, ALGORITHM
from app.services.legal import LegalService
from jose import jwt, JWTError

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ─── In-memory store for local dev (when Supabase is not configured) ──────
_local_users = {}
_local_profiles = {}

# ─── Roles that require MOU acceptance before account activation ──────────
MOU_REQUIRED_ROLES = {
    UserRole.DOCTOR,
    UserRole.ORGANIZATION,
    UserRole.PHARMACY,
    UserRole.PHLEBOTOMIST,
    UserRole.NURSE,
    UserRole.STAFF,
}

# ─── Role-to-table and profile builder mapping ────────────────────────────
ROLE_TABLE_MAP = {
    UserRole.PATIENT: "patients",
    UserRole.DOCTOR: "doctors",
    UserRole.PHLEBOTOMIST: "phlebotomists",
    UserRole.ORGANIZATION: "organizations",
    UserRole.STAFF: "staff",
    UserRole.PHARMACY: "pharmacies",
    UserRole.NURSE: "nurses",
}


def _get_user_by_email(email: str) -> dict | None:
    """Get user by email — tries Supabase first, falls back to local store."""
    if supabase:
        result = supabase.table("users").select("*").eq("email", email).execute()
        if result.data:
            return result.data[0]
        return None
    return _local_users.get(email)


def _create_user(user_data: dict) -> dict:
    """Insert user — tries Supabase first, falls back to local store."""
    if supabase:
        result = supabase.table("users").insert(user_data).execute()
        return result.data[0]
    _local_users[user_data["email"]] = user_data
    return user_data


def _create_role_profile(table: str, profile_data: dict) -> dict:
    """Insert role-specific profile data."""
    if supabase:
        result = supabase.table(table).insert(profile_data).execute()
        return result.data[0]
    if table not in _local_profiles:
        _local_profiles[table] = []
    _local_profiles[table].append(profile_data)
    return profile_data


def _build_user_data(user: UserSignup, user_id: str, registration_status: str = "active") -> dict:
    """Build the common user record from signup data."""
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "id": user_id,
        "full_name": user.full_name,
        "email": user.email,
        "mobile": user.mobile,
        "password_hash": hash_password(user.password),
        "role": user.role.value,
        "gender": user.gender.value,
        "date_of_birth": user.date_of_birth.isoformat(),
        "address": user.address_info.address,
        "city": user.address_info.city,
        "district": user.address_info.district,
        "state": user.address_info.state,
        "pincode": user.address_info.pincode,
        "country": user.address_info.country,
        "registration_status": registration_status,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    # Store registrant role for non-patient signups (audit trail)
    if user.registrant_role:
        data["registrant_role"] = user.registrant_role
    if user.owner_email:
        data["owner_email"] = user.owner_email
    return data


def _build_profile_data(user: UserSignup, user_id: str) -> dict:
    """Build role-specific profile data based on the user's role."""
    profile_id = str(uuid.uuid4())
    base = {"id": profile_id, "user_id": user_id}

    if user.role == UserRole.PATIENT:
        return {
            **base,
            "medical_history": user.medical_history or [],
            "blood_group": user.blood_group or "",
            "height_cm": user.height_cm,
            "weight_kg": user.weight_kg,
            "preferred_language": user.preferred_language or "en",
            "abha_number": None,
            "abha_ref_id": None,
            "consent_status": "pending",
        }

    elif user.role == UserRole.DOCTOR:
        # NOTE: consultation_fee REMOVED — managed by platform settlement
        return {
            **base,
            "medical_license_number": user.medical_license_number or "",
            "specialization": user.specialization or "",
            "qualification": user.qualification or "",
            "years_of_experience": user.years_of_experience or 0,
            "hospital_clinic_name": user.hospital_clinic_name or "",
            "available_timings": user.available_timings or "",
            "consultation_mode": user.consultation_mode.value if user.consultation_mode else "both",
            "available_for_online": user.available_for_online or False,
            "languages_spoken": user.languages_spoken or ["English"],
            "verification_status": "pending",
        }

    elif user.role == UserRole.PHLEBOTOMIST:
        return {
            **base,
            "phleb_type": user.phleb_type.value if user.phleb_type else "full_time",
            "qualification": user.qualification or "",
            "specialization": user.specialization or "",
            "years_of_experience": user.years_of_experience or 0,
            "certification_number": user.certification_number or "",
            "on_duty": False,
            "current_lat": None,
            "current_lng": None,
            "verification_status": "pending",
        }

    elif user.role == UserRole.ORGANIZATION:
        return {
            **base,
            "organization_name": user.organization_name or "",
            "organization_type": user.organization_type.value if user.organization_type else "hospital",
            "license_number": user.license_number or "",
            "establishment_year": user.establishment_year,
            "ownership_type": user.ownership_type.value if user.ownership_type else "private",
            "head_of_institution": user.head_of_institution or "",
            "total_departments": user.total_departments or 0,
            "total_staff": user.total_staff or 0,
            "total_branches": user.total_branches or 1,
            "operating_hours": user.operating_hours or "",
            "alternate_phone": user.alternate_phone or "",
            "emergency_phone": user.emergency_phone or "",
            "verification_status": "pending",
        }

    elif user.role == UserRole.STAFF:
        return {
            **base,
            "linked_organization_id": user.linked_organization_id,
            "staff_role": user.staff_role or "",
            "department": user.department or "",
            "years_of_experience": user.years_of_experience or 0,
            "alternate_phone": user.alternate_phone or "",
            "verification_status": "pending",
        }

    elif user.role == UserRole.PHARMACY:
        return {
            **base,
            "pharmacy_name": user.pharmacy_name or "",
            "pharmacy_type": user.pharmacy_type.value if user.pharmacy_type else "retail",
            "owner_name": user.owner_name or "",
            "pharmacist_in_charge": user.pharmacist_in_charge or "",
            "years_of_operation": user.years_of_operation or 0,
            "operating_hours": user.operating_hours or "",
            "registration_number": user.registration_number or "",
            "drug_license_number": user.drug_license_number or "",
            "gst_number": user.gst_number or "",
            "home_delivery": user.home_delivery or False,
            "available_24x7": user.available_24x7 or False,
            "service_radius_km": user.service_radius_km or 5.0,
            "verification_status": "pending",
        }

    elif user.role == UserRole.NURSE:
        return {
            **base,
            "nursing_license_number": user.nursing_license_number or "",
            "qualification": user.qualification or "",
            "specializations": user.nursing_specializations or [],
            "years_of_experience": user.years_of_experience or 0,
            "is_online": False,
            "current_lat": None,
            "current_lng": None,
            "service_radius_km": 10.0,
            "rating": 5.0,
            "acceptance_rate": 100.0,
            "total_completed": 0,
            "verification_status": "pending",
        }

    return base


# ═══════════════════════════════════════════════════════════════════════════
# SIGNUP — Universal Registration Engine
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/register", response_model=APIResponse)
@router.post("/signup", response_model=APIResponse)
async def signup(user: UserSignup):
    """
    Universal registration endpoint.
    - Patients: Immediate account creation (no MOU required).
    - All other roles: MOU email workflow (account created only after acceptance).
    """
    # Validate passwords match
    if user.password != user.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    # Check if user already exists
    existing = _get_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())

    # ─── MOU WORKFLOW: Non-patient roles get email + deferred creation ──
    if user.role in MOU_REQUIRED_ROLES:
        user_data = _build_user_data(user, user_id, registration_status="pending_mou")
        profile_data = _build_profile_data(user, user_id)

        # Package into JWT for the email magic link
        payload = {
            "user_data": user_data,
            "profile_data": profile_data,
        }

        # Determine MOU recipient: owner_email if provided, else registrant's email
        mou_recipient = user.owner_email if user.owner_email else user.email

        # Send role-specific MOU email and capture token
        mou_token = EmailService.send_mou_email_for_role(
            mou_recipient, user.role.value, payload,
            registrant_email=user.email if user.owner_email and user.owner_email != user.email else None
        )

        # Log the signup attempt
        LegalService.log_audit(
            actor_id=None,
            action="user.signup_initiated",
            entity_type="user",
            entity_id=user_id,
            details={
                "role": user.role.value,
                "email": user.email,
                "owner_email": user.owner_email or user.email,
                "registrant_role": user.registrant_role or "unknown",
                "status": "pending_mou",
            },
        )

        role_display = user.role.value.replace("_", " ").title()
        mou_sent_to = mou_recipient if mou_recipient != user.email else user.email
        return APIResponse(
            success=True,
            message=f"Registration initiated. A {role_display} MOU has been sent to {mou_sent_to}. The owner must review and accept it to activate the account.",
            data={"status": "pending_mou", "role": user.role.value, "mou_sent_to": mou_sent_to, "mou_token": mou_token},
        )

    # ─── IMMEDIATE CREATION: Patient role ──────────────────────────────
    user_data = _build_user_data(user, user_id, registration_status="active")
    _create_user(user_data)

    table = ROLE_TABLE_MAP.get(user.role)
    if table:
        profile_data = _build_profile_data(user, user_id)
        _create_role_profile(table, profile_data)

    LegalService.log_audit(
        actor_id=user_id,
        action="user.registered",
        entity_type="user",
        entity_id=user_id,
        details={"role": user.role.value},
    )

    return APIResponse(
        success=True,
        message=f"Account created successfully as {user.role.value}",
        data={"user_id": user_id, "role": user.role.value},
    )


# ═══════════════════════════════════════════════════════════════════════════
# MOU PREVIEW — Display MOU before acceptance
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/mou/preview")
async def preview_mou(token: str):
    """
    Decode the MOU token and return the legal document content for display.
    The user reads the full MOU on this page before clicking 'I Agree'.
    """
    try:
        payload = jwt.decode(token, EMAIL_TOKEN_SECRET, algorithms=[ALGORITHM])

        if payload.get("type") != "mou_acceptance":
            raise HTTPException(status_code=400, detail="Invalid token type")

        role = payload.get("role", "organization")
        signup_data = payload.get("signup_data", {})
        user_data = signup_data.get("user_data", {})

        # Check if already accepted
        if _get_user_by_email(user_data.get("email", "")):
            return {
                "success": True,
                "already_accepted": True,
                "message": "This account has already been activated.",
            }

        # Get the legal document for this role
        legal_doc = LegalService.get_active_document(role)

        return {
            "success": True,
            "already_accepted": False,
            "document": {
                "id": legal_doc.get("id"),
                "title": legal_doc.get("title"),
                "content_text": legal_doc.get("content_text"),
                "version": legal_doc.get("version", "v1.0"),
                "effective_date": legal_doc.get("effective_date"),
            },
            "user_info": {
                "email": user_data.get("email"),
                "full_name": user_data.get("full_name"),
                "role": role,
            },
        }

    except JWTError:
        raise HTTPException(
            status_code=400,
            detail="This link has expired or is invalid. Please register again.",
        )


# ═══════════════════════════════════════════════════════════════════════════
# MOU ACCEPTANCE — Create account after explicit agreement
# ═══════════════════════════════════════════════════════════════════════════

class AcceptMOURequest(BaseModel):
    token: str
    ip_address: str = "unknown"
    user_agent: str = "unknown"


@router.post("/accept-mou", response_model=APIResponse)
async def accept_mou(req: AcceptMOURequest, request: Request):
    """
    Accept the MOU and activate the account.
    Records IP address, User-Agent, timestamp, and document version for legal compliance.
    """
    try:
        payload = jwt.decode(req.token, EMAIL_TOKEN_SECRET, algorithms=[ALGORITHM])

        if payload.get("type") != "mou_acceptance":
            raise HTTPException(status_code=400, detail="Invalid token type")

        signup_data = payload.get("signup_data")
        if not signup_data:
            raise HTTPException(status_code=400, detail="Corrupted token payload")

        user_data = signup_data.get("user_data")
        profile_data = signup_data.get("profile_data")
        role = payload.get("role", user_data.get("role", "organization"))

        # Extract real IP and user agent from the request if not provided by frontend
        client_ip = req.ip_address
        if client_ip == "unknown":
            client_ip = request.client.host if request.client else "unknown"

        client_ua = req.user_agent
        if client_ua == "unknown":
            client_ua = request.headers.get("user-agent", "unknown")

        # Check if already activated (double-click protection)
        if _get_user_by_email(user_data["email"]):
            return APIResponse(
                success=True,
                message="Account is already active. You can log in now.",
                data={"status": "already_active"},
            )

        # 1. Activate the user — change registration_status to 'active'
        user_data["registration_status"] = "active"
        _create_user(user_data)

        # 2. Create the role-specific profile
        table = ROLE_TABLE_MAP.get(UserRole(role))
        if table and profile_data:
            _create_role_profile(table, profile_data)

        # 3. Record the legal acceptance with full audit trail
        document_id = payload.get("document_id")
        document_version = payload.get("document_version", "v1.0")

        LegalService.complete_acceptance(
            token=req.token,
            user_id=user_data["id"],
            ip_address=client_ip,
            user_agent=client_ua,
        )

        # 4. Audit log
        LegalService.log_audit(
            actor_id=user_data["id"],
            action="mou.accepted",
            entity_type="legal_acceptance",
            entity_id=document_id,
            details={
                "role": role,
                "document_version": document_version,
                "ip_address": client_ip,
                "user_agent": client_ua[:200],  # Truncate for storage
            },
            ip_address=client_ip,
            user_agent=client_ua,
        )

        # 5. Send welcome email
        provider_name = (
            profile_data.get("organization_name")
            or profile_data.get("pharmacy_name")
            or user_data.get("full_name", "Partner")
        )
        EmailService.send_welcome_email(user_data["email"], provider_name, role)

        return APIResponse(
            success=True,
            message="MOU accepted successfully. Your account has been activated!",
            data={
                "status": "active",
                "user_id": user_data["id"],
                "role": role,
                "accepted_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    except JWTError:
        raise HTTPException(
            status_code=400,
            detail="This link has expired. Please register again.",
        )


# ═══════════════════════════════════════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Authenticate user and return JWT token."""
    user = _get_user_by_email(credentials.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check if account is pending MOU
    if user.get("registration_status") == "pending_mou":
        raise HTTPException(
            status_code=403,
            detail="Your account is pending MOU acceptance. Please check your email.",
        )

    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["full_name"],
    })

    return TokenResponse(
        access_token=token,
        user={
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
        },
    )


# ═══════════════════════════════════════════════════════════════════════════
# USER PROFILE
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/me", response_model=APIResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    if supabase:
        result = (
            supabase.table("users")
            .select("*")
            .eq("id", current_user["sub"])
            .execute()
        )
        if result.data:
            user = result.data[0]
            user.pop("password_hash", None)
            return APIResponse(success=True, message="User profile", data=user)

    # Local fallback
    for email, user in _local_users.items():
        if user["id"] == current_user["sub"]:
            safe_user = {k: v for k, v in user.items() if k != "password_hash"}
            return APIResponse(success=True, message="User profile", data=safe_user)

    raise HTTPException(status_code=404, detail="User not found")


# ═══════════════════════════════════════════════════════════════════════════
# ABHA LINKAGE
# ═══════════════════════════════════════════════════════════════════════════

class LinkAbhaRequest(BaseModel):
    abha_number: str


class CreateAbhaRequest(BaseModel):
    aadhaar_number: str
    otp: str


@router.post("/link-abha", response_model=APIResponse)
async def link_abha(req: LinkAbhaRequest, current_user: dict = Depends(get_current_user)):
    """Link an existing ABHA number to the patient's profile."""
    if supabase:
        try:
            supabase.table("patients").update(
                {"abha_number": req.abha_number}
            ).eq("user_id", current_user["sub"]).execute()
        except Exception as e:
            print(f"Supabase ABHA update failed: {e}")

    # Update local fallback
    if "patients" in _local_profiles:
        for profile in _local_profiles["patients"]:
            if profile["user_id"] == current_user["sub"]:
                profile["abha_number"] = req.abha_number
                break

    return APIResponse(
        success=True,
        message="ABHA number linked successfully",
        data={"abha_number": req.abha_number},
    )


@router.post("/create-abha", response_model=APIResponse)
async def create_abha(req: CreateAbhaRequest, current_user: dict = Depends(get_current_user)):
    """Simulate generating a new ABHA number via Aadhaar OTP."""
    import random

    new_abha = (
        f"{random.randint(10, 99)}-{random.randint(1000, 9999)}"
        f"-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
    )

    if supabase:
        try:
            supabase.table("patients").update(
                {"abha_number": new_abha}
            ).eq("user_id", current_user["sub"]).execute()
        except Exception as e:
            print(f"Supabase ABHA update failed: {e}")

    if "patients" in _local_profiles:
        for profile in _local_profiles["patients"]:
            if profile["user_id"] == current_user["sub"]:
                profile["abha_number"] = new_abha
                break

    return APIResponse(
        success=True,
        message="ABHA number created and linked successfully",
        data={"abha_number": new_abha},
    )
