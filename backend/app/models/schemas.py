"""
Pydantic schemas for all CallMedex roles and entities.
Next-Gen: Universal provider support, legal document workflow, nurse role.
"""
from pydantic import BaseModel, EmailStr, Field
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


class OwnershipType(str, Enum):
    PRIVATE = "private"
    PARTNERSHIP = "partnership"
    SOLE_PROPRIETORSHIP = "sole_proprietorship"


class PharmacyType(str, Enum):
    RETAIL = "retail"
    HOSPITAL = "hospital"
    CLINIC = "clinic"


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
    gender: Gender
    date_of_birth: date
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

    # MOU acceptance (kept for backward compat, but now handled via email workflow)
    mou_accepted: Optional[bool] = None

    # Registrant info (non-patient roles) — who is filling out this form
    registrant_role: Optional[str] = None  # front_desk_manager, general_manager, admin_staff, owner, other
    owner_email: Optional[str] = None  # Owner's email for MOU delivery (if different from registrant)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    mobile: str
    role: UserRole
    gender: Gender
    date_of_birth: date
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


class SlotAllotment(BaseModel):
    """Organization allots a specific time slot to a pending diagnostic booking."""
    allotted_start_time: str  # HH:MM format
    allotted_end_time: str    # HH:MM format
    message: Optional[str] = None  # Optional message to patient


class SlotResponse(BaseModel):
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
