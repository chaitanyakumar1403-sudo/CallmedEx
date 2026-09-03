/**
 * CallMedex Mobile API Type Contracts
 * Derived from backend/app/models/schemas.py Pydantic definitions.
 * DO NOT invent types — every interface here mirrors an authoritative backend schema.
 */

// ─── Enums ────────────────────────────────────────────────────────────────

export type UserRole =
  | 'patient'
  | 'doctor'
  | 'phlebotomist'
  | 'organization'
  | 'staff'
  | 'pharmacy'
  | 'nurse'
  | 'ambulance'
  | 'admin';

export type Gender = 'male' | 'female' | 'other';

export type PhlebType = 'part_time' | 'full_time';

export type OrgType =
  | 'clinic'
  | 'polyclinic'
  | 'hospital'
  | 'diagnostic_center'
  | 'dental_clinic'
  | 'physiotherapy_center'
  | 'nursing_home';

export type OwnershipType = 'private' | 'partnership' | 'sole_proprietorship';

export type PharmacyType = 'retail' | 'hospital' | 'clinic';

export type ConsultationMode = 'in_person' | 'online' | 'both' | 'home_visit';

export type BookingStatus =
  | 'pending'
  | 'pending_review'
  | 'slot_allotted'
  | 'slot_accepted'
  | 'slot_rejected'
  | 'searching'
  | 'provider_notified'
  | 'provider_accepted'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type ServiceType =
  | 'lab_test'
  | 'imaging'
  | 'health_package'
  | 'video_consult'
  | 'home_collection'
  | 'doctor_appointment'
  | 'nurse_visit'
  | 'ambulance'
  | 'pharmacy_delivery'
  | 'physiotherapy'
  | 'home_visit'
  | 'nursing_care'
  | 'medicine_delivery'
  | 'procedure'
  | 'consultation';

export type DispatchStatus =
  | 'searching'
  | 'provider_notified'
  | 'provider_accepted'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_provider';

export type ReportJobStatus =
  | 'queued'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'expired';

export type VerificationStatus = 'pending' | 'verified' | 'flagged' | 'rejected';

export type ConnectorType =
  | 'mocdoc'
  | 'crelio'
  | 'cloudlims'
  | 'future_connector'
  | 'patient_upload'
  | 'manual';

export type NursingService =
  | 'wound_dressing'
  | 'injection'
  | 'iv_infusion'
  | 'post_operative'
  | 'catheter_care'
  | 'elderly_care'
  | 'pediatric'
  | 'icu'
  | 'general';

// ─── Common Models ────────────────────────────────────────────────────────

export interface AddressInfo {
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  role: UserRole;
  gender: Gender;
  date_of_birth: string;
  city?: string;
  state?: string;
  created_at?: string;
  registration_status?: string;
  is_active?: boolean;
  avatar_url?: string;
  is_new_user?: boolean;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
  refresh_token?: string;
  expires_in?: number;
}

export interface SendOTPRequest {
  phone: string;
  role?: UserRole;
}

