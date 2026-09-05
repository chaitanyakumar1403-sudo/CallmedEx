"use client";
import { useState, FormEvent } from "react";
import DateOfBirthPicker from "@/components/DateOfBirthPicker";
import StateDistrictPicker from "@/components/StateDistrictPicker";
import {
  User,
  Stethoscope,
  HeartHandshake,
  Apple,
  Activity,
  Syringe,
  Building2,
  Users,
  Pill,
  CheckCircle2,
  Mail,
  FileText,
  Clock,
  Info,
  AlertCircle,
  ShieldCheck,
  Camera,
} from "lucide-react";
import Clinical3DIcon, { Clinical3DIconName } from "@/components/ui/Clinical3DIcon";

// ─── Validation helpers ─────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function validateMobile(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (!cleaned) return null; // Optional field
  if (!/^\+?[1-9]\d{9,14}$/.test(cleaned)) {
    return "Enter a valid mobile number (e.g., +919876543210)";
  }
  return null;
}

function validateFileSize(file: File | null): string | null {
  if (!file) return null;
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 10 MB.`;
  }
  return null;
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  const levels = [
    { label: "Very Weak", color: "#ef4444" },
    { label: "Weak", color: "#f59e0b" },
    { label: "Fair", color: "#eab308" },
    { label: "Good", color: "#84cc16" },
    { label: "Strong", color: "#10b981" },
  ];
  return { score, ...levels[Math.min(score, 4)] };
}

const ROLES: { value: string; label: string; c3dName: Clinical3DIconName }[] = [
  { value: "patient", label: "Patient", c3dName: "patient" },
  { value: "doctor", label: "Doctor", c3dName: "stethoscope" },
  { value: "dentist", label: "Dentist", c3dName: "dental" },
  { value: "dietitian", label: "Dietitian", c3dName: "dietitian" },
  { value: "physiotherapist", label: "Physiotherapist", c3dName: "physio" },
  { value: "nurse", label: "Nurse", c3dName: "nurse" },
  { value: "phlebotomist", label: "Phlebotomist", c3dName: "phlebo" },
  { value: "organization", label: "Organization", c3dName: "hospital" },
  { value: "staff", label: "Staff", c3dName: "staff" },
  { value: "pharmacy", label: "Pharmacy", c3dName: "pharmacy" },
];

const MEDICAL_CONDITIONS = ["BP", "Sugar", "Thyroid", "Anemia", "Asthma", "Heart Disease", "None", "Other"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const NURSING_SERVICES = [
  { value: "wound_dressing", label: "Wound Dressing" },
  { value: "injection", label: "Injection" },
  { value: "iv_infusion", label: "IV Infusion" },
  { value: "post_operative", label: "Post-Operative Care" },
  { value: "catheter_care", label: "Catheter Care" },
  { value: "elderly_care", label: "Elderly Care" },
  { value: "pediatric", label: "Pediatric Nursing" },
  { value: "icu", label: "ICU / Critical Care" },
];

const DIETITIAN_SPECIALIZATIONS = [
  "Clinical & Therapeutic Nutrition",
  "Diabetes MNT & Insulin Resistance",
  "Weight Management & Bariatric Diet",
  "Cardiovascular & Lipid Control",
  "Renal Dietetics (CKD/Dialysis)",
  "Pediatric & Child Nutrition",
  "Sports & Athletic Nutrition",
  "PCOD, PCOS & Hormonal Balance",
  "Gastrointestinal & Gut Health (IBS/GERD)",
  "Oncology & Post-Op Nutrition",
];

const PHYSIO_SPECIALIZATIONS = [
  "Orthopedic & Musculoskeletal Rehab",
  "Neuro-Rehabilitation (Stroke / Parkinson's)",
  "Sports Injury & Return-to-Play",
  "Spine, Sciatica & Posture Correction",
  "Geriatric Mobility & Fall Prevention",
  "Post-Surgical Joint Replacement Rehab",
  "Pediatric Physiotherapy (CP / Milestones)",
  "Cardiopulmonary Chest Physiotherapy",
  "Women's Health & Pelvic Floor Rehab",
  "Ergonomic Pain Management",
];

const DENTAL_SPECIALIZATIONS = [
  "General Dental Surgery (BDS)",
  "Endodontics & Conservative Dentistry (MDS)",
  "Prosthodontics & Crown/Bridge (MDS)",
  "Orthodontics & Dentofacial Orthopedics (MDS)",
  "Periodontics & Implantology (MDS)",
  "Oral & Maxillofacial Surgery (MDS)",
  "Pediatric & Preventive Dentistry (MDS)",
  "Cosmetic & Aesthetic Dentistry",
];

// Canonical 19 Dental Procedures from CALL MEDEX - DENTAL PROCEDURE.xlsx (100% In-Clinic Walk-in)
const DENTAL_PROCEDURES_LIST = [
  { id: "dent_routine_cleanings", name: "Routine Cleanings (Prophylaxis)", category: "Diagnostic", price: 800, duration: "45 Mins" },
  { id: "dent_comprehensive_exams", name: "Comprehensive Exams", category: "Diagnostic", price: 400, duration: "30 Mins" },
  { id: "dent_dental_xrays", name: "Dental X-Rays", category: "Diagnostic", price: 350, duration: "15 Mins" },
  { id: "dent_fluoride_treatments", name: "Fluoride Treatments", category: "Preventive", price: 600, duration: "15 Mins" },
  { id: "dent_dental_sealants", name: "Dental Sealants", category: "Preventive", price: 750, duration: "30 Mins" },
  { id: "dent_dental_fillings", name: "Dental Fillings", category: "Restorative", price: 1200, duration: "45 Mins" },
  { id: "dent_root_canal_therapy", name: "Root Canal Therapy", category: "Endodontic", price: 3500, duration: "90 Mins" },
  { id: "dent_crowns_caps", name: "Dental Crowns (Caps)", category: "Prosthodontic", price: 4500, duration: "60 Mins" },
  { id: "dent_bridges", name: "Bridges", category: "Prosthodontic", price: 8000, duration: "90 Mins" },
  { id: "dent_dentures", name: "Dentures", category: "Prosthodontic", price: 12000, duration: "60 Mins" },
  { id: "dent_dental_implants", name: "Dental Implants", category: "Surgical-Restorative", price: 25000, duration: "120 Mins" },
  { id: "dent_teeth_whitening", name: "Teeth Whitening", category: "Cosmetic", price: 5000, duration: "60 Mins" },
  { id: "dent_dental_veneers", name: "Dental Veneers", category: "Cosmetic", price: 7500, duration: "90 Mins" },
  { id: "dent_cosmetic_bonding", name: "Cosmetic Bonding", category: "Cosmetic", price: 2000, duration: "45 Mins" },
  { id: "dent_scaling_root_planing", name: "Scaling and Root Planing", category: "Periodontal", price: 1800, duration: "75 Mins" },
  { id: "dent_gum_grafting", name: "Gum Grafting", category: "Periodontal-Surgical", price: 9000, duration: "90 Mins" },
  { id: "dent_tooth_extractions", name: "Tooth Extractions", category: "Oral Surgery", price: 1000, duration: "45 Mins" },
  { id: "dent_wisdom_teeth_removal", name: "Wisdom Teeth Removal", category: "Oral Surgery", price: 4000, duration: "90 Mins" },
  { id: "dent_emergency_dental_care", name: "Emergency Dental Care", category: "Emergency", price: 1500, duration: "45 Mins" },
];

export default function SignupPage() {
  const [role, setRole] = useState("patient");
  // Facility registrations are made BY a person ON BEHALF of an organization, so
  // the personal block asks who is registering rather than treating the facility
  // itself as a person with a gender and a date of birth.
  const isOrgLike = role === "organization" || role === "pharmacy";
  const [medicalHistory, setMedicalHistory] = useState<string[]>([]);
  const [nursingSpecs, setNursingSpecs] = useState<string[]>([]);
  const [dietitianSpecs, setDietitianSpecs] = useState<string[]>([
    "Clinical & Therapeutic Nutrition",
    "Diabetes MNT & Insulin Resistance",
  ]);
  const [physioSpecs, setPhysioSpecs] = useState<string[]>([
    "Orthopedic & Musculoskeletal Rehab",
    "Spine, Sciatica & Posture Correction",
  ]);
  const [dentalSpecs, setDentalSpecs] = useState<string[]>([
    "General Dental Surgery (BDS)",
    "Endodontics & Conservative Dentistry (MDS)",
  ]);
  const [selectedDentalProcedures, setSelectedDentalProcedures] = useState<string[]>(
    DENTAL_PROCEDURES_LIST.map((p) => p.id)
  );
  const [orgType, setOrgType] = useState("hospital");
  const [isIndependent, setIsIndependent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<Record<string, string>>({});
  // Canonical State → District (with GPS detect). Replaces three free-text
  // location inputs that let one district be spelled three ways.
  const [locState, setLocState] = useState("");
  const [locDistrict, setLocDistrict] = useState("");
  const [locDetected, setLocDetected] = useState(false);
  const [additionalDocs, setAdditionalDocs] = useState<{ id: number; name: string }[]>([]);
  const [dob, setDob] = useState("");
  const [registrantRole, setRegistrantRole] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [workSetting, setWorkSetting] = useState("solo_clinic"); // "solo_clinic" | "polyclinic" | "hospital"

  const addDocumentField = () => setAdditionalDocs(prev => [...prev, { id: Date.now(), name: "" }]);
  const removeDocumentField = (id: number) => setAdditionalDocs(prev => prev.filter(doc => doc.id !== id));
  const handleDocNameChange = (id: number, name: string) => setAdditionalDocs(prev => prev.map(doc => doc.id === id ? { ...doc, name } : doc));

  const toggleMedical = (condition: string) => {
    setMedicalHistory((prev) =>
      prev.includes(condition) ? prev.filter((c) => c !== condition) : [...prev, condition]
    );
  };

  const toggleNursingSpec = (spec: string) => {
    setNursingSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const toggleDietitianSpec = (spec: string) => {
    setDietitianSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const togglePhysioSpec = (spec: string) => {
    setPhysioSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const toggleDentalSpec = (spec: string) => {
    setDentalSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const toggleDentalProcedure = (procId: string) => {
    setSelectedDentalProcedures((prev) =>
      prev.includes(procId) ? prev.filter((p) => p !== procId) : [...prev, procId]
    );
  };

  const selectAllDentalProcedures = () => {
    if (selectedDentalProcedures.length === DENTAL_PROCEDURES_LIST.length) {
      setSelectedDentalProcedures([]);
    } else {
      setSelectedDentalProcedures(DENTAL_PROCEDURES_LIST.map((p) => p.id));
    }
  };

  const handleSimulateAIVerification = (docType: string) => {
    setVerificationStatus(prev => ({ ...prev, [docType]: "verifying" }));
    setTimeout(() => {
      setVerificationStatus(prev => ({ ...prev, [docType]: "verified" }));
    }, 2000);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;
    if (password !== confirmPassword) { setError("Passwords do not match"); setLoading(false); window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    // District decides which clinics, slots and collectors this account can
    // see or serve, so it cannot be optional the way free-text city was.
    if (!locState || !locDistrict) {
      setError("Please select your State and District.");
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Client-side DOB validation (non-org roles require a valid date)
    if (!isOrgLike && !dob) {
      setError("Please select your full Date of Birth (Year, Month, and Day).");
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      const emailValue = (formData.get("email") as string)?.trim() || (formData.get("official_email") as string)?.trim();
      const genderValue = formData.get("gender");
      const dobValue = dob || formData.get("date_of_birth");

      const body: Record<string, unknown> = {
        full_name: formData.get("full_name"),
        email: emailValue,
        mobile: formData.get("mobile"),
        password, confirm_password: confirmPassword,
        role,
        ...(genderValue ? { gender: genderValue } : {}),
        ...(dobValue ? { date_of_birth: dobValue } : {}),
        ...(formData.get("official_email") ? { official_email: (formData.get("official_email") as string)?.trim() } : {}),
        ...(isOrgLike || role === "staff" ? (registrantRole ? { registrant_role: registrantRole } : {}) : {}),
        ...(isOrgLike || role === "staff" ? (ownerEmail ? { owner_email: ownerEmail } : {}) : {}),
        address_info: {
          address_line1: formData.get("address_line1"),
          address_line2: formData.get("address_line2"),
          // City is no longer collected: the backend derives it from the
          // district so one place has exactly one spelling everywhere.
          state: locState,
          district: locDistrict,
          pincode: formData.get("pincode"),
          country: formData.get("country") || "India",
        },
      };

      // Role-specific fields
      if (role === "patient") {
        body.medical_history = medicalHistory;
        body.blood_group = formData.get("blood_group");
        body.height_cm = Number(formData.get("height_cm")) || null;
        body.weight_kg = Number(formData.get("weight_kg")) || null;
        body.preferred_language = formData.get("preferred_language") || "en";
      }
      if (role === "doctor") {
        body.license_number = formData.get("license_number");
        body.qualification = formData.get("qualification");
        body.specialization = formData.get("specialization");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.hospital_clinic_name = formData.get("hospital_clinic_name");
        body.practice_type = workSetting;
        body.available_for_online = formData.get("available_for_online") === "on";
        if (workSetting === "solo_clinic") {
            body.clinic_address = formData.get("clinic_address");
            body.clinic_contact = formData.get("clinic_contact");
        } else if (workSetting === "polyclinic") {
            body.polyclinic_name = formData.get("polyclinic_name");
            body.consultation_hours = formData.get("consultation_hours");
        } else if (workSetting === "hospital") {
            body.affiliated_hospital_name = formData.get("affiliated_hospital_name");
            body.department = formData.get("department");
            body.service_area = formData.get("service_area");
        }
      }
      if (role === "nurse") {
        body.nursing_license_number = formData.get("nursing_license_number");
        body.qualification = formData.get("qualification");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.nursing_specializations = nursingSpecs;
      }
      if (role === "dietitian") {
        body.dietitian_license_number = formData.get("dietitian_license_number");
        body.qualification = formData.get("qualification");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.hospital_clinic_name = formData.get("hospital_clinic_name");
        body.dietitian_specializations = dietitianSpecs;
      }
      if (role === "physiotherapist") {
        body.physio_license_number = formData.get("physio_license_number");
        body.qualification = formData.get("qualification");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.hospital_clinic_name = formData.get("hospital_clinic_name");
        body.physio_specializations = physioSpecs;
      }
      if (role === "dentist") {
        body.dental_license_number = formData.get("dental_license_number");
        body.qualification = formData.get("qualification");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.clinic_name = formData.get("clinic_name");
        body.consultation_fee = Number(formData.get("consultation_fee")) || 400;
        body.dental_specializations = dentalSpecs;
        body.scope_of_services = DENTAL_PROCEDURES_LIST.filter((p) =>
          selectedDentalProcedures.includes(p.id)
        ).map((p) => ({
          procedure_id: p.id,
          name: p.name,
          category: p.category,
          benchmark_price: p.price,
          agreed_price: p.price,
          duration: p.duration,
          modality: "clinic",
          is_active: true,
        }));
      }
      if (role === "phlebotomist") {
        body.phleb_type = formData.get("phleb_type");
        body.qualification = formData.get("qualification");
        body.specialization = formData.get("specialization");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.certification_number = formData.get("certification_number");
      }
      if (role === "organization") {
        body.organization_name = formData.get("organization_name");
        body.organization_type = orgType;
        body.license_number = formData.get("license_number");
        body.establishment_year = Number(formData.get("establishment_year")) || null;
        body.ownership_type = formData.get("ownership_type");
        body.head_of_institution = formData.get("head_of_institution");
        body.operating_hours = formData.get("operating_hours");
        body.emergency_phone = formData.get("emergency_phone");
        body.alternate_phone = formData.get("alternate_phone");
        
        if (["hospital", "polyclinic", "clinic"].includes(orgType)) {
            body.total_departments = Number(formData.get("total_departments")) || 0;
            body.total_doctors = Number(formData.get("total_doctors")) || 0;
            body.total_branches = Number(formData.get("total_branches")) || 1;
        } else if (orgType === "diagnostic_center") {
            body.accreditation_number = formData.get("accreditation_number");
            body.test_catalog_summary = formData.get("test_catalog_summary");
        }
      }
      if (role === "staff") {
        body.staff_role = formData.get("staff_role");
        body.department = formData.get("department");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.alternate_phone = formData.get("alternate_phone");
      }
      if (role === "pharmacy") {
        body.pharmacy_name = formData.get("pharmacy_name");
        body.pharmacy_type = formData.get("pharmacy_type");
        body.owner_name = formData.get("owner_name");
        body.pharmacist_in_charge = formData.get("pharmacist_in_charge");
        body.years_of_operation = Number(formData.get("years_of_operation")) || 0;
        body.operating_hours = formData.get("operating_hours");
        body.registration_number = formData.get("registration_number");
        body.drug_license_number = formData.get("drug_license_number");
        body.gst_number = formData.get("gst_number");
        body.home_delivery = formData.get("home_delivery") === "on";
        body.available_24x7 = formData.get("available_24x7") === "on";
        body.service_radius_km = Number(formData.get("service_radius_km")) || 5;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Handle Pydantic validation errors (detail is an array of objects)
        let errorMsg = "Signup failed";
        if (typeof data.detail === "string") {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMsg = data.detail
            .map((e: { loc?: string[]; msg?: string }) => {
              const field = e.loc ? e.loc[e.loc.length - 1] : "field";
              return `${field}: ${e.msg || "invalid"}`;
            })
            .join(". ");
        } else if (data.message) {
          errorMsg = data.message;
        }
        throw new Error(errorMsg);
      }
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      setError(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  // ─── Success Screen ────────────────────────────────────────────────
  if (success) {
    const isMOURole = role !== "patient";
    return (
      <div className="auth-page">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
            {isMOURole ? (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #bfdbfe" }}>
                <Mail size={36} color="#2563eb" />
              </div>
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #bbf7d0" }}>
                <CheckCircle2 size={36} color="#16a34a" />
              </div>
            )}
          </div>
          <h2>{isMOURole ? "Check Your Email!" : "Account Created!"}</h2>
          {isMOURole ? (
            <>
              <p className="subtitle" style={{ marginBottom: 16 }}>
                We&apos;ve sent a <strong>Memorandum of Understanding (MOU)</strong> to your email address.
              </p>
              <div style={{ 
                backgroundColor: '#f0fdf4', 
                border: '1px solid #bbf7d0', 
                borderRadius: 12, 
                padding: '20px', 
                marginBottom: 24,
                textAlign: 'left'
              }}>
                <p style={{ fontWeight: 600, marginBottom: 8, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={18} color="#166534" /> Next Steps:
                </p>
                <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: '#15803d' }}>
                  <li>Open the email from <strong>CallMedex</strong></li>
                  <li>Click the secure link to review the MOU &amp; Scope of Services</li>
                  <li>Review clinical agreement &amp; scope of services</li>
                  <li>Click <strong>&quot;I Agree &amp; Activate My Account&quot;</strong></li>
                </ol>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Clock size={16} /> The link expires in 24 hours. Didn&apos;t receive it? Check your spam folder.
              </p>
            </>
          ) : (
            <>
              <p className="subtitle">Your patient account has been created successfully.</p>
              <a href="/auth/login" className="btn btn-primary btn-full">Login Now</a>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Create Your Account</h2>
        <p className="subtitle">Join India&apos;s smartest healthcare platform</p>

        {/* Role Selector */}
        <div className="role-selector">
          {ROLES.map((r) => (
            <div key={r.value} className={`role-option ${role === r.value ? "selected" : ""}`} onClick={() => setRole(r.value)}>
              <div className="role-option__icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 38, marginBottom: 4 }}>
                <Clinical3DIcon name={r.c3dName} size={32} glow={role === r.value} />
              </div>
              <div className="role-option__label">{r.label}</div>
            </div>
          ))}
        </div>

        {error && <div className="form-error" style={{ textAlign: "center", marginBottom: 16, fontSize: "0.9rem" }}>{error}</div>}

        {/* ─── Strict Verification Warning for Non-Patient Roles ─── */}
        {role !== "patient" && (
          <div style={{
            backgroundColor: '#fff7ed',
            border: '2px solid #f97316',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <AlertCircle size={24} color="#ea580c" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontWeight: 700, color: '#c2410c', marginBottom: 6, fontSize: '0.95rem' }}>
                Important: Strict Verification Policy
              </p>
              <p style={{ color: '#9a3412', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                Please ensure your <strong>name, license/registration numbers, and all details</strong> match
                <strong> exactly</strong> as printed on your official certificate. Our AI verification system
                will cross-check your uploaded documents against the information you enter here.
                <strong style={{ color: '#dc2626' }}> Any mismatch will result in automatic rejection.</strong>
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ─── Common Fields ─── */}
          <div className="card-section">
            <h4>{isOrgLike ? "Authorised Contact Person" : "Personal Information"}</h4>
            {isOrgLike && (
              <p style={{ margin: "0 0 12px 0", fontSize: "0.83rem", color: "#64748b" }}>
                Details of the person registering on behalf of the organization. Facility
                details are captured below.
              </p>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{isOrgLike ? "Contact Person Name *" : "Full Name *"}</label>
                <input name="full_name" className="form-input" placeholder={isOrgLike ? "Person registering this facility" : "Enter full name"} required />
              </div>
              {isOrgLike ? (
                <div className="form-group">
                  <label className="form-label">Designation *</label>
                  <select name="registrant_role" className="form-select" required defaultValue="">
                    <option value="">Select</option>
                    <option value="owner">Owner / Proprietor</option>
                    <option value="general_manager">General Manager</option>
                    <option value="front_desk_manager">Front Desk Manager</option>
                    <option value="admin_staff">Administrative Staff</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Gender *</label>
                  <select name="gender" className="form-select" required>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
            </div>
            <div className="form-row">
              {isOrgLike ? (
                <div className="form-group">
                  <label className="form-label">Official Email *</label>
                  <input name="official_email" type="email" className="form-input" placeholder="reception@yourfacility.com" />
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Used for booking notifications and reports.
                  </span>
                </div>
              ) : (
                <div className="form-group">
                  <DateOfBirthPicker value={dob} onChange={setDob} />
                  {/* Hidden input for form compatibility */}
                  <input type="hidden" name="date_of_birth" value={dob} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Mobile Number *</label>
                <input name="mobile" type="tel" className="form-input" placeholder="+91 XXXXXXXXXX" pattern="^\+?[1-9]\d{9,14}$" title="Enter a valid phone number with country code" required />
              </div>
            </div>

            {/* Registrant Role & Owner Email — only for organization-like roles that have owners */}
            {(isOrgLike || role === "staff") && (
              <>
                <div style={{
                  padding: '14px 18px', backgroundColor: '#eff6ff', borderRadius: 10,
                  border: '1px solid #bfdbfe', marginBottom: 16, marginTop: 8,
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 600, marginBottom: 6 }}>
                    ℹ️ Registration Details
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#3b82f6', lineHeight: 1.5 }}>
                    The account will be managed by the front desk or general manager. The MOU will be sent to the owner for approval.
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Your Designation / Role *</label>
                    <select className="form-select" value={registrantRole} onChange={e => setRegistrantRole(e.target.value)} required>
                      <option value="">Select your role</option>
                      <option value="front_desk_manager">Front Desk Manager</option>
                      <option value="general_manager">General Manager</option>
                      <option value="admin_staff">Administrative Staff</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="owner">Owner (Self)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Owner&apos;s Email (for MOU) *</label>
                    <input
                      type="email" className="form-input" placeholder="owner@organization.com"
                      value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
                      required={registrantRole !== "owner"}
                    />
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 3 }}>
                      {registrantRole === "owner"
                        ? "Leave blank if same as your email above"
                        : "MOU will be sent to this email for owner approval"}
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input name="email" type="email" className="form-input" placeholder="you@example.com" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  name="password"
                  type="password"
                  className="form-input"
                  placeholder="Min 8 chars, upper, lower, digit, special"
                  minLength={8}
                  required
                  onChange={(e) => {
                    const strength = getPasswordStrength(e.target.value);
                    const meter = document.getElementById("password-strength-meter");
                    const label = document.getElementById("password-strength-label");
                    if (meter) meter.style.width = `${(strength.score / 5) * 100}%`;
                    if (meter) meter.style.background = strength.color;
                    if (label) { label.textContent = strength.label; label.style.color = strength.color; }
                  }}
                />
                <div style={{ marginTop: 6, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                  <div id="password-strength-meter" style={{ height: "100%", width: 0, transition: "width 0.3s, background 0.3s" }} />
                </div>
                <small id="password-strength-label" style={{ display: "block", marginTop: 4, fontSize: "0.75rem", color: "#94a3b8" }}>Enter a password</small>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input name="confirm_password" type="password" className="form-input" placeholder="Re-enter password" required />
              </div>
            </div>
          </div>

          {/* ─── Address ─── */}
          <div className="card-section">
            <h4>Address Information</h4>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input name="address" className="form-input" placeholder="Street address" />
            </div>
            {/* District + State only.
                "Visakhapatnam" is both a city and a district, so asking for
                both as free text produced 'Vizag' / 'VISAKHAPATNAM' /
                'Visakhapatnam' for one place — and every city-equality filter
                in the platform (doctor discovery, centre allocation,
                phlebotomist scoping) then missed. District is the unit that
                actually decides service coverage; the server mirrors it into
                the city column so existing consumers keep working. */}
            <div className="form-group">
              <label className="form-label">State &amp; District *</label>
              <StateDistrictPicker
                stateValue={locState}
                districtValue={locDistrict}
                detected={locDetected}
                onChange={(next) => {
                  setLocState(next.state);
                  setLocDistrict(next.district);
                  setLocDetected(next.detected);
                }}
              />
              <small style={{ display: "block", marginTop: 6, color: "#64748b", fontSize: "0.78rem" }}>
                Your district decides which clinics, collection slots and home
                visits are available to you.
              </small>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Pincode</label>
                <input name="pincode" className="form-input" placeholder="6-digit pincode" />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input name="country" className="form-input" defaultValue="India" readOnly />
              </div>
            </div>
          </div>

          {/* ─── Patient Fields ─── */}
          {role === "patient" && (
            <>
              <div className="card-section">
                <h4>Medical History</h4>
                <div className="chip-group">
                  {MEDICAL_CONDITIONS.map((c) => (
                    <span key={c} className={`chip ${medicalHistory.includes(c) ? "active" : ""}`} onClick={() => toggleMedical(c)}>{c}</span>
                  ))}
                </div>
              </div>
              <div className="card-section">
                <h4>Physical Information</h4>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select name="blood_group" className="form-select">
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Height (cm)</label>
                    <input name="height_cm" type="number" className="form-input" placeholder="e.g. 170" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Weight (kg)</label>
                    <input name="weight_kg" type="number" className="form-input" placeholder="e.g. 65" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Language</label>
                  <select name="preferred_language" className="form-select">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="te">Telugu</option>
                    <option value="ta">Tamil</option>
                    <option value="kn">Kannada</option>
                    <option value="mr">Marathi</option>
                    <option value="bn">Bengali</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ─── Doctor Fields ─── */}
          {role === "doctor" && (
            <div className="card-section">
              <h4>Professional & Practice Details</h4>
              
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label" style={{ fontWeight: 700, color: "#1e293b", marginBottom: 8, display: "block" }}>
                  Primary Work Setting / Practice Type *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  {[
                    { id: "solo_clinic", Icon: Stethoscope, label: "Solo Clinic", desc: "Independent Practice" },
                    { id: "polyclinic", Icon: Building2, label: "Polyclinic", desc: "Multi-Specialty Facility" },
                    { id: "hospital", Icon: HeartHandshake, label: "Hospital", desc: "Hospital Affiliated OPD" },
                  ].map((setting) => (
                    <div
                      key={setting.id}
                      style={{
                        padding: "14px 12px",
                        borderRadius: 10,
                        border: workSetting === setting.id ? "2px solid #0284c7" : "1px solid #cbd5e1",
                        backgroundColor: workSetting === setting.id ? "#f0f9ff" : "white",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setWorkSetting(setting.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                        <setting.Icon size={24} color={workSetting === setting.id ? "#0284c7" : "#64748b"} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: workSetting === setting.id ? "#0369a1" : "#334155" }}>
                        {setting.label}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>{setting.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {workSetting !== "solo_clinic" && (
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-checkbox" style={{ fontWeight: 600, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: "#f8fafc" }}>
                    <input type="checkbox" checked={isIndependent} onChange={(e) => setIsIndependent(e.target.checked)} />
                    Also provide independent Home Visits / On-Demand Consultations
                  </label>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Medical License Number *</label>
                  <input name="medical_license_number" className="form-input" placeholder="NMC/State License No." required />
                </div>
                <div className="form-group">
                  <label className="form-label">Specialization *</label>
                  <input name="specialization" className="form-input" placeholder="e.g. General Medicine, Cardiology" required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <label className="form-label">Upload Medical Registration Certificate *</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input" style={{ flex: 1 }} required onChange={(e) => { const f = e.target.files?.[0]; if (f) { const err = validateFileSize(f); if (err) { alert(err); e.target.value = ""; } } }} />
                  {verificationStatus['doc_license'] === 'verified' ? (
                      <span style={{ color: '#2f855a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={16} /> AI Verified
                      </span>
                  ) : verificationStatus['doc_license'] === 'verifying' ? (
                      <span style={{ color: '#d69e2e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={16} /> Verifying...
                      </span>
                  ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSimulateAIVerification('doc_license')}>
                          Verify via AI
                      </button>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: 4 }}>Required for platform verification. Our AI will instantly verify your credentials.</div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Qualification *</label>
                  <input name="qualification" className="form-input" placeholder="e.g. MBBS, MD" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Years of Experience</label>
                  <input name="years_of_experience" type="number" className="form-input" placeholder="e.g. 5" />
                </div>
              </div>
              
              {workSetting === "solo_clinic" ? (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Solo Clinic Name *</label>
                    <input name="hospital_clinic_name" className="form-input" placeholder="e.g. Dr. Kumar's Health Clinic" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Primary Locality / Service Area *</label>
                    <input name="service_area" className="form-input" placeholder="e.g. MVP Colony, Visakhapatnam" required />
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">{workSetting === "hospital" ? "Hospital Name & Branch *" : "Polyclinic Name & Branch *"}</label>
                  <input name="hospital_clinic_name" className="form-input" placeholder={workSetting === "hospital" ? "e.g. Apollo Hospitals, Visakhapatnam" : "e.g. Medicover Polyclinic"} required />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Consultation Mode</label>
                  <select name="consultation_mode" className="form-select">
                    <option value="both">In-Person & Online</option>
                    <option value="in_person">In-Person Only</option>
                    <option value="online">Online Only</option>
                    <option value="home_visit">Home Visit Only</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
                  <label className="form-checkbox">
                    <input name="available_for_online" type="checkbox" defaultChecked />
                    Available for Online Consultation
                  </label>
                </div>
              </div>

              {/* CallMedex Standard Benchmark Tariffs */}
              <div style={{
                marginTop: 20,
                padding: '18px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)',
                border: '1px solid #bbf7d0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: 6, borderRadius: 6, background: '#16a34a', color: '#fff', display: 'flex' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#14532d' }}>
                      CallMedex Reference Tariffs (Official Benchmark)
                    </span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontSize: '0.78rem', fontWeight: 700, border: '1px solid #86efac' }}>
                    Verified Benchmark
                  </span>
                </div>

                <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: '#166534', lineHeight: 1.5 }}>
                  Based on CallMedex Specialty Fee Benchmarks (standard clinical rates). When registered, your services are pre-loaded with these standard prices. You can accept them or customize them anytime in your Command Center:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>General Teleconsult (15m)</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹400</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Clinic Walk-In (30m)</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹500</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Doorstep Home Visit (45m)</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹800</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Specialist Teleconsult (MD)</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹700</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#475569', fontStyle: 'italic' }}>
                  * All fees are fully editable post-registration in your Doctor Command Center.
                </div>
              </div>
            </div>
          )}

          {/* ─── Nurse Fields ─── */}
          {role === "nurse" && (
            <div className="card-section">
              <h4>Nursing Professional Details</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nursing License Number *</label>
                  <input name="nursing_license_number" className="form-input" placeholder="State Nursing Council License No." required />
                </div>
                <div className="form-group">
                  <label className="form-label">Qualification *</label>
                  <input name="qualification" className="form-input" placeholder="e.g. GNM, B.Sc Nursing, M.Sc Nursing" required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <label className="form-label">Upload Nursing License / Certificate *</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input" style={{ flex: 1 }} required onChange={(e) => { const f = e.target.files?.[0]; if (f) { const err = validateFileSize(f); if (err) { alert(err); e.target.value = ""; } } }} />
                  {verificationStatus['nurse_license'] === 'verified' ? (
                      <span style={{ color: '#2f855a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={16} /> AI Verified
                      </span>
                  ) : verificationStatus['nurse_license'] === 'verifying' ? (
                      <span style={{ color: '#d69e2e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={16} /> Verifying...
                      </span>
                  ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSimulateAIVerification('nurse_license')}>
                          Verify via AI
                      </button>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: 4 }}>Our AI will verify your nursing credentials against government records.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Years of Experience</label>
                <input name="years_of_experience" type="number" className="form-input" placeholder="e.g. 3" />
              </div>

              <div className="form-group">
                <label className="form-label">Specializations (Select all that apply)</label>
                <div className="chip-group">
                  {NURSING_SERVICES.map((s) => (
                    <span
                      key={s.value}
                      className={`chip ${nursingSpecs.includes(s.value) ? "active" : ""}`}
                      onClick={() => toggleNursingSpec(s.value)}
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* CallMedex Standard Nursing Tariffs */}
              <div style={{
                marginTop: 20,
                padding: '18px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)',
                border: '1px solid #bbf7d0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: 6, borderRadius: 6, background: '#16a34a', color: '#fff', display: 'flex' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#14532d' }}>
                      CallMedex Nursing Tariffs (Official Benchmark)
                    </span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontSize: '0.78rem', fontWeight: 700, border: '1px solid #86efac' }}>
                    Verified Benchmark
                  </span>
                </div>

                <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: '#166534', lineHeight: 1.5 }}>
                  Based on CallMedex Home Care Guidelines. Your standard procedure fees are pre-loaded with these reference rates. You can accept or edit them anytime in your Nurse Station:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>IM/IV Injection &amp; Vitals</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹300</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Sterile Wound Dressing</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹350</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>IV Infusion &amp; Cannulation</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹400</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>12h Bedside Attendant</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹1500</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#475569', fontStyle: 'italic' }}>
                  * All procedure charges are fully customizable post-registration in your Nurse Station.
                </div>
              </div>
            </div>
          )}

          {/* ─── Dietitian & Clinical Nutritionist Fields ─── */}
          {role === "dietitian" && (
            <div className="card-section">
              <h4>Dietetic &amp; Clinical Nutrition Credentials</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">IDA / Registered Dietitian (RD) Number *</label>
                  <input name="dietitian_license_number" className="form-input" placeholder="e.g. IDA-2024-8842 / RD-901" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Highest Qualification *</label>
                  <input name="qualification" className="form-input" placeholder="e.g. M.Sc Clinical Nutrition / RD / PGD Dietetics" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Years of Clinical Experience</label>
                  <input name="years_of_experience" type="number" className="form-input" placeholder="e.g. 5" defaultValue="1" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Clinic / Wellness Center Name (Optional)</label>
                  <input name="hospital_clinic_name" className="form-input" placeholder="e.g. NutriCare Metabolic Clinic" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dietetic Specializations (Select all that apply)</label>
                <div className="chip-group">
                  {DIETITIAN_SPECIALIZATIONS.map((s) => (
                    <span
                      key={s}
                      className={`chip ${dietitianSpecs.includes(s) ? "active" : ""}`}
                      onClick={() => toggleDietitianSpec(s)}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* CallMedex Standard Dietitian Tariffs */}
              <div style={{
                marginTop: 20,
                padding: '18px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)',
                border: '1px solid #bbf7d0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: 6, borderRadius: 6, background: '#16a34a', color: '#fff', display: 'flex' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#14532d' }}>
                      CallMedex Dietetics Tariffs (Official Benchmark)
                    </span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontSize: '0.78rem', fontWeight: 700, border: '1px solid #86efac' }}>
                    Verified Benchmark
                  </span>
                </div>

                <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: '#166534', lineHeight: 1.5 }}>
                  Standard clinical nutrition and MNT benchmarks. Pre-loaded with these reference rates, with full autonomy to edit anytime:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Tele-Dietetics Consult</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹400</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Clinic Nutrition Assessment</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹500</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Home Visit &amp; Pantry Audit</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹800</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#475569', fontStyle: 'italic' }}>
                  * All consultation charges are fully customizable post-registration in your Dietitian Studio.
                </div>
              </div>
            </div>
          )}

          {/* ─── Physiotherapist Fields ─── */}
          {role === "physiotherapist" && (
            <div className="card-section">
              <h4>Physiotherapy &amp; Rehabilitation Credentials</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">State Council / IAP Registration Number *</label>
                  <input name="physio_license_number" className="form-input" placeholder="e.g. KSPC-PT-2024-1928" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Degree / Qualification *</label>
                  <input name="qualification" className="form-input" placeholder="e.g. BPT, MPT (Orthopedics / Neuro)" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Years of Clinical Experience</label>
                  <input name="years_of_experience" type="number" className="form-input" placeholder="e.g. 6" defaultValue="1" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Physiotherapy Center Name (Optional)</label>
                  <input name="hospital_clinic_name" className="form-input" placeholder="e.g. Apex Physio &amp; Spine Rehab" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Focus Areas (Select all that apply)</label>
                <div className="chip-group">
                  {PHYSIO_SPECIALIZATIONS.map((s) => (
                    <span
                      key={s}
                      className={`chip ${physioSpecs.includes(s) ? "active" : ""}`}
                      onClick={() => togglePhysioSpec(s)}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* CallMedex Standard Physiotherapy Tariffs */}
              <div style={{
                marginTop: 20,
                padding: '18px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)',
                border: '1px solid #bbf7d0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ padding: 6, borderRadius: 6, background: '#16a34a', color: '#fff', display: 'flex' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#14532d' }}>
                      CallMedex Physiotherapy Tariffs (Official Benchmark)
                    </span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontSize: '0.78rem', fontWeight: 700, border: '1px solid #86efac' }}>
                    Verified Benchmark
                  </span>
                </div>

                <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: '#166534', lineHeight: 1.5 }}>
                  Based on official CallMedex physical rehabilitation guidelines. Your default consultation and session rates:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Tele-Rehab Assessment</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹400</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Center PT Treatment</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹500</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Doorstep Bedside Rehab (45m)</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>₹800</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#475569', fontStyle: 'italic' }}>
                  * All therapy session rates are fully customizable post-registration in your Studio.
                </div>
              </div>
            </div>
          )}

          {/* ─── Dentist / Dental Practice Fields ─── */}
          {role === "dentist" && (
            <div className="card-section">
              <h4>Dental Surgery &amp; Practice Credentials</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">State Dental Council / DCI Reg. Number *</label>
                  <input name="dental_license_number" className="form-input" placeholder="e.g. SDC-DENT-2024-5501 / DCI-8821" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Degree / Dental Qualification *</label>
                  <input name="qualification" className="form-input" placeholder="e.g. BDS, MDS (Conservative &amp; Endodontics)" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Dental Clinic / Practice Name *</label>
                  <input name="clinic_name" className="form-input" placeholder="e.g. SmileCare Dental Clinic &amp; Implant Center" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Years of Dental Experience</label>
                  <input name="years_of_experience" type="number" className="form-input" placeholder="e.g. 5" defaultValue="1" min="0" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Walk-In Clinical Consultation Fee (₹) *</label>
                  <input name="consultation_fee" type="number" className="form-input" placeholder="e.g. 400" defaultValue="400" min="100" required />
                  <div style={{ fontSize: "0.75rem", color: "var(--color-gray-500)", marginTop: 4 }}>
                    Standard benchmark is ₹400 (Net ₹320 to dentist / ₹80 platform fee).
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Delivery Modality</label>
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: "0.85rem", color: "#0f172a", fontWeight: 600 }}>
                    Strictly 100% In-Clinic Walk-In (Operatory &amp; Sterilization Protocol)
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dental Specializations (Select all that apply)</label>
                <div className="chip-group">
                  {DENTAL_SPECIALIZATIONS.map((s) => (
                    <span
                      key={s}
                      className={`chip ${dentalSpecs.includes(s) ? "active" : ""}`}
                      onClick={() => toggleDentalSpec(s)}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Canonical 19 Dental Procedures Selector */}
              <div style={{
                marginTop: 24,
                padding: "20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)",
                border: "1px solid #bbf7d0",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 6, borderRadius: 8, background: "#0284c7", color: "#fff", display: "flex" }}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: "0.98rem", color: "#0f172a", display: "block" }}>
                        CallMedex Dental Procedure Scope (19 Canonical Procedures)
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "#475569" }}>
                        Selected procedures will automatically populate in your Workstation &amp; walk-in booking directory.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={selectAllDentalProcedures}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      background: "#0284c7",
                      color: "#fff",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {selectedDentalProcedures.length === DENTAL_PROCEDURES_LIST.length ? "Deselect All" : "Select All (19)"}
                  </button>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 10,
                  maxHeight: "360px",
                  overflowY: "auto",
                  paddingRight: 4,
                  marginBottom: 14,
                }}>
                  {DENTAL_PROCEDURES_LIST.map((proc) => {
                    const isSelected = selectedDentalProcedures.includes(proc.id);
                    const netPayout = Math.round(proc.price * 0.8);
                    return (
                      <div
                        key={proc.id}
                        onClick={() => toggleDentalProcedure(proc.id)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: isSelected ? "#ffffff" : "#f8fafc",
                          border: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "all 0.15s ease",
                          boxShadow: isSelected ? "0 2px 8px rgba(2, 132, 199, 0.12)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ accentColor: "#0284c7", cursor: "pointer" }}
                            />
                            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>
                              {proc.name}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 20 }}>
                            <span style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: 4, background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>
                              {proc.category}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                              {proc.duration}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0284c7" }}>
                            ₹{proc.price}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "#16a34a", fontWeight: 700 }}>
                            Net: ₹{netPayout}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CallMedex Dental Partner Terms MOU Info Banner */}
                <div style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}>
                  <ShieldCheck size={20} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: "0.78rem", color: "#1e3a8a", lineHeight: 1.5 }}>
                    <strong>Automated Partner MOU Dispatch:</strong> Upon registration, the CallMedex Dental Partner Terms Agreement (80% net dentist payout / 20% platform fee, 100% walk-in delivery protocol, autoclaving standards) will be automatically generated and emailed to you. You can adjust your tariffs and availability anytime in the Dentist Workstation.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Phlebotomist Fields ─── */}
          {role === "phlebotomist" && (
            <div className="card-section">
              <h4>Professional Details</h4>
              <div className="form-group">
                <label className="form-label">Phlebo Type *</label>
                <div style={{ display: "flex", gap: 16 }}>
                  <label className="form-checkbox"><input type="radio" name="phleb_type" value="full_time" defaultChecked /> Full Time</label>
                  <label className="form-checkbox"><input type="radio" name="phleb_type" value="part_time" /> Part Time</label>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Qualification *</label>
                  <input name="qualification" className="form-input" placeholder="e.g. DMLT, MLT" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Certification Number *</label>
                  <input name="certification_number" className="form-input" placeholder="MLT/DMLT Certificate No." required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Specialization</label>
                  <input name="specialization" className="form-input" placeholder="e.g. Phlebotomy" />
                </div>
                <div className="form-group">
                  <label className="form-label">Years of Experience</label>
                  <input name="years_of_experience" type="number" className="form-input" placeholder="e.g. 3" />
                </div>
              </div>
            </div>
          )}

          {/* ─── Organization Fields ─── */}
          {role === "organization" && (
            <>
              <div className="card-section">
                <h4>Organization Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Organization Name *</label>
                    <input name="organization_name" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Organization Type *</label>
                    <select name="organization_type" className="form-select" value={orgType} onChange={e => setOrgType(e.target.value)} required>
                      <option value="clinic">Clinic (Single Doctor / Small Team)</option>
                      <option value="polyclinic">Polyclinic (Multiple Branches/Specialties)</option>
                      <option value="hospital">Hospital</option>
                      <option value="diagnostic_center">Diagnostic Center / Lab</option>
                      <option value="dental_clinic">Dental Clinic / Dental Hospital</option>
                      <option value="physiotherapy_center">Physiotherapy Center</option>
                      <option value="nursing_home">Nursing Home</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{orgType === "diagnostic_center" ? "NABL/Registration Number *" : "Hospital/Clinic Registration No. *"}</label>
                    <input name="license_number" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Establishment Year</label>
                    <input name="establishment_year" type="number" className="form-input" placeholder="e.g. 2010" />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                  <label className="form-label">Upload Registration / Accreditation Certificate (PDF/JPG) *</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input" style={{ flex: 1 }} required onChange={(e) => { const f = e.target.files?.[0]; if (f) { const err = validateFileSize(f); if (err) { alert(err); e.target.value = ""; } } }} />
                    {verificationStatus['org_license'] === 'verified' ? (
                        <span style={{ color: '#2f855a', fontWeight: 600 }}>✅ AI Verified</span>
                    ) : verificationStatus['org_license'] === 'verifying' ? (
                        <span style={{ color: '#d69e2e', fontWeight: 600 }}>⏳ Verifying...</span>
                    ) : (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSimulateAIVerification('org_license')}>
                            Verify via AI
                        </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: 4 }}>Our AI will verify the document against government records.</div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ownership Type</label>
                    <select name="ownership_type" className="form-select">
                      <option value="private">Private</option>
                      <option value="partnership">Partnership</option>
                      <option value="sole_proprietorship">Sole Proprietorship</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Head of Institution</label>
                    <input name="head_of_institution" className="form-input" />
                  </div>
                </div>
              </div>
              
              <div className="card-section">
                <h4>{orgType === "diagnostic_center" ? "Diagnostic Services" : "Clinical Administration"}</h4>
                
                {["clinic", "polyclinic", "hospital"].includes(orgType) && (
                    <div className="form-row-3">
                      <div className="form-group">
                        <label className="form-label">Departments</label>
                        <input name="total_departments" type="number" className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Total Doctors</label>
                        <input name="total_doctors" type="number" className="form-input" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Total Branches</label>
                        <input name="total_branches" type="number" className="form-input" defaultValue={1} />
                      </div>
                    </div>
                )}
                
                {orgType === "diagnostic_center" && (
                    <div className="form-group">
                        <label className="form-label">Test Catalog Summary</label>
                        <textarea name="test_catalog_summary" className="form-input" rows={3} placeholder="List major test categories (e.g., Blood tests, X-Ray, MRI) or paste a link to your catalog..." />
                    </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Operating Hours</label>
                    <input name="operating_hours" className="form-input" placeholder="e.g. 8 AM - 10 PM" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emergency / Contact Phone</label>
                    <input name="emergency_phone" type="tel" className="form-input" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── Staff Fields ─── */}
          {role === "staff" && (
            <div className="card-section">
              <h4>Staff Information</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Staff Role *</label>
                  <input name="staff_role" className="form-input" placeholder="e.g. Nurse, Receptionist" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <input name="department" className="form-input" placeholder="e.g. Emergency, OPD" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Experience (Years)</label>
                  <input name="years_of_experience" type="number" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Alternate Phone</label>
                  <input name="alternate_phone" type="tel" className="form-input" />
                </div>
              </div>
            </div>
          )}

          {/* ─── Pharmacy Fields ─── */}
          {role === "pharmacy" && (
            <>
              <div className="card-section">
                <h4>Pharmacy Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Pharmacy Name *</label>
                    <input name="pharmacy_name" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pharmacy Type *</label>
                    <select name="pharmacy_type" className="form-select" required>
                      <option value="retail">Retail</option>
                      <option value="hospital">Hospital</option>
                      <option value="clinic">Clinic</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Owner Name *</label>
                    <input name="owner_name" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pharmacist In Charge *</label>
                    <input name="pharmacist_in_charge" className="form-input" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Years of Operation</label>
                    <input name="years_of_operation" type="number" className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Operating Hours</label>
                    <input name="operating_hours" className="form-input" placeholder="e.g. 8 AM - 11 PM" />
                  </div>
                </div>
              </div>
              <div className="card-section">
                <h4>License Information</h4>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Registration No. *</label>
                    <input name="registration_number" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Drug License No. *</label>
                    <input name="drug_license_number" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Number</label>
                    <input name="gst_number" className="form-input" />
                  </div>
                </div>
              </div>
              <div className="card-section">
                <h4>Services</h4>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <label className="form-checkbox"><input name="home_delivery" type="checkbox" /> Home Delivery</label>
                  <label className="form-checkbox"><input name="available_24x7" type="checkbox" /> 24×7 Availability</label>
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Service Radius (km)</label>
                  <input name="service_radius_km" type="number" className="form-input" defaultValue={5} placeholder="e.g. 5" />
                </div>
              </div>
            </>
          )}

          {/* ─── Additional Documents ─── */}
          {role !== "patient" && role !== "staff" && (
            <div className="card-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>Additional Documents (Optional)</h4>
                <button type="button" onClick={addDocumentField} className="btn btn-secondary btn-sm" style={{ backgroundColor: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                  + Add Document
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 16 }}>
                Upload any additional certificates (e.g., PG Certificate, MBBS Certificate, Fellowship, Clinic License, etc.) to strengthen your profile.
              </p>
              
              {additionalDocs.map(doc => (
                <div key={doc.id} className="form-group" style={{ marginBottom: 16, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Document Name (e.g., PG Certificate)" 
                      value={doc.name} 
                      onChange={(e) => handleDocNameChange(doc.id, e.target.value)}
                      required 
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => removeDocumentField(doc.id)} className="btn btn-secondary btn-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                      ✕ Remove
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input" style={{ flex: 1 }} required onChange={(e) => { const f = e.target.files?.[0]; if (f) { const err = validateFileSize(f); if (err) { alert(err); e.target.value = ""; } } }} />
                    {verificationStatus[`doc_${doc.id}`] === 'verified' ? (
                        <span style={{ color: '#2f855a', fontWeight: 600 }}>✅ AI Verified</span>
                    ) : verificationStatus[`doc_${doc.id}`] === 'verifying' ? (
                        <span style={{ color: '#d69e2e', fontWeight: 600 }}>⏳ Verifying...</span>
                    ) : (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSimulateAIVerification(`doc_${doc.id}`)}>
                            Verify via AI
                        </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Aadhaar Card Upload (mandatory for doctor, nurse, phlebo) ─── */}
          {(role === "doctor" || role === "nurse" || role === "phlebotomist") && (
            <div className="card-section">
              <h4 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={20} style={{ color: "var(--cm-active)" }} /> Identity Verification — Aadhaar Card
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
                Upload your Aadhaar card (front side) for AI-based identity verification.
                Your name on the Aadhaar must match your registered name above.
                <strong style={{ color: '#dc2626' }}> (Mandatory)</strong>
              </p>
              <div className="form-group" style={{ padding: 16, backgroundColor: '#fffbeb', borderRadius: 8, border: '1px dashed #f59e0b' }}>
                <label className="form-label">Upload Aadhaar Card (Front Side) *</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="form-input" style={{ flex: 1 }} required />
                  {verificationStatus['aadhaar'] === 'verified' ? (
                      <span style={{ color: 'var(--cm-done)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={14} /> AI Verified
                      </span>
                  ) : verificationStatus['aadhaar'] === 'verifying' ? (
                      <span style={{ color: 'var(--cm-waiting)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={14} /> Verifying...
                      </span>
                  ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSimulateAIVerification('aadhaar')}>
                          Verify via AI
                      </button>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> Our AI will verify your Aadhaar card is genuine and your name matches your registration.
                  Only the last 4 digits of your Aadhaar number are stored for privacy.
                </div>
              </div>

              <div style={{
                backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
                padding: '12px 16px', marginTop: 16, fontSize: '0.8rem', color: '#0369a1',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Camera size={16} />
                <span>
                  <strong>Live Selfie Verification</strong> will be done after registration from your dashboard.
                  This is not required at signup.
                </span>
              </div>
            </div>
          )}

          {/* ─── MOU Notice (non-patient roles) ─── */}
          {role !== "patient" && (
            <div className="card-section">
              <div style={{ 
                backgroundColor: '#fefce8', 
                border: '1px solid #fde68a', 
                borderRadius: 8, 
                padding: '16px',
                fontSize: '0.9rem',
                color: '#92400e'
              }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} /> MOU Agreement Required
                </strong>
                <p style={{ margin: '8px 0 0 0', lineHeight: 1.6 }}>
                  After submitting this form, we will send a <strong>Memorandum of Understanding (MOU)</strong> specific 
                  to your role ({ROLES.find((r) => r.value === role)?.label}) to your email. You must review and accept 
                  it to activate your account. This is a legal requirement for all providers on CallMedex.
                </p>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? "Processing..." : role === "patient" ? "Create Patient Account" : `Register & Send MOU to Email`}
          </button>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.9rem", color: "var(--color-gray-500)" }}>
            Already have an account? <a href="/auth/login" style={{ color: "var(--color-navy)", fontWeight: 600 }}>Login</a>
          </p>
        </form>
      </div>
    </div>
  );
}
