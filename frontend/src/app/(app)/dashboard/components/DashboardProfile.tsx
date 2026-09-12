"use client";

import { useState, useEffect, useRef } from "react";
import { Icon, Panel, Pill } from "@/components/ui";
import {
  Building2, Clock, FileText, FlaskConical, GraduationCap, Mail,
  MapPin, Package, Phone, Stethoscope, Syringe, User, Pencil, Check,
  X, ShieldCheck, Sparkles, AlertCircle, CheckCircle2, Award, Lock, Download
} from "@/components/ui/icons";
import { Camera, Upload, Trash2, RefreshCw } from "lucide-react";
import type { LucideIcon } from "@/components/ui/icons";

interface DashboardProfileProps {
  profile: any;
  role: string;
  onProfileUpdated?: (updated: any) => void;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

export default function DashboardProfile({ profile, role, onProfileUpdated }: DashboardProfileProps) {
  const [currentProfile, setCurrentProfile] = useState<any>(profile || {});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Profile Photo Studio state
  const [profilePhoto, setProfilePhoto] = useState<string>(
    profile?.profile_photo_url || ""
  );
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (["doctor", "dentist", "physiotherapist", "dietitian", "nurse"].includes(role)) {
      fetch(`${apiBase}/api/providers/my-profile-photo`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile_photo_url) {
            setProfilePhoto(data.profile_photo_url);
          }
        })
        .catch(() => {});
    }
  }, [role]);

  // Edit form state
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || profile?.organization_name || "",
    mobile: profile?.mobile || profile?.mobile_number || profile?.phone || "",
    specialization: profile?.specialization || "",
    qualification: profile?.qualification || "",
    hospital_clinic_name: profile?.hospital_clinic_name || profile?.clinic_name || "",
    medical_license_number: profile?.medical_license_number || profile?.license_number || profile?.registration_number || "",
    years_of_experience: profile?.years_of_experience || 0,
    bio: profile?.bio || "",
    fee_justification: profile?.fee_justification || "",
    urgent_home_visit_fee: profile?.urgent_home_visit_fee || "",
    normal_home_visit_fee: profile?.normal_home_visit_fee || "",
  });

  // MOU Modal State
  const [showMOUModal, setShowMOUModal] = useState(false);
  const [mouLoading, setMOULoading] = useState(false);
  const [mouData, setMOUData] = useState<any>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string>("");

  if (!profile && !currentProfile) return null;

  const p = currentProfile || profile;

  // Open MOU Modal & fetch official details
  const handleOpenMOU = async (subtype?: string) => {
    setShowMOUModal(true);
    setMOULoading(true);
    const activeSub = subtype !== undefined ? subtype : selectedSubtype;
    if (subtype !== undefined) {
      setSelectedSubtype(subtype);
    }
    try {
      const url = `${apiBase}/api/providers/mou${activeSub ? `?subtype=${encodeURIComponent(activeSub)}` : ""}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMOUData(data);
      }
    } catch (e) {
      console.error("Failed to load MOU:", e);
    } finally {
      setMOULoading(false);
    }
  };

  // Save edited profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/providers/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          mobile: formData.mobile,
          specialization: formData.specialization,
          qualification: formData.qualification,
          hospital_clinic_name: formData.hospital_clinic_name,
          medical_license_number: formData.medical_license_number,
          years_of_experience: Number(formData.years_of_experience) || 0,
          bio: formData.bio,
          fee_justification: formData.fee_justification,
          urgent_home_visit_fee: formData.urgent_home_visit_fee ? Number(formData.urgent_home_visit_fee) : undefined,
          normal_home_visit_fee: formData.normal_home_visit_fee ? Number(formData.normal_home_visit_fee) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveMsg({ text: "Professional credentials and fee presentation updated successfully.", ok: true });
        setIsEditing(false);
        const updated = { ...currentProfile, ...formData };
        setCurrentProfile(updated);
        if (onProfileUpdated) onProfileUpdated(updated);
      } else {
        setSaveMsg({ text: data.detail || "Failed to update profile.", ok: false });
      }
    } catch {
      setSaveMsg({ text: "Network error saving profile changes.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoUpload(file);
    e.target.value = "";
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    setPhotoError(null);
    setPhotoSuccess(null);

    // Guard: max 4MB
    if (file.size > 4 * 1024 * 1024) {
      setPhotoError("Profile photo must be less than 4MB.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext || "")) {
      setPhotoError("Please select a JPEG, PNG, or WebP image.");
      return;
    }

    setPhotoUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`${apiBase}/api/providers/profile-photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfilePhoto(data.profile_photo_url);
        setPhotoSuccess("Practitioner photo verified and published to consultation & booking.");
        if (onProfileUpdated) {
          onProfileUpdated({ ...currentProfile, profile_photo_url: data.profile_photo_url });
        }
      } else {
        setPhotoError(data.detail || "Failed to upload photo. Please verify image format.");
      }
    } catch (err) {
      console.error(err);
      setPhotoError("Network error while uploading photo.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;
    setPhotoUploading(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      const res = await fetch(`${apiBase}/api/providers/profile-photo`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfilePhoto("");
        setPhotoSuccess("Profile photo removed.");
        if (onProfileUpdated) {
          onProfileUpdated({ ...currentProfile, profile_photo_url: "" });
        }
      } else {
        setPhotoError(data.detail || "Failed to remove photo.");
      }
    } catch (err) {
      console.error(err);
      setPhotoError("Network error while removing photo.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const isPractitioner = ["doctor", "dentist", "physiotherapist", "dietitian", "nurse"].includes(role);
  const initials = (formData.full_name || p.full_name || "DR")
    .split(" ")
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const field = (icon: LucideIcon, label: string, value: unknown, capitalize = false) => {
    const valText = value ? String(value) : "N/A";
    return (
      <div className="cm-profile__item">
        <dt className="cm-profile__label">
          <Icon as={icon} size={14} />
          {label}
        </dt>
        <dd className={`cm-profile__value${capitalize ? " cm-profile__value--cap" : ""}`}>
          {valText}
        </dd>
      </div>
    );
  };

  return (
    <div className="cm-profile-stack">
      {saveMsg && (
        <div className={`cm-profile-alert ${saveMsg.ok ? "cm-profile-alert--ok" : "cm-profile-alert--err"}`}>
          <div className="cm-profile-alert__content">
            <Icon as={saveMsg.ok ? CheckCircle2 : AlertCircle} size={16} />
            <span>{saveMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveMsg(null)}
            className="cm-profile-alert__close"
            aria-label="Dismiss message"
          >
            <Icon as={X} size={16} />
          </button>
        </div>
      )}

      {/* Practitioner Profile Photo Studio (CallMedex Style) */}
      {isPractitioner && (
        <div className="cm-profile-studio">
          {/* Avatar Preview */}
          <div className="cm-profile-studio__avatar-col">
            <div className="cm-profile-studio__avatar-wrap">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt={formData.full_name || "Practitioner"}
                  className="cm-profile-studio__avatar-img"
                />
              ) : (
                <div className="cm-profile-studio__avatar-placeholder">
                  {initials}
                </div>
              )}
              {profilePhoto && (
                <div className="cm-profile-studio__verified-badge" title="Photo Verified">
                  <CheckCircle2 size={16} />
                </div>
              )}
            </div>

            <span
              className={`cm-profile-studio__status ${
                profilePhoto ? "cm-profile-studio__status--active" : "cm-profile-studio__status--pending"
              }`}
            >
              ● {profilePhoto ? "PHOTO ACTIVE" : "PHOTO RECOMMENDED"}
            </span>
          </div>

          {/* Controls & Guidance */}
          <div className="cm-profile-studio__body">
            <div className="cm-profile-studio__header">
              <Sparkles size={16} className="cm-profile-studio__icon" />
              <h3 className="cm-profile-studio__title">
                Practitioner Profile Photo &amp; Patient Trust Representation
              </h3>
            </div>
            <p className="cm-profile-studio__desc">
              Your verified photo replaces generic placeholder icons on the public <strong>Consultation Directory</strong>, <strong>Tariff Justification Modal</strong>, and <strong>Video Consultation Waiting Room</strong>. Photos must be under 4MB (JPEG, PNG, or WebP).
            </p>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoFileChange}
              className="cm-profile-studio__file-input"
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="user"
              onChange={handlePhotoFileChange}
              className="cm-profile-studio__file-input"
            />

            {/* Buttons */}
            <div className="cm-profile-studio__actions">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="cm-profile-studio__btn-primary"
              >
                {photoUploading ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Upload size={15} />
                )}
                <span>{photoUploading ? "Uploading Photo..." : "Choose Profile Photo"}</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={photoUploading}
                className="cm-profile-studio__btn-secondary"
              >
                <Camera size={15} />
                <span>Take Live Photo</span>
              </button>

              {profilePhoto && (
                <button
                  type="button"
                  onClick={handleDeletePhoto}
                  disabled={photoUploading}
                  className="cm-profile-studio__btn-danger"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {/* Success & Error alerts */}
            {photoSuccess && (
              <div className="cm-profile-studio__alert-success">
                <CheckCircle2 size={15} />
                <span>{photoSuccess}</span>
              </div>
            )}
            {photoError && (
              <div className="cm-profile-studio__alert-error">
                <AlertCircle size={15} />
                <span>{photoError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Header Actions: Edit & View MOU */}
      <Panel>
        <div className="cm-profile__head">
          <div className="cm-profile__actions">
            <h2 className="cm-profile__title">
              <Icon as={User} size={20} />
              Registration &amp; Clinical Service Profile
            </h2>
            {(() => {
              const status = String(p.verification_status || "").toLowerCase();
              if (status === "verified") return <Pill tone="done">{role.toUpperCase()} VERIFIED</Pill>;
              if (status === "rejected") return <Pill tone="urgent">VERIFICATION REJECTED</Pill>;
              return <Pill tone="waiting">VERIFICATION PENDING</Pill>;
            })()}
          </div>

          <div className="cm-profile__actions">
            {/* View Agreed MOU Glassmorphic Button */}
            <button
              type="button"
              onClick={() => handleOpenMOU()}
              className="cm-profile__mou-btn"
            >
              <Icon as={FileText} size={16} />
              <span>View Agreed MOU &amp; Terms</span>
            </button>

            {/* Toggle Edit Credentials */}
            <button
              type="button"
              onClick={() => {
                setIsEditing(!isEditing);
                setFormData({
                  full_name: p.full_name || p.organization_name || "",
                  mobile: p.mobile || p.mobile_number || p.phone || "",
                  specialization: p.specialization || "",
                  qualification: p.qualification || "",
                  hospital_clinic_name: p.hospital_clinic_name || p.clinic_name || "",
                  medical_license_number: p.medical_license_number || p.license_number || p.registration_number || "",
                  years_of_experience: p.years_of_experience || 0,
                  bio: p.bio || "",
                  fee_justification: p.fee_justification || "",
                  urgent_home_visit_fee: p.urgent_home_visit_fee || "",
                  normal_home_visit_fee: p.normal_home_visit_fee || "",
                });
              }}
              className="cm-btn cm-btn--secondary cm-btn--sm"
            >
              <Icon as={isEditing ? X : Pencil} size={14} />
              <span>{isEditing ? "Cancel Edit" : "Edit Profile & Credentials"}</span>
            </button>
          </div>
        </div>

        {String(p.verification_status || "").toLowerCase() !== "verified" && (
          <p className="cm-profile__notice">
            <Icon as={ShieldCheck} size={16} /> <strong>Production Verification Status:</strong> Your credentials are currently pending official NMC council audit. You can edit your specialization, degrees, and fee justifications below.
          </p>
        )}

        {/* Edit Form Mode */}
        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="cm-profile__edit-form">
            <div className="cm-profile__form-grid">
              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Practitioner Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="cm-input"
                  required
                />
              </div>

              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Contact Mobile Number
                </label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="cm-input"
                />
              </div>

              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Clinical Specialization
                </label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="e.g. General Medicine, Cardiology, Orthopaedics"
                  className="cm-input"
                />
              </div>

              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Degrees / Qualification
                </label>
                <input
                  type="text"
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                  placeholder="e.g. MBBS, MD (General Medicine)"
                  className="cm-input"
                />
              </div>

              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Hospital / Solo Clinic Name
                </label>
                <input
                  type="text"
                  value={formData.hospital_clinic_name}
                  onChange={(e) => setFormData({ ...formData, hospital_clinic_name: e.target.value })}
                  placeholder="e.g. Naidu Healthcare Clinic"
                  className="cm-input"
                />
              </div>

              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Medical Council License / Reg Number
                </label>
                <input
                  type="text"
                  value={formData.medical_license_number}
                  onChange={(e) => setFormData({ ...formData, medical_license_number: e.target.value })}
                  placeholder="e.g. APMC-64821-NMC"
                  className="cm-input"
                />
              </div>

              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Years of Clinical Experience
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={formData.years_of_experience}
                  onChange={(e) => setFormData({ ...formData, years_of_experience: Number(e.target.value) })}
                  className="cm-input"
                />
              </div>
            </div>

            {/* Presentation & Fee Justification Fields */}
            <div className="cm-profile__justification-box">
              <h4 className="cm-profile__justification-title">
                <Icon as={Sparkles} size={16} />
                <span>Public Presentation &amp; Fee Justification</span>
              </h4>

              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Fee Justification Statement (Visible to patients when booking your service)
                </label>
                <textarea
                  rows={3}
                  value={formData.fee_justification}
                  onChange={(e) => setFormData({ ...formData, fee_justification: e.target.value })}
                  placeholder="Explain the clinical quality, dedicated evaluation time, diagnostic thoroughness, and digital prescription window justifying your fees..."
                  className="cm-input cm-input--area"
                />
              </div>

              <div className="cm-profile__form-group">
                <label className="cm-profile__form-label">
                  Clinical Background &amp; Practice Focus (Bio)
                </label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Briefly describe your clinical philosophy, specialty focus, training, and patient care approach..."
                  className="cm-input cm-input--area"
                />
              </div>
            </div>

            <div className="cm-profile__form-actions">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="cm-btn cm-btn--secondary cm-btn--sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="cm-btn cm-btn--primary cm-btn--sm"
              >
                <Icon as={Check} size={14} />
                <span>{saving ? "Saving Changes..." : "Save Profile Changes"}</span>
              </button>
            </div>
          </form>
        ) : (
          /* View Profile Mode */
          <dl className="cm-profile">
            {field(User, "Full Name", p.full_name || p.organization_name || p.pharmacy_name)}
            {field(Mail, "Email Address", p.email)}
            {field(Phone, "Phone Number", p.mobile || p.mobile_number || p.phone)}

            {/* Doctor specific details */}
            {role === "doctor" && (
              <>
                {field(Stethoscope, "Specialization", p.specialization)}
                {field(GraduationCap, "Qualification", p.qualification)}
                {field(FileText, "Medical License Number", p.medical_license_number)}
                {field(Building2, "Hospital / Clinic Name", p.hospital_clinic_name)}
                {field(Clock, "Years of Experience", p.years_of_experience ? `${p.years_of_experience} Years` : "N/A")}
              </>
            )}

            {/* Nurse specific details */}
            {role === "nurse" && (
              <>
                {field(Stethoscope, "Nursing Specialization", p.specialization)}
                {field(FileText, "Nursing Council Reg No", p.license_number || p.registration_number)}
                {field(MapPin, "Service City", p.district || p.city)}
              </>
            )}

            {/* Phlebotomist specific details */}
            {role === "phlebotomist" && (
              <>
                {field(Syringe, "Employment Type", p.phleb_type?.replace("_", " "), true)}
                {field(FileText, "Certification Number", p.certification_number)}
                {field(FlaskConical, "Specimen Handling", "Cold-Chain Certified (2C-8C)")}
              </>
            )}

            {/* Dentist specific details */}
            {role === "dentist" && (
              <>
                {field(Building2, "Dental Clinic Name", p.clinic_name || p.hospital_clinic_name)}
                {field(FileText, "Dental Council Reg No", p.dental_council_reg || p.registration_number || p.license_number)}
                {field(GraduationCap, "Dental Qualification", p.qualification || "BDS / MDS")}
              </>
            )}

            {/* Physiotherapist specific details */}
            {role === "physiotherapist" && (
              <>
                {field(Stethoscope, "Therapy Specialization", p.specialization || "Orthopaedic & Neuro Rehabilitation")}
                {field(FileText, "Physiotherapy Reg No", p.license_number || p.registration_number)}
                {field(GraduationCap, "Clinical Qualification", p.qualification || "BPT / MPT Physical Therapy")}
              </>
            )}

            {/* Pharmacy specific details */}
            {role === "pharmacy" && (
              <>
                {field(FileText, "Pharmacy Reg Number", p.registration_number)}
                {field(Package, "Home Medicine Delivery", p.home_delivery ? "Enabled (30-Min Express)" : "Store Pick-Up Only")}
                {field(MapPin, "Delivery Radius", `${p.service_radius_km || 5} km Radius`)}
              </>
            )}

            {/* Organization specific details */}
            {role === "organization" && (
              <>
                {field(Building2, "Organization Type", p.organization_type, true)}
                {field(FileText, "Hospital License No", p.license_number)}
                {field(Clock, "Operating Hours", p.operating_hours || "24x7 Emergency OPD")}
              </>
            )}
          </dl>
        )}
      </Panel>

      {/* Professional Presentation & Fee Justification Widget */}
      <div className="cm-presentation-card">
        <div className="cm-presentation-card__head">
          <div>
            <div className="cm-presentation-card__meta">
              <span className="cm-presentation-card__badge">
                Patient-Facing Presentation
              </span>
              <span className="cm-presentation-card__sub">
                Visible to patients on booking
              </span>
            </div>
            <h3 className="cm-presentation-card__title">
              <Icon as={Award} size={20} />
              <span>Professional Presentation &amp; Fee Justification</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="cm-presentation-card__edit-btn"
          >
            <Icon as={Pencil} size={14} />
            <span>Update Presentation</span>
          </button>
        </div>

        <div className="cm-presentation-card__grid">
          {/* Clinical Bio & Philosophy */}
          <div className="cm-presentation-card__col">
            <div className="cm-presentation-card__col-title cm-presentation-card__col-title--bio">
              <Icon as={Stethoscope} size={14} />
              <span>Clinical Background &amp; Focus</span>
            </div>
            <p className="cm-presentation-card__text">
              {p.bio || "Senior clinician dedicated to evidence-based diagnostic evaluation, patient-centric treatment protocols, and continuous chronic health optimization."}
            </p>
          </div>

          {/* Fee Justification */}
          <div className="cm-presentation-card__col cm-presentation-card__col--justification">
            <div className="cm-presentation-card__col-title">
              <Icon as={ShieldCheck} size={14} />
              <span>Consultation Fee Justification</span>
            </div>
            <p className="cm-presentation-card__text">
              {p.fee_justification || "Consultation tariffs cover comprehensive clinical examination, personalized diagnostic review, official signed digital e-prescriptions, and a 24-hour follow-up inquiry window."}
            </p>
          </div>
        </div>
      </div>

      {/* Glassmorphic MOU Viewer Modal */}
      {showMOUModal && (
        <div
          className="cm-overlay"
          onClick={() => setShowMOUModal(false)}
        >
          <div
            className="cm-modal cm-modal--mou"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="cm-modal__head">
              <div className="cm-profile__actions">
                <div className="cm-mou-header-icon">
                  <Icon as={FileText} size={20} />
                </div>
                <div>
                  <h3 className="cm-mou-header-title">
                    {mouData?.document?.title || "Official Memorandum of Understanding (MOU)"}
                  </h3>
                  <div className="cm-mou-header-subtitle">
                    CallMedex Provider Agreement · Role: <span className="cm-mou-header-role">{role}</span> · Legal Document Store
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMOUModal(false)}
                className="cm-modal__x"
                aria-label="Close dialog"
              >
                <Icon as={X} size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="cm-mou-body">
              {mouLoading ? (
                <div className="cm-mou-loading">
                  <Icon as={Clock} size={24} />
                  <div>Loading verified official agreement text...</div>
                </div>
              ) : (
                <>
                  {/* Digital Signature & Audit Strip */}
                  <div className="cm-mou-audit-strip">
                    <div>
                      <div className="cm-mou-audit-title">
                        <Icon as={CheckCircle2} size={16} />
                        <span>Digitally Accepted &amp; Legally Binding</span>
                      </div>
                      <div className="cm-mou-audit-meta">
                        Practitioner / Facility: <strong>{p.full_name || p.organization_name || "Enrolled Provider"}</strong>
                      </div>
                    </div>
                    <div className="cm-mou-audit-meta-right">
                      <div>Document Version: <strong>{mouData?.document?.version || "v1.0"}</strong></div>
                      <div>Effective Date: <strong>{mouData?.document?.effective_date || "2026-01-01"}</strong></div>
                      <div>Status: <strong className="cm-mou-audit-status">ENFORCED &amp; BINDING</strong></div>
                    </div>
                  </div>

                  {/* Subtype Selector (e.g. for Phlebotomists: Full-Time vs Part-Time; Organizations: Diagnostic vs ECG/X-Ray) */}
                  {(role === "phlebotomist" || role === "organization") && (
                    <div className="cm-mou-subtypes">
                      {role === "phlebotomist" && [
                        { id: "full_time", label: "Full-Time Phlebotomist Agreement" },
                        { id: "part_time", label: "Part-Time Phlebotomist Agreement" },
                      ].map((sub) => {
                        const active = (selectedSubtype || "full_time") === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleOpenMOU(sub.id)}
                            className={`cm-mou-subtype-btn ${active ? "cm-mou-subtype-btn--active" : ""}`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}

                      {role === "organization" && [
                        { id: "diagnostic", label: "Diagnostic Services Agreement" },
                        { id: "ecg_xray", label: "ECG & X-Ray Center Agreement" },
                      ].map((sub) => {
                        const active = (selectedSubtype || "diagnostic") === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleOpenMOU(sub.id)}
                            className={`cm-mou-subtype-btn ${active ? "cm-mou-subtype-btn--active" : ""}`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Complete Unabridged Text Content */}
                  <div className="cm-mou-content">
                    {mouData?.document?.content_text || "Document text currently unavailable."}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="cm-mou-foot">
              <div className="cm-mou-foot-legal">
                <Icon as={Lock} size={14} />
                <span>CallMedex Legal Protocol · ABDM &amp; DPDP Act 2023 Compliant</span>
              </div>
              <div className="cm-mou-foot-actions">
                {mouData?.document?.content_text && (
                  <button
                    type="button"
                    onClick={() => {
                      const element = document.createElement("a");
                      const file = new Blob([mouData.document.content_text], { type: "text/plain;charset=utf-8" });
                      element.href = URL.createObjectURL(file);
                      element.download = `${(mouData.document.title || `CallMedex_${role}_MOU`).replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                    }}
                    className="cm-btn cm-btn--secondary cm-btn--sm cm-mou-download-btn"
                  >
                    <Icon as={Download} size={14} />
                    <span>Download Text</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMOUModal(false)}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                >
                  Close MOU Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
