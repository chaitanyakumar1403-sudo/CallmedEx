"use client";

import React from "react";

interface DashboardProfileProps {
  profile: any;
  role: string;
}

export default function DashboardProfile({ profile, role }: DashboardProfileProps) {
  if (!profile) return null;

  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: "16px",
      padding: "24px",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      border: "1px solid #e2e8f0",
      marginTop: "24px"
    }}>
      <h3 style={{ margin: "0 0 20px 0", color: "#1e293b", fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>👤</span> Registration & Service Profile
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
        
        {/* Common Details */}
        <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Full Name</div>
          <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.full_name || profile.organization_name || profile.pharmacy_name || "N/A"}</div>
        </div>

        <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Email</div>
          <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.email || "N/A"}</div>
        </div>

        <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Phone</div>
          <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.mobile || profile.mobile_number || "N/A"}</div>
        </div>

        {/* Doctor Specific Details */}
        {role === "doctor" && (
          <>
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Specialization</div>
              <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.specialization || "General"}</div>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>License Number</div>
              <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.medical_license_number || "N/A"}</div>
            </div>
          </>
        )}

        {/* Phlebotomist Specific Details */}
        {role === "phlebotomist" && (
          <>
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Employment Type</div>
              <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500, textTransform: "capitalize" }}>{profile.phleb_type?.replace("_", " ") || "N/A"}</div>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Certification</div>
              <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.certification_number || "N/A"}</div>
            </div>
          </>
        )}

        {/* Pharmacy Specific Details */}
        {role === "pharmacy" && (
          <>
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Registration Number</div>
              <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.registration_number || "N/A"}</div>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Service Scope</div>
              <div style={{ fontSize: "0.95rem", color: "#0f172a", fontWeight: 500, display: "flex", flexDirection: "column", gap: "4px" }}>
                <span>{profile.home_delivery ? "✅ Home Delivery" : "❌ No Home Delivery"}</span>
                <span>{profile.available_24x7 ? "✅ 24x7 Availability" : "🕒 Standard Hours"}</span>
                <span>📍 Delivery Radius: {profile.service_radius_km || 5} km</span>
              </div>
            </div>
          </>
        )}

        {/* Organization Specific Details */}
        {role === "organization" && (
          <>
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Type</div>
              <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500, textTransform: "capitalize" }}>{profile.organization_type || "N/A"}</div>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>License Number</div>
              <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.license_number || "N/A"}</div>
            </div>
            {profile.operating_hours && (
              <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Operating Hours</div>
                <div style={{ fontSize: "1rem", color: "#0f172a", fontWeight: 500 }}>{profile.operating_hours}</div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
