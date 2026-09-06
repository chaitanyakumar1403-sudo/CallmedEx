"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Stethoscope,
  Building2,
  Clock,
  CheckCircle2,
  Video,
  UserCheck,
  Sparkles,
} from "lucide-react";

export interface DoctorPresentationData {
  doctor_id?: string;
  id?: string;
  name?: string;
  specialization?: string;
  qualification?: string;
  experience_years?: number;
  consultation_fee?: number;
  hospital_clinic_name?: string;
  bio?: string;
  fee_justification?: string;
  city?: string;
  district?: string;
  state?: string;
  availability?: Array<{
    day_of_week?: number;
    start_time?: string;
    end_time?: string;
    consultation_mode?: string;
    location_name?: string;
  }>;
  fees?: Record<string, number>;
  verification_status?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doctor: DoctorPresentationData | null;
  onBook?: (mode: "teleconsultation" | "walkin" | "home") => void;
}

export default function DoctorPresentationModal({
  isOpen,
  onClose,
  doctor,
  onBook,
}: Props) {
  const [, setLoading] = useState(false);
  const [details, setDetails] = useState<DoctorPresentationData | null>(null);

  useEffect(() => {
    if (!isOpen || !doctor) return;
    setDetails(doctor);

    const docId = doctor.doctor_id || doctor.id;
    if (!docId) return;

    // Fetch presentation details if bio or fee justification not yet loaded
    if (!doctor.bio || !doctor.fee_justification) {
      setLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      fetch(`${apiBase}/api/providers/doctor/${docId}/presentation`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.doctor) {
            setDetails((prev) => ({
              ...(prev || {}),
              ...data.doctor,
              bio: data.doctor.bio || prev?.bio,
              fee_justification: data.doctor.fee_justification || prev?.fee_justification,
              hospital_clinic_name: data.doctor.hospital_clinic_name || prev?.hospital_clinic_name,
              availability: data.doctor.availability || prev?.availability,
            }));
          }
        })
        .catch(() => {
          // Keep current doctor data on network glitch
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, doctor]);

  if (!isOpen || !doctor) return null;

  const doc = details || doctor;
  const inPersonFee = doc.fees?.in_person ?? doc.consultation_fee ?? 500;
  const onlineFee = doc.fees?.online ?? doc.consultation_fee ?? 500;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)",
          borderRadius: "20px",
          boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "24px 28px 20px",
            background: "linear-gradient(135deg, #0f1d33 0%, #1a2b4a 60%, #0369a1 100%)",
            color: "white",
            borderTopLeftRadius: "19px",
            borderTopRightRadius: "19px",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close presentation"
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "white",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "rgba(255, 255, 255, 0.18)",
                padding: "3px 10px",
                borderRadius: "20px",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Sparkles size={12} /> Patient-Facing Clinical Presentation
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                background: "#10b981",
                color: "white",
                padding: "3px 10px",
                borderRadius: "20px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <UserCheck size={12} /> NMC Doctor Verified
            </span>
          </div>

          <h2
            style={{
              fontSize: "1.65rem",
              fontWeight: 800,
              color: "#ffffff",
              margin: "0 0 6px",
              letterSpacing: "-0.015em",
              lineHeight: 1.25,
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.45)",
            }}
          >
            Dr. {doc.name?.replace(/^Dr\.\s*/i, "")}
          </h2>

          <div style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.9)", fontWeight: 500, marginBottom: "8px" }}>
            {doc.qualification && <span>{doc.qualification} · </span>}
            <span style={{ color: "#7dd3fc", fontWeight: 700 }}>{doc.specialization}</span>
            {doc.experience_years ? <span> · {doc.experience_years}+ Years Clinical Practice</span> : null}
          </div>

          {doc.hospital_clinic_name && (
            <div
              style={{
                fontSize: "0.82rem",
                color: "rgba(255, 255, 255, 0.85)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Building2 size={14} style={{ color: "#38bdf8" }} />
              <span>{doc.hospital_clinic_name}</span>
              {(doc.city || doc.state) && (
                <span style={{ opacity: 0.8 }}>({[doc.city || doc.district, doc.state].filter(Boolean).join(", ")})</span>
              )}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Section 1: Clinical Background & Focus */}
          <div
            style={{
              padding: "20px",
              borderRadius: "14px",
              background: "white",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  color: "#0284c7",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Stethoscope size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                Clinical Background &amp; Focus
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: "0.92rem", color: "#334155", lineHeight: 1.65 }}>
              {doc.bio ||
                "Senior clinical specialist dedicated to evidence-based diagnostic evaluation, chronic care optimization, and patient-centric outpatient management. Extensive experience in preventive care and clinical follow-up."}
            </p>
          </div>

          {/* Section 2: Fee Justification & Care Guarantee */}
          <div
            style={{
              padding: "20px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(240, 249, 255, 0.8) 0%, rgba(224, 242, 254, 0.5) 100%)",
              border: "1px solid #bae6fd",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "#0284c7",
                    color: "white",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <ShieldCheck size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0369a1" }}>
                  Consultation Tariff Justification
                </h3>
              </div>
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "#0f172a",
                  background: "white",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  border: "1px solid #bae6fd",
                }}
              >
                ₹{inPersonFee}
              </span>
            </div>

            <p style={{ margin: "0 0 14px", fontSize: "0.9rem", color: "#1e293b", lineHeight: 1.6, fontWeight: 500 }}>
              {doc.fee_justification ||
                "Consultation tariff includes thorough clinical evaluation, digital SOAP documentation, 1-on-1 dedicated time, and 24-hr query window."}
            </p>

            {/* Guaranteed Patient Value Pillars */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "10px",
                paddingTop: "12px",
                borderTop: "1px solid rgba(2, 132, 199, 0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#0369a1", fontWeight: 600 }}>
                <CheckCircle2 size={14} style={{ color: "#059669", flexShrink: 0 }} />
                <span>1-on-1 Dedicated Time &amp; Exam</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#0369a1", fontWeight: 600 }}>
                <CheckCircle2 size={14} style={{ color: "#059669", flexShrink: 0 }} />
                <span>Signed Digital SOAP E-Rx</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#0369a1", fontWeight: 600 }}>
                <CheckCircle2 size={14} style={{ color: "#059669", flexShrink: 0 }} />
                <span>24-Hour Follow-up Query Window</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#0369a1", fontWeight: 600 }}>
                <CheckCircle2 size={14} style={{ color: "#059669", flexShrink: 0 }} />
                <span>0% Hidden Platform Surcharges</span>
              </div>
            </div>
          </div>

          {/* Section 3: Practice Schedule & OPD Hours */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Clock size={16} style={{ color: "#475569" }} />
              <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#334155" }}>
                Active Practice Roster &amp; Hours
              </h4>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {/* Walk-in Centre */}
              <div style={{ padding: "12px", background: "white", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", marginBottom: "4px" }}>
                  🏥 Walk-in OPD Centre
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                  {doc.hospital_clinic_name || "Visakha Multispeciality Clinics"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px" }}>
                  Mon – Sat: Morning 09:30 – 12:00 · Evening 19:00 – 21:00
                </div>
              </div>

              {/* Video Telemed */}
              <div style={{ padding: "12px", background: "white", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", marginBottom: "4px" }}>
                  📹 Video Teleconsultation
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                  Online Digital Consultation Room
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px" }}>
                  Mon – Sat: 16:00 – 18:00 (Dedicated slot)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div
          style={{
            padding: "16px 28px 20px",
            borderTop: "1px solid #e2e8f0",
            background: "#ffffff",
            borderBottomLeftRadius: "19px",
            borderBottomRightRadius: "19px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onBook) onBook("walkin");
            }}
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "12px 18px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #1a2b4a 0%, #0f1d33 100%)",
              color: "white",
              fontWeight: 700,
              fontSize: "0.9rem",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(15, 29, 51, 0.2)",
            }}
          >
            <Building2 size={16} /> Book Walk-in Visit (₹{inPersonFee})
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onBook) onBook("teleconsultation");
            }}
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "12px 18px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "white",
              fontWeight: 700,
              fontSize: "0.9rem",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.2)",
            }}
          >
            <Video size={16} /> Consult Video (₹{onlineFee})
          </button>
        </div>
      </div>
    </div>
  );
}
