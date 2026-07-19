"use client";
import { useState, FormEvent } from "react";

const ROLES = [
  { value: "patient", label: "Patient", icon: "🧑‍🦱" },
  { value: "doctor", label: "Doctor", icon: "👨‍⚕️" },
  { value: "nurse", label: "Nurse", icon: "👩‍⚕️" },
  { value: "phlebotomist", label: "Phlebotomist", icon: "💉" },
  { value: "organization", label: "Organization", icon: "🏥" },
  { value: "staff", label: "Staff", icon: "👤" },
  { value: "pharmacy", label: "Pharmacy", icon: "💊" },
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
  { value: "general", label: "General Nursing" },
];

export default function SignupPage() {
  const [role, setRole] = useState("patient");
  const [medicalHistory, setMedicalHistory] = useState<string[]>([]);
  const [nursingSpecs, setNursingSpecs] = useState<string[]>([]);
  const [orgType, setOrgType] = useState("hospital");
  const [isIndependent, setIsIndependent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<Record<string, string>>({});

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
    if (password !== confirmPassword) { setError("Passwords do not match"); setLoading(false); return; }

    try {
      const body: Record<string, unknown> = {
        full_name: formData.get("full_name"),
        email: formData.get("email"),
        mobile: formData.get("mobile"),
        gender: formData.get("gender"),
        date_of_birth: formData.get("date_of_birth"),
        password, confirm_password: confirmPassword,
        role,
        address_info: {
          address: formData.get("address") || "",
          city: formData.get("city") || "",
          district: formData.get("district") || "",
          state: formData.get("state") || "",
          pincode: formData.get("pincode") || "",
          country: "India",
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
        body.medical_license_number = formData.get("medical_license_number");
        body.specialization = formData.get("specialization");
        body.qualification = formData.get("qualification");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.hospital_clinic_name = formData.get("hospital_clinic_name");
        body.consultation_mode = formData.get("consultation_mode") || "both";
        body.available_for_online = formData.get("available_for_online") === "on";
        body.is_independent = isIndependent;
        if (isIndependent) {
            body.service_area = formData.get("service_area");
        }
      }
      if (role === "nurse") {
        body.nursing_license_number = formData.get("nursing_license_number");
        body.qualification = formData.get("qualification");
        body.years_of_experience = Number(formData.get("years_of_experience")) || 0;
        body.nursing_specializations = nursingSpecs;
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
      if (!res.ok) throw new Error(data.detail || "Signup failed");
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
          <div style={{ fontSize: "4rem", marginBottom: 16 }}>{isMOURole ? "📧" : "✅"}</div>
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
                <p style={{ fontWeight: 600, marginBottom: 8, color: '#166534' }}>📋 Next Steps:</p>
                <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: '#15803d' }}>
                  <li>Open the email from <strong>CallMedex</strong></li>
                  <li>Click the secure link to review the MOU</li>
                  <li>Read the terms carefully</li>
                  <li>Click <strong>&quot;I Agree &amp; Activate My Account&quot;</strong></li>
                </ol>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
                ⏰ The link expires in 24 hours. Didn&apos;t receive it? Check your spam folder.
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
              <div className="role-option__icon">{r.icon}</div>
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
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</span>
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
            <h4>Personal Information</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input name="full_name" className="form-input" placeholder="Enter full name" required />
              </div>
              <div className="form-group">
                <label className="form-label">Gender *</label>
                <select name="gender" className="form-select" required>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date of Birth *</label>
                <input name="date_of_birth" type="date" className="form-input" required />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number *</label>
                <input name="mobile" type="tel" className="form-input" placeholder="+91 XXXXXXXXXX" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input name="email" type="email" className="form-input" placeholder="you@example.com" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input name="password" type="password" className="form-input" placeholder="Min 8 characters" minLength={8} required />
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
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">City</label>
                <input name="city" className="form-input" placeholder="City" />
              </div>
              <div className="form-group">
                <label className="form-label">District</label>
                <input name="district" className="form-input" placeholder="District" />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input name="state" className="form-input" placeholder="State" />
              </div>
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
              <h4>Professional Information</h4>
              
              <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-checkbox" style={{ fontWeight: 600, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <input type="checkbox" checked={isIndependent} onChange={(e) => setIsIndependent(e.target.checked)} />
                    Independent Practitioner (Home Visits)
                  </label>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Medical License Number *</label>
                  <input name="medical_license_number" className="form-input" placeholder="NMC/State License No." required />
                </div>
                <div className="form-group">
                  <label className="form-label">Specialization *</label>
                  <input name="specialization" className="form-input" placeholder="e.g. General Medicine" required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <label className="form-label">Upload Medical Registration Certificate *</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input" style={{ flex: 1 }} required />
                  {verificationStatus['doc_license'] === 'verified' ? (
                      <span style={{ color: '#2f855a', fontWeight: 600 }}>✅ AI Verified</span>
                  ) : verificationStatus['doc_license'] === 'verifying' ? (
                      <span style={{ color: '#d69e2e', fontWeight: 600 }}>⏳ Verifying...</span>
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
              
              {!isIndependent ? (
                  <div className="form-group">
                    <label className="form-label">Hospital/Clinic Name</label>
                    <input name="hospital_clinic_name" className="form-input" placeholder="Current affiliation" />
                  </div>
              ) : (
                  <div className="form-group">
                    <label className="form-label">Service Area (City/Locality) *</label>
                    <input name="service_area" className="form-input" placeholder="e.g. MVP Colony, Visakhapatnam" required={isIndependent} />
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

              {/* Fee info banner */}
              <div style={{ 
                backgroundColor: '#eff6ff', 
                border: '1px solid #bfdbfe', 
                borderRadius: 8, 
                padding: '12px 16px', 
                marginTop: 16,
                fontSize: '0.85rem',
                color: '#1e40af'
              }}>
                💡 <strong>Note:</strong> Consultation fees are managed centrally by CallMedex and will be communicated during onboarding. This ensures fair pricing and transparent settlement.
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
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input" style={{ flex: 1 }} required />
                  {verificationStatus['nurse_license'] === 'verified' ? (
                      <span style={{ color: '#2f855a', fontWeight: 600 }}>✅ AI Verified</span>
                  ) : verificationStatus['nurse_license'] === 'verifying' ? (
                      <span style={{ color: '#d69e2e', fontWeight: 600 }}>⏳ Verifying...</span>
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

              {/* Fee info banner */}
              <div style={{ 
                backgroundColor: '#eff6ff', 
                border: '1px solid #bfdbfe', 
                borderRadius: 8, 
                padding: '12px 16px', 
                marginTop: 16,
                fontSize: '0.85rem',
                color: '#1e40af'
              }}>
                💡 <strong>Note:</strong> Service fees are managed centrally by CallMedex. Patients are charged based on the service type and duration. Settlement is done as per the agreed structure.
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
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input" style={{ flex: 1 }} required />
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
                <strong>📋 MOU Agreement Required</strong>
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
