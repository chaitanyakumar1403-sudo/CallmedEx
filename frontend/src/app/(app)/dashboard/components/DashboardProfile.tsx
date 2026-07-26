"use client";

import React from "react";

interface DashboardProfileProps {
  profile: any;
  role: string;
}

export default function DashboardProfile({ profile, role }: DashboardProfileProps) {
  if (!profile) return null;

  const renderField = (icon: string, label: string, value: any, isCapitalize = false) => {
    const valText = value ? String(value) : "N/A";
    return (
      <div
        style={{
          backgroundColor: "#f8fafc",
          padding: "16px 20px",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
          <span>{icon}</span> {label}
        </div>
        <div style={{ fontSize: "0.95rem", color: "#0f172a", fontWeight: 600, wordBreak: "break-word", textTransform: isCapitalize ? "capitalize" : "none" }}>
          {valText}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "20px",
        padding: "32px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04)",
        border: "1px solid #e2e8f0",
        marginTop: "16px",
        maxWidth: "1100px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #f1f5f9" }}>
        <h3 style={{ margin: 0, color: "#0f172a", fontSize: "1.3rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px" }}>
          <span>👤</span> Registration & Service Profile
        </h3>
        <span className="badge-ai" style={{ background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)" }}>
          {role.toUpperCase()} VERIFIED
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        
        {/* Common Account Fields */}
        {renderField("👤", "Full Name", profile.full_name || profile.organization_name || profile.pharmacy_name)}
        {renderField("✉️", "Email Address", profile.email)}
        {renderField("📞", "Phone Number", profile.mobile || profile.mobile_number || profile.phone)}

        {/* Doctor Specific Details */}
        {role === "doctor" && (
          <>
            {renderField("🩺", "Specialization", profile.specialization || "General Medicine")}
            {renderField("📜", "Medical License Number", profile.medical_license_number)}
            {renderField("🎓", "Qualification", profile.qualification || "MBBS, MD")}
          </>
        )}

        {/* Nurse Specific Details */}
        {role === "nurse" && (
          <>
            {renderField("👩‍⚕️", "Nursing Specialization", profile.specialization || "General Nursing & Home Care")}
            {renderField("📜", "Nursing Council Reg No", profile.license_number || profile.registration_number || "NC-2026-REG")}
            {renderField("📍", "Service City", profile.city || "Visakhapatnam")}
          </>
        )}

        {/* Phlebotomist Specific Details */}
        {role === "phlebotomist" && (
          <>
            {renderField("🩸", "Employment Type", profile.phleb_type?.replace("_", " "), true)}
            {renderField("📜", "Certification Number", profile.certification_number)}
            {renderField("🧪", "Specimen Handling", "Cold-Chain Certified (2°C–8°C)")}
          </>
        )}

        {/* Pharmacy Specific Details */}
        {role === "pharmacy" && (
          <>
            {renderField("📜", "Pharmacy Reg Number", profile.registration_number)}
            {renderField("🛵", "Home Medicine Delivery", profile.home_delivery ? "✅ Enabled (30-Min Express)" : "❌ Store Pick-Up Only")}
            {renderField("📍", "Delivery Radius", `${profile.service_radius_km || 5} km Radius`)}
          </>
        )}

        {/* Organization Specific Details */}
        {role === "organization" && (
          <>
            {renderField("🏥", "Organization Type", profile.organization_type, true)}
            {renderField("📜", "Hospital License No", profile.license_number)}
            {renderField("🕒", "Operating Hours", profile.operating_hours || "24x7 Emergency OPD")}
          </>
        )}

      </div>
    </div>
  );
}
