"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui";
import { DutyBar } from "./dispatch/DutyBar";
import { OffDutyPanel } from "./dispatch/OffDutyPanel";
import { statusTone, stripStatusGlyphs } from "./dispatch/statusTone";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

interface DispatchTask {
  id: string;
  patient_address: string;
  patient_lat: number;
  patient_lng: number;
  status: string;
  service_type: string;
  estimated_distance_km: number;
  notes?: string;
  created_at: string;
  priority?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  assigned: "#3b82f6",
  en_route: "#8b5cf6",
  arrived: "#10b981",
  in_progress: "#0f4c81",
  completed: "#16a34a",
  cancelled: "#dc2626",
};

interface ProviderDispatchTrackerProps {
  title: string;
  icon: string;
  /**
   * Set when the tracker is rendered inside DashboardShell. The shell already
   * supplies the page title, name and background, so repeating them here
   * produced two stacked headers on the nurse and phlebotomist dashboards.
   * Embedded mode keeps what only this component has — the duty toggle, the GPS
   * indicator and the day's stats — and drops the duplicated chrome.
   */
  embedded?: boolean;
  providerType: string;
  earningsRate: number;
}

export default function ProviderDispatchTracker({ title, icon, providerType, earningsRate, embedded = false }: ProviderDispatchTrackerProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [onDuty, setOnDuty] = useState(false);
  const [tasks, setTasks] = useState<DispatchTask[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dutyLoading, setDutyLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [activeTask, setActiveTask] = useState<DispatchTask | null>(null);
  const [actionLoading, setActionLoading] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [otp, setOtp] = useState("");
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Selfie Verification State
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [verifyingSelfie, setVerifyingSelfie] = useState(false);

  // Phlebotomist Lab Handover State
  const [showLabModal, setShowLabModal] = useState(false);
  const [labHubName, setLabHubName] = useState("Apollo Diagnostics Central Hub");
  const [sampleBarcodes, setSampleBarcodes] = useState("");
  const [labNotes, setLabNotes] = useState("");

  // Nurse Clinical Vitals State
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsBP, setVitalsBP] = useState("120/80");
  const [vitalsPulse, setVitalsPulse] = useState("72");
  const [vitalsTemp, setVitalsTemp] = useState("98.6");
  const [vitalsSpO2, setVitalsSpO2] = useState("99");
  const [procedureNotes, setProcedureNotes] = useState("");

  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const taskIntervalRef = useRef<NodeJS.Timeout | null>(null);


  // ─── Fetch profile and initial data ──────────────────────────────────
  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    try {
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setOnDuty(data.data.is_online || false);
      } else {
        router.push("/auth/login");
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [router]);

  const fetchTasks = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/dispatch/my-tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const all = data.tasks || [];
        setTasks(all.filter((t: DispatchTask) => !["completed", "cancelled"].includes(t.status)));
        const done = all.filter((t: DispatchTask) => t.status === "completed");
        setCompletedToday(done.length);
        setEarnings(done.length * earningsRate);
        // Find current in-progress task
        const active = all.find((t: DispatchTask) =>
          ["provider_accepted", "en_route", "arrived", "in_progress"].includes(t.status)
        );
        setActiveTask(active || null);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchTasks();
    taskIntervalRef.current = setInterval(fetchTasks, 12000);
    return () => {
      if (taskIntervalRef.current) clearInterval(taskIntervalRef.current);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [fetchProfile, fetchTasks]);

  // ─── GPS Location Broadcasting ────────────────────────────────────────
  const startLocationBroadcast = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("GPS not available on this device.");
      return;
    }
    const sendLoc = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const token = getToken();
          if (!token) return;
          try {
            await fetch(`${apiBase}/api/dispatch/update-location`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                provider_type: providerType,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                heading: pos.coords.heading || null,
                speed_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : null,
              }),
            });
            setLocationError("");
          } catch { /* silent */ }
        },
        (err) => { setLocationError(`GPS error: ${err.message}`); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
    sendLoc(); // Send immediately
    locationIntervalRef.current = setInterval(sendLoc, 30000); // Every 30s
  }, []);

  const stopLocationBroadcast = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  // ─── Toggle Duty ──────────────────────────────────────────────────────
  const onToggleClick = () => {
    if (!onDuty && providerType === "phlebotomist") {
      setShowSelfieModal(true);
    } else {
      handleToggleDuty();
    }
  };

  const handleToggleDuty = async () => {
    setDutyLoading(true);
    const token = getToken();
    const newStatus = !onDuty;

    try {
      const res = await fetch(`${apiBase}/api/dispatch/toggle-duty`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_online: newStatus }),
      });
      if (res.ok) {
        setOnDuty(newStatus);
        if (newStatus) {
          startLocationBroadcast();
          setStatusMsg("✅ You're now ON DUTY — accepting dispatch requests");
        } else {
          stopLocationBroadcast();
          setStatusMsg("⏸️ You're now OFF DUTY");
        }
      }
    } catch (e) {
      setStatusMsg("❌ Failed to update duty status");
    } finally {
      setDutyLoading(false);
    }
  };

  const handleSelfieSubmit = async () => {
    if (!selfieFile) {
      setStatusMsg("❌ Please upload your duty selfie first.");
      return;
    }
    setVerifyingSelfie(true);
    // Simulate AI verification delay
    setTimeout(() => {
      setVerifyingSelfie(false);
      setShowSelfieModal(false);
      setSelfieFile(null);
      handleToggleDuty(); // Proceed to go on duty
    }, 1500);
  };

  // ─── Accept / Reject Task ─────────────────────────────────────────────
  const handleTaskAction = async (taskId: string, action: "accept" | "reject") => {
    setActionLoading(taskId + action);
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${taskId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(action === "accept"
          ? "✅ Task accepted! Head to the patient's location."
          : "Task declined — you will receive the next request.");
        fetchTasks();
      } else {
        setStatusMsg(`❌ ${data.detail || `Failed to ${action} task`}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error");
    } finally {
      setActionLoading("");
    }
  };

  // ─── Update Task Status ───────────────────────────────────────────────
  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    setActionLoading(taskId + newStatus);
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${taskId}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ Status updated to: ${newStatus}`);
        fetchTasks();
      } else {
        setStatusMsg(`❌ ${data.detail || "Update failed"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error");
    } finally {
      setActionLoading("");
    }
  };

  // ─── Verify OTP ────────────────────────────────────────────────────────
  const handleVerifyOtp = async (taskId: string) => {
    if (!otp || otp.length < 6) {
      setStatusMsg("❌ Please enter the 6-digit OTP from the patient");
      return;
    }
    setActionLoading("verify_otp");
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${taskId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg("✅ OTP Verified! Starting service.");
        setOtp("");
        fetchTasks();
      } else {
        setStatusMsg(`❌ ${data.detail || "Invalid OTP"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error verifying OTP");
    } finally {
      setActionLoading("");
    }
  };

  // ─── Lab Handover Submit ────────────────────────────────────────────────
  const handleLabHandoverSubmit = async () => {
    if (!activeTask) return;
    setActionLoading("lab_handover");
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${activeTask.id}/lab-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          hub_name: labHubName,
          sample_barcodes: sampleBarcodes || "BAR-DEFAULT-001",
          notes: labNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ Samples Handed Over to ${labHubName}!`);
        setShowLabModal(false);
        fetchTasks();
      } else {
        setStatusMsg(`❌ ${data.detail || "Handover failed"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error saving lab handover");
    } finally {
      setActionLoading("");
    }
  };

  // ─── Clinical Notes Submit ──────────────────────────────────────────────
  const handleClinicalNotesSubmit = async () => {
    if (!activeTask) return;
    setActionLoading("clinical_notes");
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${activeTask.id}/clinical-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          blood_pressure: vitalsBP,
          pulse_rate: vitalsPulse,
          temperature_f: vitalsTemp,
          spo2_percent: vitalsSpO2,
          procedure_notes: procedureNotes || "Standard nursing procedure completed with full infection control protocol.",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg("✅ Clinical Vitals & Notes recorded successfully!");
        setShowVitalsModal(false);
        // Complete the task
        handleUpdateStatus(activeTask.id, "completed");
      } else {
        setStatusMsg(`❌ ${data.detail || "Submission failed"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error saving clinical notes");
    } finally {
      setActionLoading("");
    }
  };


  if (loading) {
    return (
      <div style={{ minHeight: embedded ? 240 : "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: embedded ? "transparent" : "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🩸</div>
          <h2 style={{ color: "#1a2b4a" }}>Loading Dashboard...</h2>
        </div>
      </div>
    );
  }

  const statusNextMap: Record<string, { label: string; next: string }> = {
    provider_accepted: { label: "Start Route", next: "en_route" },
    en_route: { label: "Mark Arrived", next: "arrived" },
    // arrived is handled specifically with OTP UI
    in_progress: { label: "Mark Complete ✅", next: "completed" },
  };

  return (
    <div style={embedded ? undefined : { backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      <DutyBar
        title={embedded ? undefined : title}
        onDuty={onDuty}
        dutyLoading={dutyLoading || verifyingSelfie}
        gpsLive={onDuty}
        activeCount={tasks.length}
        completedToday={completedToday}
        earnings={earnings}
        earningsRate={earningsRate}
        onToggle={onToggleClick}
        onShowAllTasks={() => setShowAllTasks(true)}
      />

      <div style={embedded ? undefined : { maxWidth: 600, margin: "0 auto", padding: "16px" }}>

        {statusMsg && (
          <Banner tone={statusTone(statusMsg)} onDismiss={() => setStatusMsg("")}>
            {stripStatusGlyphs(statusMsg)}
          </Banner>
        )}

        {locationError && <Banner tone="urgent">{locationError}</Banner>}

        {!onDuty && <OffDutyPanel onGoOnDuty={onToggleClick} />}

        {/* ─── ACTIVE TASK TRACKER ─── */}
        {onDuty && activeTask && (
          <div style={{
            backgroundColor: "white", borderRadius: 16, padding: 20,
            marginBottom: 14, boxShadow: "0 2px 12px rgba(79,70,229,0.15)",
            border: `2px solid ${STATUS_COLORS[activeTask.status] || "#4f46e5"}30`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: "#1e293b", fontSize: "0.95rem" }}>
                🚗 Active Task
              </h3>
              <span style={{
                backgroundColor: `${STATUS_COLORS[activeTask.status]}20`,
                color: STATUS_COLORS[activeTask.status] || "#64748b",
                padding: "4px 12px", borderRadius: 20,
                fontSize: "0.75rem", fontWeight: 700,
              }}>
                {activeTask.status.replace("_", " ").toUpperCase()}
              </span>
            </div>

            <div style={{ backgroundColor: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>
                📍 {activeTask.patient_address}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: 4 }}>
                {activeTask.estimated_distance_km?.toFixed(1)} km away •{" "}
                <span style={{ textTransform: "capitalize" }}>{activeTask.service_type.replace('_', ' ')}</span>
              </div>
              {activeTask.notes && (
                <div style={{ color: "#475569", fontSize: "0.85rem", marginTop: 8, padding: 10, backgroundColor: "#f1f5f9", borderRadius: 8, borderLeft: "3px solid #6366f1" }}>
                  <strong>Requirements:</strong><br />
                  {activeTask.notes.split('\n').map((line, i) => (
                    <span key={i}>
                      {line.includes('http') ? (
                        <a href={line.split(' ').find(w => w.startsWith('http'))} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", textDecoration: "underline" }}>
                          View Prescription Document
                        </a>
                      ) : (
                        line
                      )}
                      <br />
                    </span>
                  ))}
                </div>
              )}
            </div>

              {/* 1-Click Driving Turn-by-Turn Navigation Deep Links */}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeTask.patient_lat},${activeTask.patient_lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8, backgroundColor: "#4285F4",
                    color: "white", textAlign: "center", textDecoration: "none", fontWeight: 700, fontSize: "0.8rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4
                  }}
                >
                  🗺️ Google Maps
                </a>
                <a
                  href={`https://waze.com/ul?ll=${activeTask.patient_lat},${activeTask.patient_lng}&navigate=yes`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8, backgroundColor: "#33CCFF",
                    color: "#1e293b", textAlign: "center", textDecoration: "none", fontWeight: 700, fontSize: "0.8rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4
                  }}
                >
                  🚗 Waze
                </a>
              </div>

            {/* Specialized Field Action Buttons */}

            {activeTask.status === "in_progress" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {providerType === "phlebotomist" && (
                  <button
                    onClick={() => setShowLabModal(true)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 8, border: "none",
                      background: "linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)",
                      color: "white", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                    }}
                  >
                    🧪 Sample Handover to Lab Hub
                  </button>
                )}

                {providerType === "nurse" && (
                  <button
                    onClick={() => setShowVitalsModal(true)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 8, border: "none",
                      background: "linear-gradient(135deg, #db2777 0%, #f472b6 100%)",
                      color: "white", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                    }}
                  >
                    🩺 Upload Vitals & Clinical Note
                  </button>
                )}
              </div>
            )}

            {/* Action buttons for status progression */}
            {activeTask.status === "arrived" ? (
              <div style={{ backgroundColor: "#fef3c7", padding: 16, borderRadius: 10, border: "2px dashed #f59e0b" }}>
                <h4 style={{ margin: "0 0 10px", color: "#92400e", fontSize: "0.9rem" }}>🔒 Verify Patient OTP</h4>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #d97706",
                      fontSize: "1.1rem", textAlign: "center", letterSpacing: "4px", fontWeight: 700
                    }}
                  />
                  <button
                    onClick={() => handleVerifyOtp(activeTask.id)}
                    disabled={actionLoading === "verify_otp"}
                    style={{
                      backgroundColor: "#d97706", color: "white", border: "none",
                      padding: "0 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer"
                    }}
                  >
                    {actionLoading === "verify_otp" ? "⏳" : "Verify"}
                  </button>
                </div>
              </div>
            ) : statusNextMap[activeTask.status] && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleUpdateStatus(activeTask.id, statusNextMap[activeTask.status].next)}
                  disabled={actionLoading === activeTask.id + statusNextMap[activeTask.status].next}
                  style={{
                    flex: 1,
                    backgroundColor: STATUS_COLORS[activeTask.status] || "#0f4c81",
                    color: "white", border: "none",
                    padding: "12px", borderRadius: 10, fontWeight: 700,
                    cursor: "pointer", fontSize: "0.9rem",
                  }}
                >
                  {actionLoading === activeTask.id + statusNextMap[activeTask.status].next
                    ? "⏳..."
                    : statusNextMap[activeTask.status].label}
                </button>
              </div>
            )}

          </div>
        )}

        {/* ─── PENDING TASKS (Accept/Reject) ─── */}
        {onDuty && tasks.filter(t => t.status === "pending").length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: "0 0 10px", color: "#1e293b", fontSize: "0.95rem" }}>
              📬 Incoming Requests ({tasks.filter(t => t.status === "pending").length})
            </h3>
            {tasks
              .filter(t => t.status === "pending")
              .sort((a, b) => (a.priority === "urgent" ? 0 : 1) - (b.priority === "urgent" ? 0 : 1))
              .map(task => {
                const isUrgent = task.priority === "urgent";
                return (
                <div
                  key={task.id}
                  style={{
                    backgroundColor: "white", borderRadius: 16, padding: 18,
                    marginBottom: 10,
                    boxShadow: isUrgent
                      ? "0 2px 12px rgba(220,38,38,0.28)"
                      : "0 2px 8px rgba(245,158,11,0.2)",
                    border: isUrgent ? "2px solid #dc2626" : "2px solid #fde68a",
                    animation: "pulse 2s infinite",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{
                      backgroundColor: isUrgent ? "#fee2e2" : "#fef3c7",
                      color: isUrgent ? "#991b1b" : "#92400e",
                      padding: "3px 10px", borderRadius: 20,
                      fontSize: "0.72rem", fontWeight: 700,
                    }}>
                      {isUrgent ? "🔴 URGENT — respond now" : "🔔 New Request"}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                      {task.estimated_distance_km?.toFixed(1)} km away
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
                    📍 {task.patient_address}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.82rem", marginBottom: 12 }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{task.service_type.replace('_', ' ')}</span>
                    {task.notes && (
                      <div style={{ marginTop: 8, padding: 10, backgroundColor: "#f8fafc", borderRadius: 8, borderLeft: "3px solid #3b82f6", color: "#334155" }}>
                        <strong>Details:</strong><br />
                        {task.notes.split('\n').map((line, i) => (
                          <span key={i}>
                            {line.includes('http') ? (
                              <a href={line.split(' ').find(w => w.startsWith('http'))} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", textDecoration: "underline" }}>
                                View Prescription Document
                              </a>
                            ) : (
                              line
                            )}
                            <br />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => handleTaskAction(task.id, "accept")}
                      disabled={!!actionLoading}
                      style={{
                        flex: 1, backgroundColor: "#16a34a",
                        color: "white", border: "none",
                        padding: "12px", borderRadius: 10, fontWeight: 700,
                        cursor: actionLoading ? "wait" : "pointer", fontSize: "0.9rem",
                      }}
                    >
                      {actionLoading === task.id + "accept" ? "⏳..." : "✅ Accept"}
                    </button>
                    <button
                      onClick={() => handleTaskAction(task.id, "reject")}
                      disabled={!!actionLoading}
                      style={{
                        flex: 1, backgroundColor: "white",
                        color: "#dc2626", border: "2px solid #fecaca",
                        padding: "12px", borderRadius: 10, fontWeight: 700,
                        cursor: actionLoading ? "wait" : "pointer", fontSize: "0.9rem",
                      }}
                    >
                      {actionLoading === task.id + "reject" ? "⏳..." : "❌ Decline"}
                    </button>
                  </div>
                </div>
                );
              })}
          </div>
        )}

        {/* ─── ON DUTY but no tasks ─── */}
        {onDuty && tasks.length === 0 && !activeTask && (
          <div style={{
            backgroundColor: "white", borderRadius: 16, padding: 40,
            textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>⏳</div>
            <h3 style={{ color: "#1e293b", marginBottom: 8 }}>Waiting for Requests</h3>
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
              You&apos;re live on the platform. New field requests will appear here automatically.
            </p>
            <div style={{
              display: "inline-block", marginTop: 16,
              padding: "6px 18px", borderRadius: 20,
              backgroundColor: "#f0fdf4", color: "#16a34a",
              fontSize: "0.8rem", fontWeight: 600,
            }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e", marginRight: 6, animation: "pulse 1.5s infinite" }} />
              GPS Active • Visible to patients
            </div>
          </div>
        )}

        {/* ─── ALL TASKS MODAL ─── */}
        {showAllTasks && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999,
            display: "flex", justifyContent: "center", alignItems: "center", padding: 20
          }}>
            <div style={{
              backgroundColor: "white", borderRadius: 16, padding: 24,
              width: "100%", maxWidth: 500, maxHeight: "80vh", overflowY: "auto"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, color: "#1e293b" }}>📋 All Active Tasks</h3>
                <button onClick={() => setShowAllTasks(false)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
              </div>

              {tasks.length === 0 ? (
                <p style={{ color: "#64748b", textAlign: "center" }}>No active tasks in your queue.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {tasks.map(task => (
                    <div key={task.id} style={{
                      padding: 14, borderRadius: 10, border: "1px solid #e2e8f0",
                      backgroundColor: task.id === activeTask?.id ? "#f8fafc" : "white",
                      borderLeft: task.id === activeTask?.id ? "4px solid #4f46e5" : "1px solid #e2e8f0"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>{task.service_type === "home_collection" ? "🩸 Blood Collection" : task.service_type}</span>
                        <span style={{
                          backgroundColor: `${STATUS_COLORS[task.status] || "#64748b"}20`,
                          color: STATUS_COLORS[task.status] || "#64748b",
                          padding: "2px 8px", borderRadius: 10, fontSize: "0.7rem", fontWeight: 700
                        }}>
                          {task.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 8 }}>📍 {task.patient_address}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Created: {new Date(task.created_at).toLocaleString()}</div>
                        <a
                          href={`https://maps.google.com/?q=${task.patient_lat},${task.patient_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "4px 12px", borderRadius: 6, backgroundColor: "#f1f5f9",
                            color: "#334155", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none",
                            border: "1px solid #e2e8f0"
                          }}
                        >
                          🗺️ Map
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* ─── SELFIE VERIFICATION MODAL ─── */}
        {showSelfieModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000,
            display: "flex", justifyContent: "center", alignItems: "center", padding: 20
          }}>
            <div style={{
              backgroundColor: "white", borderRadius: 16, padding: 30,
              width: "100%", maxWidth: 450,
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#1e293b", fontSize: "1.2rem", display: "flex", alignItems: "center", gap: 8 }}>
                <span>📸</span> Pre-Duty Selfie Verification
              </h3>
              <div style={{ backgroundColor: "#fef3c7", padding: 16, borderRadius: 10, border: "1px solid #fde68a", marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", fontWeight: 600 }}>
                  As per the Phlebotomist MOU, you must upload a live selfie showing:
                </p>
                <ul style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: "0.85rem", color: "#b45309" }}>
                  <li>Your Face clearly visible</li>
                  <li>Official Uniform and ID Card</li>
                  <li>Sample Collection Kit</li>
                </ul>
              </div>

              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                style={{
                  display: "block", width: "100%", padding: "12px",
                  border: "2px dashed #cbd5e1", borderRadius: 8, marginBottom: 20,
                  color: "#475569"
                }}
              />

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => { setShowSelfieModal(false); setSelfieFile(null); }}
                  style={{
                    flex: 1, backgroundColor: "#f1f5f9", color: "#475569",
                    border: "none", padding: "12px", borderRadius: 8, fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelfieSubmit}
                  disabled={verifyingSelfie || !selfieFile}
                  style={{
                    flex: 1, backgroundColor: "#059669", color: "white",
                    border: "none", padding: "12px", borderRadius: 8, fontWeight: 700,
                    cursor: verifyingSelfie || !selfieFile ? "not-allowed" : "pointer"
                  }}
                >
                  {verifyingSelfie ? "⏳ AI Verifying..." : "Verify & Go On Duty"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── LAB HANDOVER MODAL (Phlebotomist) ─── */}
        {showLabModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000,
            display: "flex", justifyContent: "center", alignItems: "center", padding: 20
          }}>
            <div style={{
              backgroundColor: "white", borderRadius: 16, padding: 28,
              width: "100%", maxWidth: 480,
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#1e293b", fontSize: "1.15rem" }}>
                🧪 Phlebotomist Sample Handover to Lab Hub
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 16 }}>
                Record the diagnostic hub details and sample container barcodes before dropping off tubes.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Diagnostic Lab Hub Name
                  </label>
                  <input
                    type="text"
                    value={labHubName}
                    onChange={(e) => setLabHubName(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Sample Barcode IDs / Tube Numbers
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BAR-98231, BAR-98232 (EDTA / SST)"
                    value={sampleBarcodes}
                    onChange={(e) => setSampleBarcodes(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Handover Notes & Temp Verification
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Cold chain status, transport container temp (e.g. 4°C)"
                    value={labNotes}
                    onChange={(e) => setLabNotes(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowLabModal(false)}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLabHandoverSubmit}
                  disabled={actionLoading === "lab_handover"}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#b91c1c", color: "white", fontWeight: 700, cursor: "pointer" }}
                >
                  {actionLoading === "lab_handover" ? "Saving..." : "Confirm Handover"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── CLINICAL VITALS & NOTES MODAL (Nurse) ─── */}
        {showVitalsModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000,
            display: "flex", justifyContent: "center", alignItems: "center", padding: 20
          }}>
            <div style={{
              backgroundColor: "white", borderRadius: 16, padding: 28,
              width: "100%", maxWidth: 500,
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#1e293b", fontSize: "1.15rem" }}>
                🩺 Upload Patient Vitals & Clinical Note
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: 2 }}>Blood Pressure (mmHg)</label>
                  <input type="text" value={vitalsBP} onChange={(e) => setVitalsBP(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: 2 }}>Pulse Rate (bpm)</label>
                  <input type="text" value={vitalsPulse} onChange={(e) => setVitalsPulse(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: 2 }}>Body Temp (°F)</label>
                  <input type="text" value={vitalsTemp} onChange={(e) => setVitalsTemp(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: 2 }}>SpO2 (%)</label>
                  <input type="text" value={vitalsSpO2} onChange={(e) => setVitalsSpO2(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>Procedure & Dressing Clinical Notes</label>
                <textarea
                  rows={3}
                  placeholder="Record nursing procedure, wound dressing details, medications administered..."
                  value={procedureNotes}
                  onChange={(e) => setProcedureNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowVitalsModal(false)}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClinicalNotesSubmit}
                  disabled={actionLoading === "clinical_notes"}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#db2777", color: "white", fontWeight: 700, cursor: "pointer" }}
                >
                  {actionLoading === "clinical_notes" ? "Saving..." : "Save Vitals & Complete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