export interface VerifyOTPRequest {
  phone: string;
  otp: string;
  full_name?: string;
  role?: UserRole;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetOTPRequest {
  email: string;
  otp_code: string;
  new_password: string;
  confirm_password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface BiometricRegisterRequest {
  device_id: string;
  public_key: string;
  platform: 'ios' | 'android';
  device_name?: string;
}

export interface BiometricVerifyRequest {
  device_id: string;
  signature: string;
  challenge: string;
}

export interface DeviceTokenRegisterRequest {
  push_token: string;
  platform: 'ios' | 'android' | 'web';
  device_name?: string;
  app_version?: string;
}

// ─── Booking ──────────────────────────────────────────────────────────────

export interface SlotResponse {
  id: string;
  provider_id: string;
  provider_type: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  capacity: number;
}

export interface BookingCreate {
  provider_id?: string;
  provider_type?: string;
  service_type: ServiceType;
  slot_id?: string;
  notes?: string;
  selected_tests?: string[];
  total_price?: number;
  preferred_date?: string;
  catalog_id?: string;
  query?: string;
  city?: string;
  district?: string;
  home?: boolean;
  family_member_id?: string;
  collection_lat?: number;
  collection_lng?: number;
  collection_address?: string;
}

export interface BookingResponse {
  id: string;
  patient_id: string;
  provider_id: string;
  provider_type: string;
  service_type: ServiceType;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
  notes?: string;
  created_at: string;
  // Extended fields from actual API responses
  provider_name?: string;
  patient_name?: string;
  selected_tests?: string[];
  total_price?: number;
  collection_address?: string;
}

export interface SlotAllotment {
  allotted_start_time: string;
  allotted_end_time: string;
  message?: string;
}

export interface HealthPackageResponse {
  id: string;
  name: string;
  description: string;
  tests_included: string[];
  price: number;
  organization_id?: string;
  organization_name?: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────

export interface PaymentCreateOrderRequest {
  booking_id: string;
  amount: number;
}

export interface PaymentCreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  booking_id: string;
}

export interface PaymentVerifyRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  booking_id: string;
}

export interface TransactionResponse {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  razorpay_payment_id?: string;
  created_at: string;
}

// ─── Dispatch & Tracking ──────────────────────────────────────────────────

export interface DispatchRequest {
  provider_type: string;
  service_subtype?: string;
  patient_lat: number;
  patient_lng: number;
  patient_address: string;
  patient_address_details?: Record<string, string>;
  notes?: string;
  booking_id?: string;
}

export interface DispatchTrackResponse {
  dispatch_id: string;
  status: DispatchStatus;
  provider_id?: string;
  provider_name?: string;
  provider_lat?: number;
  provider_lng?: number;
  eta_minutes?: number;
  updated_at?: string;
}

// ─── Reports ──────────────────────────────────────────────────────────────

export interface ReportJob {
  id: string;
  booking_id?: string;
  patient_id: string;
  status: ReportJobStatus;
  report_url?: string;
  ai_summary?: string;
  ai_health_score?: number;
  abnormal_markers?: AbnormalMarker[];
  recommendations?: string[];
  created_at: string;
  delivered_at?: string;
}

export interface AbnormalMarker {
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
}

export interface BiomarkerHistory {
  marker_name: string;
  unit: string;
  entries: Array<{
    value: number;
    date: string;
    report_id: string;
  }>;
}

// ─── Telemedicine ─────────────────────────────────────────────────────────

export interface DoctorListing {
  id: string;
  full_name: string;
  specialization?: string;
  qualification?: string;
  years_of_experience?: number;
  consultation_mode?: ConsultationMode;
  avatar_url?: string;
  rating?: number;
  languages_spoken?: string[];
  available_for_online?: boolean;
}

export interface ConsultationResponse {
  id: string;
  patient_id: string;
  doctor_id: string;
  status: string;
  room_url?: string;
  room_token?: string;
  started_at?: string;
  ended_at?: string;
  prescription?: PrescriptionResponse;
  created_at: string;
}

export interface PrescriptionResponse {
  id: string;
  consultation_id: string;
  diagnosis: string;
  medications: PrescriptionMedication[];
  notes?: string;
  follow_up_date?: string;
  created_at: string;
}

export interface PrescriptionMedication {
  name: string;
  generic_name?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

// ─── Family Members ───────────────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  gender: Gender;
  date_of_birth: string;
  phone?: string;
  blood_group?: string;
  created_at: string;
}

export interface FamilyMemberCreate {
  name: string;
  relationship: string;
  gender: Gender;
  date_of_birth: string;
  phone?: string;
  blood_group?: string;
}

// ─── Pharmacy ─────────────────────────────────────────────────────────────

export interface PharmacyOrder {
  id: string;
  patient_id: string;
  patient_name?: string;
  prescription_url?: string;
  status: string;
  items?: PharmacyOrderItem[];
  total_amount?: number;
  created_at: string;
}

export interface PharmacyOrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface PharmacyInventoryItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category?: string;
  is_prescription_required: boolean;
}

export interface PharmacyInventoryCreate {
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category?: string;
  is_prescription_required?: boolean;
}

// ─── Patient SOS & Medications ────────────────────────────────────────────

export interface SOSTriggerRequest {
  latitude: number;
  longitude: number;
  address?: string;
  emergency_type?: string;
  notes?: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  notes?: string;
}

// ─── Admin ────────────────────────────────────────────────────────────────

export interface AdminMetrics {
  total_users: number;
  total_bookings: number;
  total_revenue: number;
  active_providers: number;
  pending_verifications: number;
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  role: UserRole;
  is_active: boolean;
  registration_status: string;
  created_at: string;
}

export interface VerificationReview {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  document_type: string;
  document_url?: string;
  status: VerificationStatus;
  submitted_at: string;
}

// ─── Organization ─────────────────────────────────────────────────────────

export interface OrgStatsResponse {
  total_bookings: number;
  total_revenue: number;
  total_patients: number;
  total_doctors: number;
  total_services: number;
}

// ─── Notifications ────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
  is_read: boolean;
  created_at: string;
}

// ─── Standard API Response Wrapper ────────────────────────────────────────

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}
