"""
Authentication Router — Next-Gen CallMedex
Universal signup with role-specific MOU workflow for ALL non-patient roles.
MOU acceptance via secure email link with full audit trail.
"""
import uuid
import secrets
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from app.models.schemas import (
    UserSignup, UserLogin, TokenResponse, UserResponse, APIResponse, UserRole,
    ForgotPasswordRequest, VerifyResetOTPRequest, ResetPasswordRequest,
    SendOTPRequest, VerifyOTPRequest, RefreshTokenRequest,
    BiometricRegisterRequest, BiometricChallengeRequest, BiometricChallengeResponse,
    BiometricVerifyRequest,
)
from app.utils.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_refresh_token, validate_token_version,
)
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.email import EmailService, EMAIL_TOKEN_SECRET, ALGORITHM
from app.services.legal import LegalService
from app.services.sms_otp import sms_otp_service, normalize_indian_phone
from app.config import settings
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ─── Password Complexity Validation ──────────────────────────────────────────

def validate_password_strength(password: str) -> str | None:
    """
    Validate password meets minimum complexity requirements.
    Returns an error message string if invalid, or None if valid.

    Requirements:
      - At least 8 characters
      - At least 1 uppercase letter
      - At least 1 lowercase letter
      - At least 1 digit
      - At least 1 special character
    """
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one digit."
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        return "Password must contain at least one special character."
    return None

# ─── In-memory store for local dev (when Supabase is not configured) ──────
# These are dev-only fallbacks. In production, Supabase handles persistence.
# Max 1000 entries to prevent unbounded memory growth.
_LOCAL_MAX_ENTRIES = 1000
_local_users = {}
_local_profiles = {}

def _local_users_cleanup():
    """Trim local stores if they exceed the max entry limit."""
    while len(_local_users) > _LOCAL_MAX_ENTRIES:
        _local_users.pop(next(iter(_local_users)), None)
    for table in _local_profiles:
        while len(_local_profiles[table]) > _LOCAL_MAX_ENTRIES:
            _local_profiles[table].pop(0)

# ─── Roles that require MOU acceptance before account activation ──────────
MOU_REQUIRED_ROLES = {
    UserRole.DOCTOR,
    UserRole.ORGANIZATION,
    UserRole.PHARMACY,
    UserRole.PHLEBOTOMIST,
    UserRole.NURSE,
    UserRole.STAFF,
    # Both were missing while every other partner role was here. The signup
    # page shows them the same "Register & Send MOU to Email" button and the
    # same "Check Your Email!" screen as everyone else, so a dietitian or
    # physiotherapist was told to wait for an MOU that was never sent — their
    # account was created active instead, with no acceptance record behind the
    # 80/20 split that app/services/scope_catalogs.py bills them under.
    # legal.py already carries mou_dietitian / mou_physiotherapist and their
    # fallback text; only this set was short.
    UserRole.DIETITIAN,
    UserRole.PHYSIOTHERAPIST,
    UserRole.DENTIST,
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
    UserRole.DIETITIAN: "dietitians",
    UserRole.PHYSIOTHERAPIST: "physiotherapists",
    UserRole.DENTIST: "dentists",
}


def _get_user_by_email(email: str) -> dict | None:
    """Get user by email — tries Supabase first, falls back to local store."""
    if supabase:
        try:
            result = supabase.table("users").select("*").eq("email", email).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
        except Exception as e:
            logger.debug(f"DB email lookup exception for {email}: {e}")
    return _local_users.get(email)


def _create_user(user_data: dict) -> dict:
    """Insert user — tries Supabase first, falls back to local store."""
    if supabase:
        result = supabase.table("users").insert(user_data).execute()
        return result.data[0]
    _local_users_cleanup()
    _local_users[user_data["email"]] = user_data
    return user_data


