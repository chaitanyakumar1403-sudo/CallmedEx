/**
 * CallMedex Mobile — Application Constants
 * Status labels, colors, role definitions, and business enum mappings.
 * All values derived from backend/app/models/schemas.py enums.
 */
import type { BookingStatus, DispatchStatus, UserRole, ServiceType, ReportJobStatus, VerificationStatus } from '../types/api';

// ─── User Role Labels ─────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  phlebotomist: 'Phlebotomist',
  organization: 'Organization',
  staff: 'Staff',
  pharmacy: 'Pharmacy',
  nurse: 'Nurse',
  ambulance: 'Ambulance',
  admin: 'Admin',
};

export const ROLE_ICONS: Record<UserRole, string> = {
  patient: '🩺',
  doctor: '👨‍⚕️',
  phlebotomist: '💉',
  organization: '🏥',
  staff: '📋',
  pharmacy: '💊',
  nurse: '👩‍⚕️',
  ambulance: '🚑',
  admin: '⚙️',
};

// ─── Booking Status ───────────────────────────────────────────────────────

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  pending_review: 'Under Review',
  slot_allotted: 'Slot Allotted',
  slot_accepted: 'Slot Accepted',
  slot_rejected: 'Slot Rejected',
  searching: 'Finding Provider',
  provider_notified: 'Provider Notified',
  provider_accepted: 'Provider Accepted',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  pending: '#F59E0B',
  pending_review: '#F59E0B',
  slot_allotted: '#3B82F6',
  slot_accepted: '#10B981',
  slot_rejected: '#EF4444',
  searching: '#8B5CF6',
  provider_notified: '#8B5CF6',
  provider_accepted: '#10B981',
  confirmed: '#10B981',
  checked_in: '#06B6D4',
  in_progress: '#3B82F6',
  completed: '#059669',
  cancelled: '#6B7280',
  no_show: '#EF4444',
};

// ─── Dispatch Status ──────────────────────────────────────────────────────

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  searching: 'Finding Provider',
  provider_notified: 'Provider Notified',
  provider_accepted: 'Accepted',
  en_route: 'On the Way',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_provider: 'No Provider Available',
};

export const DISPATCH_STATUS_COLORS: Record<DispatchStatus, string> = {
  searching: '#8B5CF6',
  provider_notified: '#F59E0B',
  provider_accepted: '#10B981',
  en_route: '#3B82F6',
  arrived: '#06B6D4',
  in_progress: '#3B82F6',
  completed: '#059669',
  cancelled: '#6B7280',
  no_provider: '#EF4444',
};

// ─── Service Types ────────────────────────────────────────────────────────

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  lab_test: 'Lab Test',
  imaging: 'Imaging',
  health_package: 'Health Package',
  video_consult: 'Video Consultation',
  home_collection: 'Home Collection',
  doctor_appointment: 'Doctor Appointment',
  nurse_visit: 'Nurse Visit',
  ambulance: 'Ambulance',
  pharmacy_delivery: 'Pharmacy Delivery',
  physiotherapy: 'Physiotherapy',
  home_visit: 'Home Visit',
  nursing_care: 'Nursing Care',
  medicine_delivery: 'Medicine Delivery',
  procedure: 'Procedure',
  consultation: 'Consultation',
};

// ─── Report Job Status ────────────────────────────────────────────────────

export const REPORT_STATUS_LABELS: Record<ReportJobStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  delivered: 'Delivered',
  failed: 'Failed',
  expired: 'Expired',
};

export const REPORT_STATUS_COLORS: Record<ReportJobStatus, string> = {
  queued: '#F59E0B',
  processing: '#3B82F6',
  delivered: '#10B981',
  failed: '#EF4444',
  expired: '#6B7280',
};

// ─── Verification Status ──────────────────────────────────────────────────

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: 'Pending Review',
  verified: 'Verified',
  flagged: 'Flagged',
  rejected: 'Rejected',
};

export const VERIFICATION_STATUS_COLORS: Record<VerificationStatus, string> = {
  pending: '#F59E0B',
  verified: '#10B981',
  flagged: '#F97316',
  rejected: '#EF4444',
};

// ─── Payment Statuses ─────────────────────────────────────────────────────

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  CAPTURED: 'captured',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  captured: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

// ─── Indian Healthcare Constants ──────────────────────────────────────────

export const BLOOD_GROUPS = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
] as const;

export const RELATIONSHIPS = [
  'Self', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter',
  'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Other',
] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
] as const;

// ─── Emergency Numbers (India) ────────────────────────────────────────────

export const EMERGENCY_NUMBERS = {
  NATIONAL_EMERGENCY: '112',
  AMBULANCE: '108',
  WOMEN_HELPLINE: '181',
  POLICE: '100',
} as const;
