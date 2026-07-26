"use client";

import React, { useState } from "react";

interface TaskTrackerProps {
  data: {
    dispatch_id: string;
    task_session_token: string;
    patient_lat: number;
    patient_lng: number;
    patient_address: string;
  };
}

export default function TaskTracker({ data }: TaskTrackerProps) {
  const [status, setStatus] = useState<string>("en_route");
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mapLink = `https://www.google.com/maps/dir/?api=1&destination=${data.patient_lat},${data.patient_lng}`;

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    setError("");

    // 🚀 DEMO BYPASS
    if (data.task_session_token === "demo_token") {
      setTimeout(() => {
        if (newStatus === "in_progress" && (!otp || otp.length < 6)) {
          setError("Please enter the 6-digit OTP.");
        } else {
          setStatus(newStatus);
        }
        setLoading(false);
      }, 800);
      return;
    }

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const payload: any = { task_session_token: data.task_session_token, status: newStatus };
      if (newStatus === "in_progress") {
        if (!otp) throw new Error("Please enter the 6-digit OTP provided by the patient.");
        payload.otp = otp;
      }

      const res = await fetch(`${apiBase}/api/dispatch/magic-status/${data.dispatch_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.detail || resData.error || "Failed to update status.");
      }
      
      setStatus(newStatus);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "white", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "500px", marginTop: "20px" }}>
        
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: "bold", background: "linear-gradient(to right, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Task Accepted!
          </h1>
          <p style={{ color: "#94a3b8", marginTop: "8px", fontSize: "0.95rem" }}>
            You are securely logged into this specific task.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)" }}>
          
          <h3 style={{ margin: "0 0 10px 0", color: "#e2e8f0" }}>📍 Destination</h3>
          <p style={{ color: "#cbd5e1", fontSize: "1rem", lineHeight: "1.5", marginBottom: "20px" }}>
            {data.patient_address}
          </p>

          <a href={mapLink} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "14px", background: "#3b82f6", color: "white", textDecoration: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", marginBottom: "20px", transition: "all 0.2s" }}>
            🗺️ Open Google Maps
          </a>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          {/* Status Flow */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {status === "en_route" && (
              <button 
                onClick={() => updateStatus("arrived")}
                disabled={loading}
                style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Updating..." : "📍 Mark as Arrived"}
              </button>
            )}

            {status === "arrived" && (
              <div style={{ animation: "fadeIn 0.5s ease-out" }}>
                <h3 style={{ margin: "0 0 10px 0", color: "#e2e8f0", textAlign: "center" }}>Verify Patient</h3>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", textAlign: "center", marginBottom: "15px" }}>Ask the patient for their 6-digit Service OTP.</p>
                <input 
                  type="text" 
                  placeholder="Enter 6-digit OTP" 
                  value={otp} 
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  style={{ width: "100%", padding: "16px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid #3b82f6", borderRadius: "8px", color: "white", fontSize: "1.5rem", textAlign: "center", letterSpacing: "4px", marginBottom: "15px", boxSizing: "border-box" }}
                />
                <button 
                  onClick={() => updateStatus("in_progress")}
                  disabled={loading || otp.length < 6}
                  style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", cursor: (loading || otp.length < 6) ? "not-allowed" : "pointer", opacity: (loading || otp.length < 6) ? 0.7 : 1 }}
                >
                  {loading ? "Verifying..." : "✅ Verify & Start Service"}
                </button>
              </div>
            )}

            {status === "in_progress" && (
              <div style={{ animation: "fadeIn 0.5s ease-out", textAlign: "center" }}>
                <div style={{ width: "60px", height: "60px", background: "rgba(16, 185, 129, 0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px auto" }}>
                  <span style={{ fontSize: "2rem" }}>🩺</span>
                </div>
                <h3 style={{ margin: "0 0 10px 0", color: "#10b981" }}>Service in Progress</h3>
                <button 
                  onClick={() => updateStatus("completed")}
                  disabled={loading}
                  style={{ width: "100%", padding: "16px", background: "#475569", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1.1rem", cursor: loading ? "not-allowed" : "pointer", marginTop: "15px" }}
                >
                  {loading ? "Finishing..." : "🏁 Mark as Completed"}
                </button>
              </div>
            )}

            {status === "completed" && (
              <div style={{ animation: "fadeIn 0.5s ease-out", textAlign: "center", padding: "20px 0" }}>
                <span style={{ fontSize: "4rem" }}>🎉</span>
                <h2 style={{ color: "#10b981", margin: "10px 0" }}>Task Completed!</h2>
                <p style={{ color: "#94a3b8" }}>Great job. You may now close this window.</p>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#fca5a5", padding: "12px", borderRadius: "8px", textAlign: "center", marginTop: "10px" }}>
                {error}
              </div>
            )}

          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
