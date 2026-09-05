"use client";

import { useState } from "react";
import { Icon, Panel, Pill } from "@/components/ui";
import {
  Building2, Clock, FileText, FlaskConical, GraduationCap, Mail,
  MapPin, Package, Phone, Stethoscope, Syringe, User, Edit3, Check,
  X, ShieldCheck, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Award
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

  if (!profile && !currentProfile) return null;

  const p = currentProfile || profile;

  // Open MOU Modal & fetch official details
  const handleOpenMOU = async () => {
    setShowMOUModal(true);
    setMOULoading(true);
    try {
      const res = await fetch(`${apiBase}/api/providers/mou`, {
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
        setSaveMsg({ text: "✓ Professional credentials and fee presentation updated successfully.", ok: true });
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-5, 20px)" }}>
      {saveMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--cm-radius, 10px)",
            background: saveMsg.ok ? "var(--cm-done-surface, #f0fdf4)" : "var(--cm-urgent-surface, #fef2f2)",
            color: saveMsg.ok ? "var(--cm-done, #16a34a)" : "var(--cm-urgent, #dc2626)",
            border: `1px solid ${saveMsg.ok ? "var(--cm-done-line, #bbf7d0)" : "var(--cm-urgent-line, #fecaca)"}`,
            fontSize: "var(--cm-text-sm, 14px)",
            fontWeight: 700,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saveMsg.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{saveMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveMsg(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: "bold" }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Top Header Actions: Edit & View MOU ──────────────────────────── */}
      <Panel>
        <div className="cm-profile__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 className="cm-profile__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* View Agreed MOU Glassmorphic Button */}
            <button
              type="button"
              onClick={handleOpenMOU}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, rgba(30, 58, 138, 0.15) 0%, rgba(2, 132, 199, 0.15) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(2, 132, 199, 0.35)",
                color: "var(--cm-navy, #1e3a8a)",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.12)",
                transition: "all 0.2s ease",
              }}
            >
              <FileText size={15} style={{ color: "#0284c7" }} />
              View Agreed MOU &amp; Terms
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
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              {isEditing ? <X size={14} /> : <Edit3 size={14} />}
              {isEditing ? "Cancel Edit" : "Edit Profile & Credentials"}
            </button>
          </div>
        </div>

        {String(p.verification_status || "").toLowerCase() !== "verified" && (
          <p className="cm-profile__notice" style={{ marginTop: 12 }}>
            🛡️ <strong>Production Verification Status:</strong> Your credentials are currently pending official NMC council audit. You can edit your specialization, degrees, and fee justifications below.
          </p>
        )}

        {/* ── Edit Form Mode ─────────────────────────────────────────────── */}
        {isEditing ? (
          <form onSubmit={handleSaveProfile} style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Practitioner Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "14px" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Contact Mobile Number
                </label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Clinical Specialization (e.g. General Medicine, Cardiology)
                </label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="e.g. General Medicine, Cardiology, Orthopaedics"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Degrees / Qualification (e.g. MBBS, MD, MS)
                </label>
                <input
                  type="text"
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                  placeholder="e.g. MBBS, MD (General Medicine)"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Hospital / Solo Clinic Name
                </label>
                <input
                  type="text"
                  value={formData.hospital_clinic_name}
                  onChange={(e) => setFormData({ ...formData, hospital_clinic_name: e.target.value })}
                  placeholder="e.g. Naidu Healthcare Clinic"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Medical Council License / Reg Number
                </label>
                <input
                  type="text"
                  value={formData.medical_license_number}
                  onChange={(e) => setFormData({ ...formData, medical_license_number: e.target.value })}
                  placeholder="e.g. APMC-64821-NMC"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Years of Clinical Experience
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={formData.years_of_experience}
                  onChange={(e) => setFormData({ ...formData, years_of_experience: Number(e.target.value) })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "14px" }}
                />
              </div>
            </div>

            {/* Presentation & Fee Justification Fields */}
            <div style={{ marginTop: 10, background: "var(--cm-surface-2, #f8fafc)", padding: "16px", borderRadius: 10, border: "1px solid var(--cm-line)" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 800, color: "var(--cm-navy, #1e3a8a)", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={16} /> Public Presentation &amp; Fee Justification
              </h4>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Fee Justification Statement (Visible to patients when booking your service)
                </label>
                <textarea
                  rows={3}
                  value={formData.fee_justification}
                  onChange={(e) => setFormData({ ...formData, fee_justification: e.target.value })}
                  placeholder="Explain the clinical quality, dedicated evaluation time, diagnostic thoroughness, and digital prescription window justifying your fees..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "13px", lineHeight: 1.5 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Clinical Background &amp; Practice Focus (Bio)
                </label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Briefly describe your clinical philosophy, specialty focus, training, and patient care approach..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "13px", lineHeight: 1.5 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
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
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                {saving ? "Saving Changes..." : <><Check size={14} /> Save Profile Changes</>}
              </button>
            </div>
          </form>
        ) : (
          /* ── View Profile Mode ────────────────────────────────────────── */
          <dl className="cm-profile" style={{ marginTop: 16 }}>
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
                {field(FlaskConical, "Specimen Handling", "Cold-Chain Certified (2°C–8°C)")}
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
          </dl>
        )}
      </Panel>

      {/* ── Professional Presentation & Fee Justification Widget ───────── */}
      <div
        style={{
          borderRadius: "16px",
          padding: "24px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          color: "#f8fafc",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(2, 132, 199, 0.3)", color: "#38bdf8", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                Patient-Facing Presentation
              </span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                Visible to patients on booking
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              <Award size={20} style={{ color: "#38bdf8" }} />
              Professional Presentation &amp; Fee Justification
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "6px 12px",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Edit3 size={13} /> Update Presentation
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {/* Clinical Bio & Philosophy */}
          <div style={{ background: "rgba(255, 255, 255, 0.05)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Stethoscope size={14} /> Clinical Background &amp; Focus
            </div>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: "rgba(255, 255, 255, 0.85)" }}>
              {p.bio || "Senior clinician dedicated to evidence-based diagnostic evaluation, patient-centric treatment protocols, and continuous chronic health optimization."}
            </p>
          </div>

          {/* Fee Justification */}
          <div style={{ background: "rgba(255, 255, 255, 0.05)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(56, 189, 248, 0.25)" }}>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={14} /> Consultation Fee Justification
            </div>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: "rgba(255, 255, 255, 0.9)" }}>
              {p.fee_justification || "Consultation tariffs cover comprehensive clinical examination, personalized diagnostic review, official signed digital e-prescriptions, and a 24-hour follow-up inquiry window."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Glassmorphic MOU Viewer Modal ───────────────────────────────── */}
      {showMOUModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(10px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowMOUModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "760px",
              maxHeight: "88vh",
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              borderRadius: "20px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
              color: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(2, 132, 199, 0.2)", border: "1px solid rgba(2, 132, 199, 0.4)", display: "grid", placeItems: "center", color: "#38bdf8" }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#fff" }}>
                    Memorandum of Understanding (MOU)
                  </h3>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: 2 }}>
                    CallMedex Healthcare Partner Agreement · Role: <span style={{ textTransform: "capitalize", color: "#38bdf8", fontWeight: 700 }}>{role}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMOUModal(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body with smooth scrolling */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
              {mouLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                  <Clock size={32} style={{ margin: "0 auto 8px", animation: "spin 1s linear infinite" }} />
                  <div>Loading verified agreement text...</div>
                </div>
              ) : (
                <>
                  {/* Digital Signature & Audit Strip */}
                  <div
                    style={{
                      background: "rgba(34, 197, 94, 0.1)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      borderRadius: "12px",
                      padding: "14px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#4ade80", display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle2 size={16} /> Digitally Accepted &amp; Legally Binding
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.8)", marginTop: 4 }}>
                        Practitioner: <strong>{p.full_name || "Enrolled Provider"}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "11px", color: "rgba(255, 255, 255, 0.6)" }}>
                      <div>Document Version: <strong>{mouData?.document?.version || "v1.0"}</strong></div>
                      <div>Status: <strong style={{ color: "#4ade80" }}>ENFORCED</strong></div>
                    </div>
                  </div>

                  {/* Agreement Terms Summary Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>80/20 Revenue Share</div>
                      <div style={{ fontSize: "12px", color: "#e2e8f0", marginTop: 4 }}>Practitioner retains 80% net earnings; 20% platform charge covers infrastructure.</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>Daily Direct Settlement</div>
                      <div style={{ fontSize: "12px", color: "#e2e8f0", marginTop: 4 }}>Batched daily clearing via IMPS/NEFT with zero processing fee deductions.</div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>Clinical Autonomy</div>
                      <div style={{ fontSize: "12px", color: "#e2e8f0", marginTop: 4 }}>Full clinical independence to configure custom practice fees and shift availability.</div>
                    </div>
                  </div>

                  {/* Full Text Content */}
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.25)",
                      borderRadius: "12px",
                      padding: "18px",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      fontSize: "12px",
                      lineHeight: 1.7,
                      color: "#cbd5e1",
                      whiteSpace: "pre-wrap",
                      maxHeight: "260px",
                      overflowY: "auto",
                      fontFamily: "monospace",
                    }}
                  >
                    {mouData?.document?.content_text ||
                      `MEMORANDUM OF UNDERSTANDING (MOU)
CALLMEDEX DIGITAL HEALTHCARE PLATFORM & HEALTHCARE PRACTITIONER

1. SCOPE & CLINICAL AUTONOMY
The Practitioner provides professional healthcare consultations (in-person clinic, teleconsultation, or home visits) in accordance with the Telemedicine Practice Guidelines 2026 and National Medical Commission (NMC) regulations. The Practitioner maintains sole clinical authority and judgment over patient diagnosis, treatment protocols, and prescription decisions.

2. COMMERCIAL TARIFFS & 80/20 SETTLEMENT
Practitioner receives 80% (eighty percent) of the gross consultation tariff billed to the patient. CallMedex retains 20% (twenty percent) as technology platform charges, covering encrypted WebRTC video, digital electronic prescription transmission, cloud medical records, and payment gateway infrastructure.

3. SETTLEMENT DISPATCH
Cleared earnings are settled directly to the Practitioner's verified bank account on a daily batch schedule with zero unauthorized processing deductions.

4. CONFIDENTIALITY & EHR INTEGRITY
Patient health records, consultations, diagnostic data, and prescriptions are strictly protected under India's Digital Personal Data Protection (DPDP) Act 2023 and ABDM standards.`}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                🔒 CallMedex Legal Trust &amp; Compliance Protocol
              </div>
              <button
                type="button"
                onClick={() => setShowMOUModal(false)}
                className="cm-btn cm-btn--primary cm-btn--sm"
                style={{ padding: "8px 20px", fontWeight: 700 }}
              >
                Close MOU Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
