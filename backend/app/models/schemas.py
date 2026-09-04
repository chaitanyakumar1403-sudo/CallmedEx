"""
Pydantic schemas for all CallMedex roles and entities.
Next-Gen: Universal provider support, legal document workflow, nurse role.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, date, time
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    PHLEBOTOMIST = "phlebotomist"
    ORGANIZATION = "organization"
    STAFF = "staff"
    PHARMACY = "pharmacy"
    NURSE = "nurse"
    DIETITIAN = "dietitian"
    PHYSIOTHERAPIST = "physiotherapist"
    DENTIST = "dentist"
    AMBULANCE = "ambulance"
    ADMIN = "admin"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class PhlebType(str, Enum):
    PART_TIME = "part_time"
    FULL_TIME = "full_time"


class OrgType(str, Enum):
    CLINIC = "clinic"
    POLYCLINIC = "polyclinic"
    HOSPITAL = "hospital"
    DIAGNOSTIC_CENTER = "diagnostic_center"
    DENTAL_CLINIC = "dental_clinic"
    PHYSIOTHERAPY_CENTER = "physiotherapy_center"
    NURSING_HOME = "nursing_home"


class OwnershipType(str, Enum):
    PRIVATE = "private"
    PARTNERSHIP = "partnership"
    SOLE_PROPRIETORSHIP = "sole_proprietorship"


class PharmacyType(str, Enum):
    RETAIL = "retail"
    HOSPITAL = "hospital"
    CLINIC = "clinic"


class WorkSetting(str, Enum):
    SOLO_CLINIC = "solo_clinic"
    POLYCLINIC = "polyclinic"
    HOSPITAL = "hospital"


class ConsultationMode(str, Enum):
    IN_PERSON = "in_person"
    ONLINE = "online"
    BOTH = "both"
    HOME_VISIT = "home_visit"


class BookingStatus(str, Enum):
    PENDING = "pending"
    PENDING_REVIEW = "pending_review"  # Patient booked date, org must allot time
    SLOT_ALLOTTED = "slot_allotted"    # Org allotted a time slot, awaiting patient response
    SLOT_ACCEPTED = "slot_accepted"    # Patient accepted the allotted slot
    SLOT_REJECTED = "slot_rejected"    # Patient declined the allotted slot
    SEARCHING = "searching"
    PROVIDER_NOTIFIED = "provider_notified"
    PROVIDER_ACCEPTED = "provider_accepted"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class RegistrantRole(str, Enum):
    FRONT_DESK_MANAGER = "front_desk_manager"
    GENERAL_MANAGER = "general_manager"
    ADMIN_STAFF = "admin_staff"
    OWNER = "owner"
    OTHER = "other"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    FLAGGED = "flagged"
    REJECTED = "rejected"


class ServiceType(str, Enum):
    LAB_TEST = "lab_test"
    IMAGING = "imaging"
    HEALTH_PACKAGE = "health_package"
    VIDEO_CONSULT = "video_consult"
    HOME_COLLECTION = "home_collection"
    DOCTOR_APPOINTMENT = "doctor_appointment"
    NURSE_VISIT = "nurse_visit"
    AMBULANCE = "ambulance"
    PHARMACY_DELIVERY = "pharmacy_delivery"
    PHYSIOTHERAPY = "physiotherapy"
    HOME_VISIT = "home_visit"
    NURSING_CARE = "nursing_care"
    MEDICINE_DELIVERY = "medicine_delivery"
    PROCEDURE = "procedure"
    CONSULTATION = "consultation"


class DispatchStatus(str, Enum):
    SEARCHING = "searching"
    PROVIDER_NOTIFIED = "provider_notified"
    PROVIDER_ACCEPTED = "provider_accepted"
    EN_ROUTE = "en_route"
    ARRIVED = "arrived"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_PROVIDER = "no_provider"


class NursingService(str, Enum):
    WOUND_DRESSING = "wound_dressing"
    INJECTION = "injection"
    IV_INFUSION = "iv_infusion"
    POST_OPERATIVE = "post_operative"
    CATHETER_CARE = "catheter_care"
    ELDERLY_CARE = "elderly_care"
    PEDIATRIC = "pediatric"
    ICU = "icu"
    GENERAL = "general"


class ConnectorType(str, Enum):
    MOCDOC = "mocdoc"
    CRELIO = "crelio"
    CLOUDLIMS = "cloudlims"
    FUTURE_CONNECTOR = "future_connector"
    PATIENT_UPLOAD = "patient_upload"
    MANUAL = "manual"


class ReportJobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    DELIVERED = "delivered"
    FAILED = "failed"
    EXPIRED = "expired"



# ─── Common / Auth ────────────────────────────────────────────────────────

class AddressInfo(BaseModel):
    address: str = ""
    city: str = ""
    district: str = ""
    state: str = ""
    pincode: str = ""
    country: str = "India"


class UserBase(BaseModel):
    full_name: str
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    email: EmailStr
    mobile: str
    role: UserRole
    address_info: AddressInfo = AddressInfo()


class UserSignup(UserBase):
    password: str = Field(min_length=8)
    confirm_password: str

    # Patient-specific (optional, sent only for patient role)
    medical_history: Optional[List[str]] = None
    blood_group: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    preferred_language: Optional[str] = "en"

    # Doctor-specific (consultation_fee REMOVED — managed by platform)
    medical_license_number: Optional[str] = None
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    years_of_experience: Optional[int] = None
    hospital_clinic_name: Optional[str] = None
    available_timings: Optional[str] = None
    consultation_mode: Optional[ConsultationMode] = None
    available_for_online: Optional[bool] = None
    languages_spoken: Optional[List[str]] = None
    is_independent: Optional[bool] = None
    service_area: Optional[str] = None
    work_setting: Optional[str] = None  # solo_clinic | polyclinic | hospital

    # Phlebotomist-specific
    phleb_type: Optional[PhlebType] = None
    certification_number: Optional[str] = None

    # Organization-specific
    organization_name: Optional[str] = None
    organization_type: Optional[OrgType] = None
    license_number: Optional[str] = None
    establishment_year: Optional[int] = None
    ownership_type: Optional[OwnershipType] = None
    head_of_institution: Optional[str] = None
    total_departments: Optional[int] = None
    total_staff: Optional[int] = None
    total_doctors: Optional[int] = None
    total_branches: Optional[int] = None
    accreditation_number: Optional[str] = None
    test_catalog_summary: Optional[str] = None
    operating_hours: Optional[str] = None
    alternate_phone: Optional[str] = None
    emergency_phone: Optional[str] = None

    # Staff-specific
    linked_organization_id: Optional[str] = None
    staff_role: Optional[str] = None
    department: Optional[str] = None

    # Pharmacy-specific
    pharmacy_name: Optional[str] = None
    pharmacy_type: Optional[PharmacyType] = None
    owner_name: Optional[str] = None
    pharmacist_in_charge: Optional[str] = None
    years_of_operation: Optional[int] = None
    registration_number: Optional[str] = None
    drug_license_number: Optional[str] = None
    gst_number: Optional[str] = None
    home_delivery: Optional[bool] = None
    available_24x7: Optional[bool] = None
    service_radius_km: Optional[float] = None

    # Nurse-specific
    nursing_license_number: Optional[str] = None
    nursing_specializations: Optional[List[str]] = None

    # Dietitian-specific
    dietitian_license_number: Optional[str] = None
    dietitian_specializations: Optional[List[str]] = None

    # Physiotherapist-specific
    physio_license_number: Optional[str] = None
    physio_specializations: Optional[List[str]] = None

    # Dentist-specific
    dental_license_number: Optional[str] = None
    dental_specializations: Optional[List[str]] = None
    clinic_name: Optional[str] = None

    # Selected Scope of Services & Custom Tariffs
    scope_of_services: Optional[List[dict]] = None

    # MOU acceptance (kept for backward compat, but now handled via email workflow)
    mou_accepted: Optional[bool] = None

    # Registrant info (non-patient roles) — who is filling out this form
    registrant_role: Optional[str] = None  # front_desk_manager, general_manager, admin_staff, owner, other
    owner_email: Optional[str] = None  # Owner's email for MOU delivery (if different from registrant)
    official_email: Optional[EmailStr] = None

    @field_validator("gender", mode="before")
    @classmethod
    def clean_gender(cls, v):
        if v == "" or v is None or v == "null":
            return None
        return v

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def clean_dob(cls, v):
        if v == "" or v is None or v == "null":
            return None
        return v

    @model_validator(mode="after")
    def validate_role_demographics(self):
        # Individual practitioners & patients require gender and date_of_birth
        individual_roles = {
            UserRole.PATIENT,
            UserRole.DOCTOR,
            UserRole.NURSE,
            UserRole.PHLEBOTOMIST,
            UserRole.DIETITIAN,
            UserRole.PHYSIOTHERAPIST,
            UserRole.DENTIST,
        }
        if self.role in individual_roles:
            if not self.gender:
                raise ValueError("gender is required for individual practitioner and patient registrations")
            if not self.date_of_birth:
                raise ValueError("date_of_birth is required for individual practitioner and patient registrations")
        return self


class ScopeOfServiceItem(BaseModel):
    id: str
    category: str
    service_name: str
    modality: str  # online | clinic | home | hybrid
    benchmark_price: float
    custom_price: float
    platform_fee_pct: float = 20.0
    platform_fee_amount: float
    provider_share_amount: float
    is_active: bool = True


class ProviderScopeUpdateRequest(BaseModel):
    scope_of_services: List[dict]
    consultation_fee: Optional[float] = None
    home_visit_fee: Optional[float] = None
    available_for_online: Optional[bool] = None
    available_for_home_visit: Optional[bool] = None



class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8)
    confirm_password: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
    confirm_password: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None


class SendOTPRequest(BaseModel):
    phone: str = Field(..., description="E.164 phone number or 10-digit mobile, e.g. +919876543210")
    role: Optional[UserRole] = UserRole.PATIENT


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., description="Phone number that received the OTP")
    otp: str = Field(..., min_length=4, max_length=8, description="OTP code received via SMS")
    full_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.PATIENT


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Valid CallMedex refresh token")


class BiometricRegisterRequest(BaseModel):
    device_id: str = Field(..., description="Unique client hardware or app-installation UUID")
    public_key: str = Field(..., description="Base64-encoded public key generated on device secure enclave")
    platform: str = Field("ios", description="'ios' or 'android'")
    device_name: Optional[str] = ""


class BiometricChallengeRequest(BaseModel):
    device_id: str = Field(..., description="Unique device ID for challenge request")


class BiometricChallengeResponse(BaseModel):
    challenge: str
    expires_at: str


class BiometricVerifyRequest(BaseModel):
    device_id: str = Field(..., description="Device ID associated with public key")
    signature: str = Field(..., description="Signature of the challenge signed by device private key")
    challenge: str = Field(..., description="Active server challenge received previously")


class DeviceTokenRegisterRequest(BaseModel):
    push_token: str = Field(..., description="FCM or APNs device push token")
    platform: str = Field("android", description="'ios' | 'android' | 'web'")
    device_name: Optional[str] = ""
    app_version: Optional[str] = "1.0.0"


class DeviceTokenUnregisterRequest(BaseModel):
    push_token: str



class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    mobile: str
    role: UserRole
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    city: str = ""
    state: str = ""
    created_at: Optional[datetime] = None


# ─── Legal Documents ──────────────────────────────────────────────────────

class LegalDocumentResponse(BaseModel):
    id: str
    document_type: str
    version: str
    title: str
    content_text: Optional[str] = None
    content_url: Optional[str] = None
    effective_date: date


class MOUAcceptRequest(BaseModel):
    token: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class MOUPreviewResponse(BaseModel):
    document: LegalDocumentResponse
    user_email: str
    user_role: str
    expires_at: Optional[str] = None


# ─── Booking ──────────────────────────────────────────────────────────────

class SlotResponse(BaseModel):
    id: str
    provider_id: str
    provider_type: str
    date: date
    start_time: time
    end_time: time
    is_available: bool
    capacity: int = 1


class BookingCreate(BaseModel):
    provider_id: str
    provider_type: str  # "organization" or "doctor"
    service_type: ServiceType
    slot_id: str
    notes: Optional[str] = None
    selected_tests: Optional[List[str]] = None  # Multi-test selection for diagnostics/home collection
    total_price: Optional[float] = None  # Computed total for multi-test bookings
    preferred_date: Optional[str] = None  # For diagnostic bookings — patient picks date only
    # Partner-blind diagnostics: the lab/diagnostics flow no longer lets the
    # patient choose a centre, so it cannot send provider_id. These let the
    # booking router resolve the allocation itself via MarketplaceService —
    # catalog_id when the patient came from a specific test search, query as
    # a name-match fallback for the generic multi-test picker, city/home to
    # scope the match. All optional: every other booking flow ignores them.
    catalog_id: Optional[str] = None
    query: Optional[str] = None
    city: Optional[str] = None
    # State → District picker value. Written to bookings.collection_district
    # for home-collection bookings so processing-centre resolution can match
    # at district level when the patient's town isn't an exact city row.
    district: Optional[str] = None
    home: Optional[bool] = None
    # Family member booking: when provided, this booking is for that family member
    # and their address should be used for phlebotomist dispatch.
    family_member_id: Optional[str] = None
    collection_lat: Optional[float] = None
    collection_lng: Optional[float] = None
    collection_address: Optional[str] = None
    # How this appointment is delivered. Providers who work more than one way
    # (a physiotherapist takes teleconsults, home visits AND walk-ins at their
    # centre) need the patient's choice carried through: a home_visit booking
    # has to raise a dispatch to that provider, an in_person one must not.
    consultation_mode: Optional[str] = None  # in_person | online | home_visit


class SlotAllotment(BaseModel):
    """Organization allots a specific time slot to a pending diagnostic booking."""
    allotted_start_time: str  # HH:MM format
    allotted_end_time: str    # HH:MM format
    message: Optional[str] = None  # Optional message to patient


class SlotAllotmentResponse(BaseModel):
    """Patient responds to an allotted slot."""
    accepted: bool
    reason: Optional[str] = None  # If rejected, optional reason


class BookingResponse(BaseModel):
    id: str
    patient_id: str
    provider_id: str
    provider_type: str
    service_type: ServiceType
    slot_start: datetime
    slot_end: datetime
    status: BookingStatus
    notes: Optional[str] = None
    created_at: datetime


# ─── Health Packages ──────────────────────────────────────────────────────

class HealthPackageResponse(BaseModel):
    id: str
    name: str
    description: str
    tests_included: List[str]
    price: float
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None


# ─── Consent (DPDP) ──────────────────────────────────────────────────────

class ConsentRecord(BaseModel):
    consent_type: str  # "data_processing", "health_records", "marketing"
    consent_given: bool
    consent_text: str


class ConsentResponse(BaseModel):
    id: str
    user_id: str
    consent_type: str
    consent_given: bool
    granted_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None


# ─── Dispatch ─────────────────────────────────────────────────────────────

class DispatchRequest(BaseModel):
    provider_type: str  # 'nurse', 'phlebotomist', 'doctor', 'ambulance'
    service_subtype: Optional[str] = None  # e.g. 'wound_dressing', 'blood_collection'
    patient_lat: float
    patient_lng: float
    patient_address: str
    patient_address_details: Optional[dict] = None  # {house_number, landmark, apartment, floor}
    notes: str = ""
    booking_id: Optional[str] = None


class DispatchOfferResponse(BaseModel):
    offer_id: str
    dispatch_request_id: str
    patient_address: str
    service_subtype: Optional[str] = None
    distance_km: float
    expires_at: str


# ─── Organization Dashboard ───────────────────────────────────────────────

class OrgPackageCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    tests_included: List[str]
    price: float = Field(..., gt=0)

class OrgTimingsUpdate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    is_open: bool
    open_time: Optional[str] = None
    close_time: Optional[str] = None

class OrgStatsResponse(BaseModel):
    total_bookings: int
    total_revenue: float
    total_patients: int
    total_doctors: int
    total_services: int


# ─── Pharmacy Dashboard ───────────────────────────────────────────────────

class PharmacyInventoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float = Field(..., gt=0)
    stock_quantity: int = Field(..., ge=0)
    category: Optional[str] = "medicine"
    is_prescription_required: bool = False

class PharmacyInventoryUpdate(BaseModel):
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    is_prescription_required: Optional[bool] = None

# ─── API Responses ────────────────────────────────────────────────────────

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[str] = None