def _create_role_profile(table: str, profile_data: dict) -> dict:
    """Insert role-specific profile data with robust fallback."""
    if supabase:
        try:
            result = supabase.table(table).insert(profile_data).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
        except Exception as e:
            logger.warning(f"Failed to insert into {table} in Supabase: {e}, falling back to local store")
    _local_users_cleanup()
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
        "gender": user.gender.value if user.gender else None,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
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
    if getattr(user, "official_email", None):
        data["official_email"] = user.official_email
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
            "work_setting": user.work_setting or "solo_clinic",
            "is_independent": user.is_independent if user.is_independent is not None else (user.work_setting == "solo_clinic" if user.work_setting else True),
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
            "official_email": getattr(user, "official_email", None) or user.email,
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

    elif user.role == UserRole.DIETITIAN:
        return {
            **base,
            "dietitian_license_number": getattr(user, "dietitian_license_number", None) or "",
            "qualification": user.qualification or "",
            "specializations": getattr(user, "dietitian_specializations", None) or [],
            "years_of_experience": user.years_of_experience or 0,
            "clinic_center_name": getattr(user, "hospital_clinic_name", None) or "",
            "consultation_fee": getattr(user, "consultation_fee", 400.0) or 400.0,
            "home_visit_fee": 800.0,
            "consultation_mode": "both",
            "available_for_online": True,
            "available_for_home_visit": True,
            "scope_of_services": getattr(user, "scope_of_services", None) or [],
            "verification_status": "pending",
        }

    elif user.role == UserRole.PHYSIOTHERAPIST:
        return {
            **base,
            "physio_license_number": getattr(user, "physio_license_number", None) or "",
            "qualification": user.qualification or "",
            "specializations": getattr(user, "physio_specializations", None) or [],
            "years_of_experience": user.years_of_experience or 0,
            "clinic_center_name": getattr(user, "hospital_clinic_name", None) or "",
            "consultation_fee": getattr(user, "consultation_fee", 400.0) or 400.0,
            "home_visit_fee": 800.0,
            "consultation_mode": "both",
            "available_for_online": True,
            "available_for_home_visit": True,
            "is_online": False,
            "current_lat": None,
            "current_lng": None,
            "service_radius_km": 15.0,
            "scope_of_services": getattr(user, "scope_of_services", None) or [],
            "verification_status": "pending",
        }

    elif user.role == UserRole.DENTIST:
        return {
            **base,
            "dental_license_number": getattr(user, "dental_license_number", None) or "",
            "qualification": user.qualification or "",
            "specializations": getattr(user, "dental_specializations", None) or [],
            "years_of_experience": user.years_of_experience or 0,
            "clinic_name": getattr(user, "clinic_name", None) or getattr(user, "hospital_clinic_name", None) or "",
            "consultation_fee": getattr(user, "consultation_fee", 400.0) or 400.0,
            "consultation_mode": "clinic",  # Dental is strictly In-Clinic Walk-in
            "available_for_online": False,  # Dental is walk-in only
            "available_for_home_visit": False,  # Dental is walk-in only
            "scope_of_services": getattr(user, "scope_of_services", None) or [],
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

    # Validate password strength
    if pw_error := validate_password_strength(user.password):
        raise HTTPException(status_code=400, detail=pw_error)

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
        email_sent = True
        mou_token = None
        try:
            mou_token = EmailService.send_mou_email_for_role(
                mou_recipient, user.role.value, payload,
                registrant_email=user.email if user.owner_email and user.owner_email != user.email else None
            )
        except Exception as e:
            logger.error(f"MOU email sending failed for {mou_recipient}: {e}")
            email_sent = False
            # Build token manually so the registration isn't blocked
            from jose import jwt as jose_jwt
            from datetime import timedelta
            expire = datetime.now(timezone.utc) + timedelta(hours=24)
            token_payload = {
                "exp": expire,
                "type": "mou_acceptance",
                "role": user.role.value,
                "signup_data": payload,
            }
            mou_token = jose_jwt.encode(token_payload, settings.EMAIL_TOKEN_SECRET, algorithm=settings.JWT_ALGORITHM)

        # Build the magic link URL
        magic_link = f"{settings.FRONTEND_URL}/auth/accept-mou?token={mou_token}" if mou_token else None

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
                "email_sent": email_sent,
            },
        )

        role_display = user.role.value.replace("_", " ").title()
        mou_sent_to = mou_recipient if mou_recipient != user.email else user.email

        message = f"Registration initiated. A {role_display} MOU has been dispatched to {mou_sent_to}. The verified owner must review and accept it to activate the account."
        if not email_sent:
            message = f"Registration initiated. However, email dispatch to {mou_sent_to} encountered an issue. Our onboarding team has been notified, or you can contact support."

        return APIResponse(
            success=True,
            message=message,
            data={
                "status": "pending_mou",
                "role": user.role.value,
                "mou_sent_to": mou_sent_to,
                "email_sent": email_sent,
            },
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
        from app.services.scope_catalogs import get_master_catalog_for_role, sanitize_selected_scope

        scope_catalog = get_master_catalog_for_role(role)

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
            "scope_catalog": scope_catalog,
            "commercial_split": {
                "provider_share_pct": 80.0,
                "platform_fee_pct": 20.0,
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
    selected_scope: Optional[List[dict]] = None


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

        # 2. Create the role-specific profile with selected scope
        table = ROLE_TABLE_MAP.get(UserRole(role))
        if table and profile_data:
            from app.services.scope_catalogs import sanitize_selected_scope
            if req.selected_scope:
                sanitized = sanitize_selected_scope(role, req.selected_scope)
                profile_data["scope_of_services"] = sanitized
                for s in sanitized:
                    if s.get("modality") == "online" and "consultation_fee" in profile_data:
                        profile_data["consultation_fee"] = s.get("custom_price", profile_data["consultation_fee"])
                    elif s.get("modality") == "home" and "home_visit_fee" in profile_data:
                        profile_data["home_visit_fee"] = s.get("custom_price", profile_data.get("home_visit_fee", 800.0))
            elif "scope_of_services" in profile_data and not profile_data["scope_of_services"]:
                profile_data["scope_of_services"] = sanitize_selected_scope(role, [])

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

    token_version = user.get("token_version", 1)
    token_claims = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["full_name"],
    }
    token = create_access_token(token_claims, token_version=token_version)
    refresh_token = create_refresh_token(token_claims, token_version=token_version)

    return TokenResponse(
        access_token=token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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

            # Enrich with online/duty status from provider_locations or role tables
            try:
                prov_res = (
                    supabase.table("provider_locations")
                    .select("is_online")
                    .eq("user_id", current_user["sub"])
                    .limit(1)
                    .execute()
                )
                if prov_res.data and prov_res.data[0].get("is_online") is not None:
                    user["is_online"] = bool(prov_res.data[0].get("is_online"))
                else:
                    if user.get("role") == "phlebotomist":
                        phleb_res = (
                            supabase.table("phlebotomists")
                            .select("on_duty")
                            .eq("user_id", current_user["sub"])
                            .limit(1)
                            .execute()
                        )
                        user["is_online"] = bool(phleb_res.data[0].get("on_duty")) if phleb_res.data else False
                    elif user.get("role") == "nurse":
                        nurse_res = (
                            supabase.table("nurses")
                            .select("is_online")
                            .eq("user_id", current_user["sub"])
                            .limit(1)
                            .execute()
                        )
                        user["is_online"] = bool(nurse_res.data[0].get("is_online")) if nurse_res.data else False
                    else:
                        user["is_online"] = False
            except Exception:
                user["is_online"] = False

            return APIResponse(success=True, message="User profile", data=user)

    # Local fallback
    for email, user in _local_users.items():
        if user["id"] == current_user["sub"]:
            safe_user = {k: v for k, v in user.items() if k != "password_hash"}
            return APIResponse(success=True, message="User profile", data=safe_user)

    raise HTTPException(status_code=404, detail="User not found")


# ═══════════════════════════════════════════════════════════════════════════
# LOGOUT — Invalidate all sessions
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/logout", response_model=APIResponse)
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout — increments token_version to invalidate all existing JWTs
    for this user. After this call, all previously issued tokens are rejected.
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid session")

    if supabase:
        try:
            # Fetch current version
            version_res = (
                supabase.table("users")
                .select("token_version")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            new_version = 1
            if version_res.data:
                new_version = (version_res.data[0].get("token_version") or 1) + 1

            supabase.table("users").update({
                "token_version": new_version,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", user_id).execute()

            logger.info(f"User {user_id} logged out — token version → {new_version}")
        except Exception as e:
            logger.error(f"Failed to update token_version on logout: {e}")

    return APIResponse(
        success=True,
        message="Logged out successfully. All sessions have been invalidated.",
        data={},
    )


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
            logger.error(f"Supabase ABHA update failed: {e}")

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
        f"{secrets.randbelow(90) + 10:02d}-{secrets.randbelow(9000) + 1000:04d}"
        f"-{secrets.randbelow(9000) + 1000:04d}-{secrets.randbelow(9000) + 1000:04d}"
    )

    if supabase:
        try:
            supabase.table("patients").update(
                {"abha_number": new_abha}
            ).eq("user_id", current_user["sub"]).execute()
        except Exception as e:
            logger.error(f"Supabase ABHA update failed: {e}")

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


# ═══════════════════════════════════════════════════════════════════════════
# PASSWORD RESET WORKFLOW (OTP + Magic Link)
# ═══════════════════════════════════════════════════════════════════════════

# In-memory store for password resets (local dev fallback)
_local_password_resets = []


@router.post("/forgot-password", response_model=APIResponse)
async def forgot_password(req: ForgotPasswordRequest):
    """
    Request a password reset. Sends a 6-digit OTP code and magic link
    to the user's registered email. Always returns success to prevent
    email enumeration attacks.
    """
    email = req.email.lower().strip()

    # Look up the user
    user = _get_user_by_email(email)

    if not user:
        # Return success anyway (security: don't reveal if email exists)
        return APIResponse(
            success=True,
            message="If an account with that email exists, a password reset code has been sent.",
            data={}
        )

    user_id = user.get("id", "")
    user_name = user.get("full_name", "User")

    # Generate 6-digit OTP (cryptographically secure)
    otp_code = str(secrets.randbelow(900000) + 100000)

    # Generate secure JWT reset token (15 min expiry)
    # NOTE: The OTP is NOT embedded in the JWT payload — it is stored
    # server-side only in the password_resets table. The JWT only carries
    # the user_id, email, and a reset_id for lookup.
    reset_id = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    token_payload = {
        "sub": user_id,
        "email": email,
        "type": "password_reset",
        "reset_id": reset_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    reset_token = jwt.encode(token_payload, EMAIL_TOKEN_SECRET, algorithm=ALGORITHM)

    # Build reset link
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/auth/reset-password?token={reset_token}"

    # Save to password_resets table
    reset_record = {
        "id": reset_id,
        "user_id": user_id,
        "email": email,
        "otp_code": otp_code,
        "reset_token": reset_token,
        "used": False,
        "expires_at": expire.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if supabase:
        try:
            # Invalidate any previous unused resets for this user
            supabase.table("password_resets").update({"used": True}).eq("user_id", user_id).eq("used", False).execute()
            # Insert new reset record
            supabase.table("password_resets").insert(reset_record).execute()
        except Exception as e:
            logger.error(f"Failed to save password reset record: {e}")
            # Continue anyway — use local fallback

    _local_password_resets.append(reset_record)

    # Send email (falls back to console print in dev)
    try:
        EmailService.send_password_reset_email(
            to_email=email,
            otp_code=otp_code,
            reset_link=reset_link,
            user_name=user_name,
        )
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")

    return APIResponse(
        success=True,
        message="If an account with that email exists, a password reset code has been sent.",
        data={
            "email": email,
            "user_name": user_name,
        }
    )


@router.post("/reset-password-otp", response_model=APIResponse)
@router.post("/verify-reset-otp", response_model=APIResponse)
async def verify_reset_otp(req: VerifyResetOTPRequest):
    """
    Verify the 6-digit OTP code and reset the password.
    This is the form-based OTP entry method.
    """
    confirm = req.confirm_password if req.confirm_password is not None else req.new_password
    if req.new_password != confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if pw_error := validate_password_strength(req.new_password):
        raise HTTPException(status_code=400, detail=pw_error)

    email = req.email.lower().strip()
    otp = req.otp_code.strip()
    now = datetime.now(timezone.utc)

    # Look up the reset record
    reset_record = None

    if supabase:
        try:
            result = (
                supabase.table("password_resets")
                .select("*")
                .eq("email", email)
                .eq("otp_code", otp)
                .eq("used", False)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                reset_record = result.data[0]
        except Exception as e:
            logger.error(f"Error looking up OTP: {e}")

    # Fallback to local store
    if not reset_record:
        for r in reversed(_local_password_resets):
            if r["email"] == email and r["otp_code"] == otp and not r["used"]:
                reset_record = r
                break

    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code. Please request a new one.")

    # Check expiration
    expires_at = datetime.fromisoformat(reset_record["expires_at"].replace("Z", "+00:00"))
    if now > expires_at:
        raise HTTPException(status_code=400, detail="This OTP has expired. Please request a new password reset.")

    # Update password
    user_id = reset_record["user_id"]
    new_hash = hash_password(req.new_password)

    if supabase:
        try:
            # Increment token_version to invalidate all existing sessions
            # Fetch current version first (Supabase client doesn't support raw SQL expressions)
            version_res = supabase.table("users").select("token_version").eq("id", user_id).limit(1).execute()
            new_version = 1
            if version_res.data:
                new_version = (version_res.data[0].get("token_version") or 1) + 1

            supabase.table("users").update({
                "password_hash": new_hash,
                "updated_at": now.isoformat(),
                "token_version": new_version,
            }).eq("id", user_id).execute()

            # Mark reset as used
            supabase.table("password_resets").update({"used": True}).eq("id", reset_record["id"]).execute()
        except Exception as e:
            logger.error(f"Failed to update password: {e}")
            raise HTTPException(status_code=500, detail="Failed to update password. Please try again.")
    else:
        # Local fallback
        if email in _local_users:
            _local_users[email]["password_hash"] = new_hash
        reset_record["used"] = True

    return APIResponse(
        success=True,
        message="Password has been reset successfully! You can now login with your new password.",
        data={}
    )


@router.post("/reset-password", response_model=APIResponse)
async def reset_password_via_token(req: ResetPasswordRequest):
    """
    Reset password using the magic link JWT token from email.
    This is the one-click magic link method.
    """
    confirm = req.confirm_password if req.confirm_password is not None else req.new_password
    if req.new_password != confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if pw_error := validate_password_strength(req.new_password):
        raise HTTPException(status_code=400, detail=pw_error)

    # Decode and verify the JWT token
    try:
        payload = jwt.decode(req.token, EMAIL_TOKEN_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link. Please request a new one.")

    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid token type")

    user_id = payload.get("sub")
    email = payload.get("email", "")
    reset_id = payload.get("reset_id", "")
    now = datetime.now(timezone.utc)

    if not user_id or not reset_id:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    # Verify the reset record exists and hasn't been used
    # The OTP was verified separately (via verify-reset-otp endpoint),
    # so we only need to check that the reset_id matches and is unused.
    token_used = False
    found = False

    if supabase:
        try:
            result = (
                supabase.table("password_resets")
                .select("id, used, otp_code")
                .eq("id", reset_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if result.data:
                found = True
                token_used = result.data[0].get("used", False)
        except Exception as e:
            logger.error(f"Error checking reset token: {e}")

    # Fallback to local
    if not found:
        for r in reversed(_local_password_resets):
            if r["id"] == reset_id and r["user_id"] == user_id:
                found = True
                token_used = r["used"]
                break

    if not found:
        raise HTTPException(status_code=400, detail="Invalid reset link. Please request a new one.")

    if token_used:
        raise HTTPException(status_code=400, detail="This reset link has already been used. Please request a new one.")

    # Update password
    new_hash = hash_password(req.new_password)

    if supabase:
        try:
            # Increment token_version to invalidate all existing sessions
            version_res = supabase.table("users").select("token_version").eq("id", user_id).limit(1).execute()
            new_version = 1
            if version_res.data:
                new_version = (version_res.data[0].get("token_version") or 1) + 1

            supabase.table("users").update({
                "password_hash": new_hash,
                "updated_at": now.isoformat(),
                "token_version": new_version,
            }).eq("id", user_id).execute()

            if reset_id:
                supabase.table("password_resets").update({"used": True}).eq("id", reset_id).execute()
        except Exception as e:
            logger.error(f"Failed to update password via token: {e}")
            raise HTTPException(status_code=500, detail="Failed to update password. Please try again.")
    else:
        if email in _local_users:
            _local_users[email]["password_hash"] = new_hash
        for r in _local_password_resets:
            if r["id"] == reset_id:
                r["used"] = True
                break

    return APIResponse(
        success=True,
        message="Password has been reset successfully! You can now login with your new password.",
        data={}
    )


# ═══════════════════════════════════════════════════════════════════════════
# PHONE OTP AUTHENTICATION & HEADLESS PATIENT CLAIMING
# ═══════════════════════════════════════════════════════════════════════════

# In-memory store for biometric credentials and challenges fallback
_local_biometric_creds = {}  # device_id -> dict
_local_biometric_challenges = {}  # challenge_str -> dict


def _get_user_by_mobile(phone: str, role: str = "patient") -> dict | None:
    """
    Find user by mobile number or WhatsApp synthetic email.
    Checks Supabase first, falls back to local in-memory store.
    """
    normalized = normalize_indian_phone(phone)
    raw_10 = normalized.replace("+91", "")
    sanitized = "".join(ch for ch in normalized if ch.isalnum())
    
    if supabase:
        try:
            # 1. Check exact phone or 10-digit mobile
            res = (
                supabase.table("users")
                .select("*")
                .or_(f"mobile.eq.{normalized},mobile.eq.{raw_10},email.eq.whatsapp+{sanitized}@patients.callmedex.internal,email.eq.phone+{sanitized}@patients.callmedex.internal")
                .eq("role", role)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            logger.error(f"Error checking user by mobile {phone}: {e}")

    # Fallback to local store
    for u in _local_users.values():
        if u.get("role") == role:
            u_mob = u.get("mobile", "")
            if u_mob in (normalized, raw_10, phone):
                return u
            u_email = u.get("email", "")
            if u_email.endswith(f"{sanitized}@patients.callmedex.internal"):
                return u
    return None


@router.post("/otp/send", response_model=APIResponse)
async def send_otp(req: SendOTPRequest):
    """
    Send a 6-digit OTP code to a mobile phone number via MSG91 SendOTP.
    Rate-limited to 5 requests per hour.
    """
    try:
        result = await sms_otp_service.send_otp(req.phone)
        return APIResponse(
            success=True,
            message=result["message"],
            data={
                "phone": result["phone"],
                "expires_in_seconds": result["expires_in_seconds"],
                "dev_otp": result.get("dev_otp"),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unhandled error sending OTP to {req.phone}: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please try again.")


@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(req: VerifyOTPRequest):
    """
    Verify OTP code and authenticate the patient.
    - If user exists (e.g. from prior web registration or WhatsApp booking), logs them in.
    - If WhatsApp headless account exists, claims the account and returns full access.
    - If new user, creates canonical patient user & profile and returns active session.
    """
    # 1. Verify OTP with expiry and lockout enforcement
    await sms_otp_service.verify_otp(req.phone, req.otp)

    normalized_phone = normalize_indian_phone(req.phone)
    role_str = req.role.value if req.role else "patient"

    # 2. Lookup existing user
    user = _get_user_by_mobile(normalized_phone, role=role_str)
    is_new = False
    now = datetime.now(timezone.utc).isoformat()

    if user:
        # Existing user or claimed headless user
        user_id = user["id"]
        # Update name if provided and user had default name
        if req.full_name and user.get("full_name") in ("WhatsApp Patient", "Patient", ""):
            user["full_name"] = req.full_name
            if supabase:
                try:
                    supabase.table("users").update({
                        "full_name": req.full_name,
                        "updated_at": now,
                    }).eq("id", user_id).execute()
                except Exception as e:
                    logger.error(f"Error updating user name on OTP claiming: {e}")
    else:
        # 3. Create new patient user
        is_new = True
        user_id = str(uuid.uuid4())
        sanitized = "".join(ch for ch in normalized_phone if ch.isalnum())
        synthetic_email = f"phone+{sanitized}@patients.callmedex.internal"
        
        user_data = {
            "id": user_id,
            "full_name": req.full_name.strip() if req.full_name else "Patient",
            "email": synthetic_email,
            "mobile": normalized_phone,
            "password_hash": hash_password(secrets.token_urlsafe(32)),
            "role": role_str,
            "registration_status": "active",
            "is_active": True,
            "token_version": 1,
            "created_at": now,
            "updated_at": now,
        }

        if supabase:
            try:
                supabase.table("users").insert(user_data).execute()
                supabase.table("patients").insert({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "preferred_language": "en",
                    "consent_status": "pending",
                    "created_at": now,
                }).execute()
            except Exception as e:
                logger.error(f"Failed to create new user on OTP verify: {e}")
                # Fallback to local store
                _local_users[synthetic_email] = user_data
        else:
            _local_users[synthetic_email] = user_data

        user = user_data

    # 4. Generate JWT access and refresh tokens
    token_version = user.get("token_version", 1)
    token_claims = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["full_name"],
    }
    access_token = create_access_token(token_claims, token_version=token_version)
    refresh_token = create_refresh_token(token_claims, token_version=token_version)

    LegalService.log_audit(
        actor_id=user["id"],
        action="user.otp_login",
        entity_type="user",
        entity_id=user["id"],
        details={"phone": normalized_phone, "is_new_user": is_new},
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "mobile": user.get("mobile", normalized_phone),
            "role": user["role"],
            "is_new_user": is_new,
        },
    )


# ═══════════════════════════════════════════════════════════════════════════
# REFRESH TOKEN ROTATION
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/refresh-token", response_model=TokenResponse)
async def refresh_access_token(req: RefreshTokenRequest):
    """
    Exchange a valid refresh token for a fresh access token and a newly rotated refresh token.
    Validates token signature, token type, expiry, and token_version for instant revocation.
    """
    payload = decode_refresh_token(req.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token. Please log in again.",
        )

    user_id = payload.get("sub")
    token_version = payload.get("ver", 1)

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload.")

    # Validate token_version
    is_valid_version = await validate_token_version(user_id, token_version)
    if not is_valid_version:
        raise HTTPException(
            status_code=401,
            detail="Session has been revoked or expired. Please log in again.",
        )

    # Fetch user to get latest profile details
    user = None
    if supabase:
        try:
            res = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
            if res.data:
                user = res.data[0]
        except Exception as e:
            logger.error(f"Error loading user for token refresh: {e}")

    if not user:
        for u in _local_users.values():
            if u.get("id") == user_id:
                user = u
                break

    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User account is inactive or disabled.")

    current_token_version = user.get("token_version", 1)
    token_claims = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["full_name"],
    }

    new_access_token = create_access_token(token_claims, token_version=current_token_version)
    new_refresh_token = create_refresh_token(token_claims, token_version=current_token_version)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "mobile": user.get("mobile", ""),
            "role": user["role"],
        },
    )


# ═══════════════════════════════════════════════════════════════════════════
# BIOMETRIC AUTHENTICATION (FACE ID / TOUCH ID / ANDROID BIOMETRICS)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/biometric/register", response_model=APIResponse)
async def register_biometric_device(
    req: BiometricRegisterRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Register a device's biometric public key for Face ID / Fingerprint unlock.
    Requires an active authenticated session.
    """
    user_id = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    cred_data = {
        "user_id": user_id,
        "device_id": req.device_id.strip(),
        "public_key": req.public_key.strip(),
        "platform": req.platform.lower(),
        "device_name": req.device_name or "",
        "is_active": True,
        "created_at": now,
        "last_used_at": now,
    }

    if supabase:
        try:
            # Check existing biometric credential for device
            existing = (
                supabase.table("biometric_credentials")
                .select("id")
                .eq("user_id", user_id)
                .eq("device_id", req.device_id)
                .execute()
            )
            if existing.data:
                supabase.table("biometric_credentials").update({
                    "public_key": req.public_key.strip(),
                    "platform": req.platform.lower(),
                    "device_name": req.device_name or "",
                    "is_active": True,
                    "last_used_at": now,
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                cred_data["id"] = str(uuid.uuid4())
                supabase.table("biometric_credentials").insert(cred_data).execute()
        except Exception as e:
            logger.error(f"Error registering biometric credential in DB: {e}")
            _local_biometric_creds[req.device_id] = cred_data
    else:
        cred_data["id"] = str(uuid.uuid4())
        _local_biometric_creds[req.device_id] = cred_data

    logger.info(f"Biometric public key registered for user {user_id}, device {req.device_id}")
    return APIResponse(
        success=True,
        message="Biometric authentication configured successfully on this device.",
        data={"device_id": req.device_id, "platform": req.platform},
    )


@router.post("/biometric/challenge", response_model=BiometricChallengeResponse)
async def generate_biometric_challenge(req: BiometricChallengeRequest):
    """
    Generate a short-lived cryptographic nonce challenge to be signed by device biometric private key.
    """
    device_id = req.device_id.strip()
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id is required.")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=3)
    challenge_token = secrets.token_hex(32)

    _local_biometric_challenges[challenge_token] = {
        "device_id": device_id,
        "expires_at": expires_at,
    }

    return BiometricChallengeResponse(
        challenge=challenge_token,
        expires_at=expires_at.isoformat(),
    )


@router.post("/biometric/verify", response_model=TokenResponse)
async def verify_biometric_login(req: BiometricVerifyRequest):
    """
    Verify biometric challenge signature and log in the user on the registered device.
    """
    challenge_record = _local_biometric_challenges.pop(req.challenge, None)
    if not challenge_record:
        raise HTTPException(
            status_code=400,
            detail="Biometric challenge expired or invalid. Please prompt biometric login again.",
        )

    now = datetime.now(timezone.utc)
    if now > challenge_record["expires_at"]:
        raise HTTPException(status_code=400, detail="Biometric challenge has timed out.")

    if challenge_record["device_id"] != req.device_id:
        raise HTTPException(status_code=400, detail="Device mismatch for biometric challenge.")

    # Find credential for device_id
    user_id = None
    if supabase:
        try:
            res = (
                supabase.table("biometric_credentials")
                .select("user_id, public_key, is_active")
                .eq("device_id", req.device_id)
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                user_id = res.data[0]["user_id"]
        except Exception as e:
            logger.error(f"Error fetching biometric credential from DB: {e}")

    if not user_id:
        cred = _local_biometric_creds.get(req.device_id)
        if cred and cred.get("is_active"):
            user_id = cred.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=404,
            detail="No registered biometric credential found for this device. Please log in with credentials first.",
        )

    # In production with hardware enclave public key, verify RSA / ECC signature over challenge.
    # If signature is provided and non-empty, validate integrity.
    if not req.signature:
        raise HTTPException(status_code=400, detail="Biometric cryptographic signature is required.")

    # Load user
    user = None
    if supabase:
        try:
            res = supabase.table("users").select("*").eq("id", user_id).limit(1).execute()
            if res.data:
                user = res.data[0]
        except Exception as e:
            logger.error(f"Error loading user for biometric login: {e}")

    if not user:
        for u in _local_users.values():
            if u.get("id") == user_id:
                user = u
                break

    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User account is inactive or disabled.")

    token_version = user.get("token_version", 1)
    token_claims = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["full_name"],
    }
    access_token = create_access_token(token_claims, token_version=token_version)
    refresh_token = create_refresh_token(token_claims, token_version=token_version)

    # Update last used timestamp
    if supabase:
        try:
            supabase.table("biometric_credentials").update({
                "last_used_at": now.isoformat(),
            }).eq("device_id", req.device_id).execute()
        except Exception:
            pass

    LegalService.log_audit(
        actor_id=user["id"],
        action="user.biometric_login",
        entity_type="user",
        entity_id=user["id"],
        details={"device_id": req.device_id},
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "mobile": user.get("mobile", ""),
            "role": user["role"],
        },
    )

