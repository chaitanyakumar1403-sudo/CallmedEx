"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

const STATUS_FLOW = [
  { key: "pending", label: "Searching nearby providers", icon: "🔍", color: "#f59e0b" },
  { key: "assigned", label: "Provider assigned", icon: "✅", color: "#3b82f6" },
  { key: "en_route", label: "Provider is on the way", icon: "🚗", color: "#8b5cf6" },
  { key: "arrived", label: "Provider has arrived", icon: "📍", color: "#10b981" },
  { key: "in_progress", label: "Service in progress", icon: "⚗️", color: "#0f4c81" },
  { key: "completed", label: "Service completed", icon: "🎉", color: "#16a34a" },
  { key: "cancelled", label: "Cancelled", icon: "❌", color: "#dc2626" },
];

function getStatusInfo(status: string) {
  return STATUS_FLOW.find(s => s.key === status) || STATUS_FLOW[0];
}

function getStatusIndex(status: string) {
  return STATUS_FLOW.findIndex(s => s.key === status);
}

export default function LiveTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const dispatchId = params?.dispatch_id as string;

  const [dispatch, setDispatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eta, setEta] = useState<number | null>(null);
  const [providerPhone, setProviderPhone] = useState("");
  const [otpData, setOtpData] = useState<{ otp: string | null; message: string; verified: boolean } | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const otpPollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDispatch = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    if (!dispatchId) return;

    try {
      const res = await fetch(`${apiBase}/api/dispatch/${dispatchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success || data.id) {
        const d = data.dispatch || data;
        setDispatch(d);

        // Estimate ETA from distance (assume 30km/h avg speed in city)
        if (d.estimated_distance_km) {
          const etaMins = Math.ceil((d.estimated_distance_km / 30) * 60);
          setEta(etaMins);
        }

        // Stop polling when completed or cancelled
        if (["completed", "cancelled"].includes(d.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } else {
        setError("Dispatch not found or access denied.");
      }
    } catch (e) {
      console.error("Tracking fetch error:", e);
      setError("Unable to load tracking data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [dispatchId, router]);

  const fetchOtp = useCallback(async () => {
    const token = getToken();
    if (!token || !dispatchId) return;

    try {
      const res = await fetch(`${apiBase}/api/dispatch/${dispatchId}/patient-otp`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOtpData({ otp: data.otp, message: data.message, verified: data.verified });
        if (data.verified && otpPollRef.current) {
           clearInterval(otpPollRef.current);
        }
      }
    } catch (e) {
      console.error("OTP fetch error:", e);
    }
  }, [dispatchId]);

  useEffect(() => {
    fetchDispatch();
    // Poll every 10 seconds for live status
    pollRef.current = setInterval(fetchDispatch, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchDispatch]);

  useEffect(() => {
    if (dispatch?.status === "arrived" || dispatch?.status === "in_progress") {
      fetchOtp();
      // Poll more frequently for OTP updates when arrived
      otpPollRef.current = setInterval(fetchOtp, 5000);
    }
    return () => { if (otpPollRef.current) clearInterval(otpPollRef.current); };
  }, [dispatch?.status, fetchOtp]);

  const handleCallProvider = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${dispatchId}/masked-call`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.proxy_number) {
        setProviderPhone(data.proxy_number);
        window.location.href = `tel:${data.proxy_number}`;
      }
    } catch (e) {
      console.error("Masked call error:", e);
    }
  };

  const handleCancelDispatch = async () => {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${dispatchId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) fetchDispatch();
    } catch (e) {
      console.error("Cancel error:", e);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12, animation: "pulse 1.5s infinite" }}>📡</div>
          <h2 style={{ color: "#1e293b" }}>Connecting to tracking server...</h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Please wait while we fetch your dispatch status</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>❌</div>
          <h2 style={{ color: "#1e293b" }}>Tracking Unavailable</h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 20 }}>{error}</p>
          <button onClick={() => router.push("/dashboard/patient")} style={{ backgroundColor: "#0f4c81", color: "white", border: "none", padding: "12px 24px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
            Go to My Bookings
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(dispatch?.status || "pending");
  const statusIdx = getStatusIndex(dispatch?.status || "pending");
  const activeSteps = STATUS_FLOW.filter(s => s.key !== "cancelled");
  const isCancelled = dispatch?.status === "cancelled";
  const isCompleted = dispatch?.status === "completed";
  const canCancel = ["pending", "assigned"].includes(dispatch?.status || "");

  const serviceLabel: Record<string, string> = {
    home_collection: "🩸 Home Sample Collection",
    home_visit: "🏠 Doctor Home Visit",
    nursing: "👩‍⚕️ Nursing Service",
    ambulance: "🚑 Ambulance",
    pharmacy_delivery: "💊 Medicine Delivery",
  };

  return (
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh", paddingBottom: 60 }}>
      {/* ─── Header ─── */}
      <div style={{
        background: isCancelled
          ? "linear-gradient(135deg, #7f1d1d, #dc2626)"
          : isCompleted
            ? "linear-gradient(135deg, #14532d, #16a34a)"
            : "linear-gradient(135deg, #1e1b4b, #4f46e5)",
        padding: "28px 24px",
        color: "white",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: 8 }}>{statusInfo.icon}</div>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "white" }}>
          {statusInfo.label}
        </h1>
        <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>
          {serviceLabel[dispatch?.service_type] || dispatch?.service_type}
        </p>
        {eta && !isCompleted && !isCancelled && (
          <div style={{
            display: "inline-block",
            marginTop: 12,
            backgroundColor: "rgba(255,255,255,0.15)",
            padding: "6px 20px",
            borderRadius: 20,
            fontSize: "0.9rem",
            fontWeight: 700,
          }}>
            ⏱️ ETA: ~{eta} min
          </div>
        )}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* ─── OTP Display (Shown when arrived) ─── */}
        {otpData && (
          <div style={{
            backgroundColor: otpData.verified ? "#f0fdf4" : "#fffbeb",
            border: `2px solid ${otpData.verified ? "#16a34a" : "#f59e0b"}`,
            borderRadius: 16, padding: "24px", marginBottom: 16, textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
          }}>
            <h3 style={{ margin: "0 0 12px", color: otpData.verified ? "#166534" : "#b45309", fontSize: "1.1rem" }}>
              {otpData.verified ? "✅ Security Verification Complete" : "🔒 Provider Verification OTP"}
            </h3>
            {otpData.otp && !otpData.verified && (
              <div style={{
                fontSize: "2.5rem", fontWeight: 900, letterSpacing: "8px", color: "#1e293b",
                backgroundColor: "white", padding: "12px 24px", borderRadius: 12, display: "inline-block",
                border: "1px dashed #cbd5e1", marginBottom: 16
              }}>
                {otpData.otp}
              </div>
            )}
            <p style={{ margin: 0, color: otpData.verified ? "#15803d" : "#78350f", fontWeight: 500 }}>
              {otpData.message}
            </p>
          </div>
        )}

        {/* ─── Progress Timeline ─── */}
        {!isCancelled && (
          <div style={{ backgroundColor: "white", borderRadius: 16, padding: 24, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin: "0 0 20px", color: "#1e293b", fontSize: "0.95rem", fontWeight: 700 }}>
              Live Status Updates
            </h3>
            <div style={{ position: "relative" }}>
              {/* Vertical line */}
              <div style={{
                position: "absolute",
                left: 15, top: 0, bottom: 0,
                width: 2,
                backgroundColor: "#e2e8f0",
                zIndex: 0,
              }} />

              {activeSteps.map((step, i) => {
                const isDone = i < statusIdx;
                const isActive = i === statusIdx;
                const isFuture = i > statusIdx;
                return (
                  <div key={step.key} style={{ display: "flex", gap: 16, marginBottom: 20, position: "relative", zIndex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      backgroundColor: isDone ? "#16a34a" : isActive ? statusInfo.color : "#e2e8f0",
                      fontSize: isDone ? "0.9rem" : "0.8rem",
                      boxShadow: isActive ? `0 0 0 4px ${statusInfo.color}30` : "none",
                      transition: "all 0.3s",
                    }}>
                      {isDone ? "✓" : step.icon}
                    </div>
                    <div style={{ paddingTop: 6 }}>
                      <div style={{
                        fontWeight: isActive ? 700 : 500,
                        color: isFuture ? "#94a3b8" : "#1e293b",
                        fontSize: "0.9rem",
                      }}>
                        {step.label}
                      </div>
                      {isActive && (
                        <div style={{ color: statusInfo.color, fontSize: "0.75rem", marginTop: 2, fontWeight: 600 }}>
                          Current status • Updating every 10s
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Provider Info ─── */}
        {dispatch?.provider_name && (
          <div style={{ backgroundColor: "white", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin: "0 0 14px", color: "#475569", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Your Provider
            </h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  backgroundColor: "#dbeafe", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: "1.5rem",
                }}>
                  {dispatch.service_type === "home_collection" ? "🩸" : "👨‍⚕️"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "1rem" }}>
                    {dispatch.provider_name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: 2 }}>
                    {dispatch.service_type === "home_collection" ? "Phlebotomist" : "Healthcare Provider"}
                  </div>
                  {dispatch.estimated_distance_km && (
                    <div style={{ color: "#4f46e5", fontSize: "0.8rem", marginTop: 2 }}>
                      📍 {dispatch.estimated_distance_km.toFixed(1)} km away
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCallProvider}
                style={{
                  backgroundColor: "#0f4c81", color: "white",
                  border: "none", padding: "10px 18px", borderRadius: 10,
                  fontWeight: 700, cursor: "pointer", fontSize: "0.85rem",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                📞 Call
              </button>
            </div>
            {providerPhone && (
              <div style={{ marginTop: 10, padding: "8px 12px", backgroundColor: "#f0fdf4", borderRadius: 8, fontSize: "0.82rem", color: "#166534" }}>
                Calling via masked number: <strong>{providerPhone}</strong> (your real number is hidden)
              </div>
            )}
          </div>
        )}

        {/* ─── Location Map Placeholder ─── */}
        <div style={{
          backgroundColor: "white", borderRadius: 16, overflow: "hidden",
          marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}>
          {/* OpenStreetMap iframe — no API key needed */}
          {dispatch?.patient_lat && dispatch?.patient_lng ? (
            <div>
              <iframe
                title="Dispatch Location"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${dispatch.patient_lng - 0.01},${dispatch.patient_lat - 0.01},${dispatch.patient_lng + 0.01},${dispatch.patient_lat + 0.01}&layer=mapnik&marker=${dispatch.patient_lat},${dispatch.patient_lng}`}
                style={{ width: "100%", height: 240, border: "none" }}
              />
              <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.85rem" }}>
                  📍 Your Location
                </div>
                <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: 2 }}>
                  {dispatch.patient_address || `${dispatch.patient_lat.toFixed(4)}, ${dispatch.patient_lng.toFixed(4)}`}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🗺️</div>
              <p style={{ fontSize: "0.85rem" }}>Map view will appear once provider location is shared</p>
            </div>
          )}
        </div>

        {/* ─── Booking Details ─── */}
        <div style={{ backgroundColor: "white", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <h3 style={{ margin: "0 0 14px", color: "#475569", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Dispatch Details
          </h3>
          {[
            { label: "Dispatch ID", value: dispatch?.id?.slice(0, 8).toUpperCase() || "—" },
            { label: "Service", value: serviceLabel[dispatch?.service_type] || dispatch?.service_type },
            { label: "Status", value: statusInfo.label },
            { label: "Requested At", value: dispatch?.created_at ? new Date(dispatch.created_at).toLocaleString("en-IN") : "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: "1px solid #f1f5f9",
            }}>
              <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{label}</span>
              <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.85rem" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* ─── Action Buttons ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {canCancel && (
            <button
              onClick={handleCancelDispatch}
              style={{
                backgroundColor: "white", color: "#dc2626",
                border: "2px solid #fecaca",
                padding: "12px", borderRadius: 10, fontWeight: 700,
                cursor: "pointer", fontSize: "0.9rem",
              }}
            >
              ❌ Cancel Request
            </button>
          )}

          {(isCompleted || isCancelled) && (
            <button
              onClick={() => router.push("/dashboard/patient")}
              style={{
                backgroundColor: "#0f4c81", color: "white",
                border: "none", padding: "14px", borderRadius: 10,
                fontWeight: 700, cursor: "pointer", fontSize: "0.95rem",
              }}
            >
              View My Bookings
            </button>
          )}

          {isCompleted && (
            <button
              onClick={() => router.push("/booking")}
              style={{
                backgroundColor: "white", color: "#0f4c81",
                border: "2px solid #0f4c81",
                padding: "12px", borderRadius: 10, fontWeight: 700,
                cursor: "pointer", fontSize: "0.9rem",
              }}
            >
              Book Again
            </button>
          )}
        </div>

        {/* ─── Live refresh indicator ─── */}
        {!isCompleted && !isCancelled && (
          <div style={{ textAlign: "center", marginTop: 20, color: "#94a3b8", fontSize: "0.75rem" }}>
            <span style={{
              display: "inline-block",
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: "#22c55e", marginRight: 6,
              animation: "pulse 1.5s infinite",
            }} />
            Live — refreshing automatically every 10 seconds
          </div>
        )}
      </div>
    </div>
  );
}
