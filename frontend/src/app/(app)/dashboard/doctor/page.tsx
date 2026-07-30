"use client";
import { useState, useEffect, useCallback } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import { useRouter } from "next/navigation";
import DashboardShell from "../components/DashboardShell";
import SelfieVerificationCard from "../components/SelfieVerificationCard";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MODES = [
  { value: "in_person", label: "🏥 In-Person", color: "#2563eb" },
  { value: "online", label: "💻 Online", color: "#7c3aed" },
  { value: "home_visit", label: "🏠 Home Visit", color: "#059669" },
  { value: "both", label: "📋 All Modes", color: "#d97706" },
];

interface Availability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  consultation_mode: string;
  max_patients_per_slot: number;
  is_active: boolean;
  location_name: string;
  location_address: string;
  template_group_id?: string | null;
}

interface Fee {
  id: string;
  fee_type: string;
  amount: number;
}

export default function DoctorDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("schedule");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Availability state
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "13:00",
    slot_duration_minutes: 30,
    consultation_mode: "in_person",
    max_patients_per_slot: 1,
    location_name: "",
    location_address: "",
    apply_to_all_days: false,
    replace_existing: false,
  });

  // Fees state
  const [fees, setFees] = useState<Fee[]>([]);
  const [feeForm, setFeeForm] = useState({ fee_type: "in_person", amount: "" });

  // Blocked dates
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // Home Visits / Dispatch
  const [onDuty, setOnDuty] = useState(false);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<any[]>([]);
  const [otp, setOtp] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  // Bookings
  const [todayBookings, setTodayBookings] = useState<any[]>([]);

  // Status messages
  const [statusMsg, setStatusMsg] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) { router.push("/auth/login"); return; }
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data.role === "doctor") {
        setProfile(data.data);
      } else {
        router.push("/");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchAvailability = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/my-availability`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setAvailability(data.availability || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchFees = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/my-fees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setFees(data.fees || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchBlockedDates = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/my-blocked-dates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setBlockedDates(data.blocked_dates || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchTodayBookings = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/bookings/provider/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setTodayBookings(data.bookings || []);
    } catch (e) { /* endpoint may not exist yet */ }
  }, []);

  const fetchDispatchData = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const [offersRes, tasksRes] = await Promise.allSettled([
        fetch(`${apiBase}/api/dispatch/offers/pending`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/api/dispatch/active`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (offersRes.status === 'fulfilled' && offersRes.value.ok) {
        const d = await offersRes.value.json();
        setIncomingOffers(d.offers || []);
      }
      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const d = await tasksRes.value.json();
        setActiveTasks(d.dispatches || []);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchAvailability();
    fetchFees();
    fetchBlockedDates();
    fetchTodayBookings();
    fetchDispatchData();
    const interval = setInterval(fetchDispatchData, 15000);
    return () => clearInterval(interval);
  }, [fetchProfile, fetchAvailability, fetchFees, fetchBlockedDates, fetchTodayBookings, fetchDispatchData]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Saving...");
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg(`✅ ${data.message || "Availability added"}`);
        setShowAddForm(false);
        setFormData({ ...formData, apply_to_all_days: false, replace_existing: false });
        fetchAvailability();
      } else {
        setStatusMsg(`❌ ${data.detail || "Failed"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Remove this schedule from every day it was applied to?")) return;
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/availability/group/${groupId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStatusMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.detail || "Failed"}`);
      fetchAvailability();
    } catch {
      setStatusMsg("❌ Network error");
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    try {
      const token = getToken();
      await fetch(`${apiBase}/api/providers/availability/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAvailability();
    } catch (e) { console.error(e); }
  };

  const handleSetFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fee_type: feeForm.fee_type, amount: parseFloat(feeForm.amount) }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ ${data.message}`);
        fetchFees();
        setFeeForm({ fee_type: "in_person", amount: "" });
      }
    } catch (e) { setStatusMsg("❌ Failed to set fee"); }
  };

  const handleBlockDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDate) return;
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/blocked-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ blocked_date: blockDate, reason: blockReason }),
      });
      const data = await res.json();
      if (data.success) {
        fetchBlockedDates();
        setBlockDate("");
        setBlockReason("");
      }
    } catch (e) { console.error(e); }
  };

  const handleUnblockDate = async (id: string) => {
    try {
      const token = getToken();
      await fetch(`${apiBase}/api/providers/blocked-dates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBlockedDates();
    } catch (e) { console.error(e); }
  };

  // ─── Dispatch / Home Visit Handlers ───
  const handleToggleOnline = async () => {
    const newStatus = !onDuty;
    try {
      const token = getToken();
      await fetch(`${apiBase}/api/dispatch/toggle-online`, {
        method: 'POST',
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider_type: 'doctor', is_online: newStatus }),
      });
      setOnDuty(newStatus);
    } catch { /* silent */ }
  };

  const handleRespondToOffer = async (offerId: string, accepted: boolean) => {
    try {
      const token = getToken();
      await fetch(`${apiBase}/api/dispatch/respond/${offerId}`, {
        method: 'POST',
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accepted }),
      });
      setIncomingOffers(prev => prev.filter(o => o.offer_id !== offerId));
      if (accepted) fetchDispatchData();
    } catch { /* silent */ }
  };

  const handleUpdateStatus = async (dispatchId: string, newStatus: string) => {
    setActionLoading(dispatchId + newStatus);
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/dispatch/status/${dispatchId}`, {
        method: 'POST',
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg(`✅ Status updated to ${newStatus}`);
        fetchDispatchData();
      } else {
        setStatusMsg(`❌ Failed to update status`);
      }
    } catch { setStatusMsg("❌ Network error"); } finally { setActionLoading(""); }
  };

  const handleVerifyOtp = async (taskId: string) => {
    if (!otp || otp.length < 6) { setStatusMsg("❌ Please enter the 6-digit OTP"); return; }
    setActionLoading("verify_otp");
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/dispatch/${taskId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg("✅ OTP Verified! Starting service.");
        setOtp("");
        fetchDispatchData();
      } else {
        setStatusMsg(`❌ ${data.detail || "Invalid OTP"}`);
      }
    } catch (e) { setStatusMsg("❌ Network error verifying OTP"); } finally { setActionLoading(""); }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>👨‍⚕️</div>
          <h2 style={{ color: '#1a2b4a' }}>Loading Doctor Dashboard...</h2>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "schedule", label: "My Schedule", icon: "📅" },
    { id: "appointments", label: "Today's Appointments", icon: "🗓️" },
    { id: "home_visits", label: "Home Visits", icon: "🏠" },
    { id: "fees", label: "Consultation Fees", icon: "💰" },
    { id: "leave", label: "Leave / Holidays", icon: "🏖️" },
    { id: "profile", label: "Profile Details", icon: "👤" },
  ];

  return (
    <DashboardShell
      role="doctor"
      title="Doctor Command Center"
      subtitle={`${profile?.full_name || "Doctor"} — schedule, fees and appointments`}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <button
          onClick={() => router.push("/dashboard/doctor/consult/instant")}
          style={{
            padding: "10px 18px", borderRadius: 999, cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.12)", color: "#fff",
            fontWeight: 700, fontSize: "0.85rem",
          }}
        >
          🎥 Start instant consult
        </button>
      }
    >

      {/* ─── Stats Bar ─── */}
      <div className="cm-stats-grid">
        {[
          { label: "Active Slots", value: availability.filter(a => a.is_active).length, icon: "📅", color: "#2563eb", action: () => setActiveTab("schedule") },
          { label: "Today's Appointments", value: todayBookings.length, icon: "🗓️", color: "#16a34a", action: () => setActiveTab("appointments") },
          { label: "Fee Types Set", value: fees.length, icon: "💰", color: "#d97706", action: () => setActiveTab("fees") },
          { label: "Blocked Dates", value: blockedDates.length, icon: "🏖️", color: "#dc2626", action: () => setActiveTab("schedule") },
        ].map((stat, i) => (
          <div key={i} onClick={stat.action} className="cm-stat-card">
            <div className="cm-stat-card__icon" style={{ backgroundColor: `${stat.color}15` }}>{stat.icon}</div>
            <div>
              <div className="cm-stat-card__value">{stat.value}</div>
              <div className="cm-stat-card__label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Content ─── */}
      <div>
        {statusMsg && (
          <div style={{
            padding: "12px 20px",
            backgroundColor: statusMsg.includes("✅") ? "#f0fdf4" : "#fef2f2",
            color: statusMsg.includes("✅") ? "#166534" : "#991b1b",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: "0.9rem",
            fontWeight: 500,
          }}>
            {statusMsg}
          </div>
        )}

        {/* ─── AUTOMATED NEXT PATIENT IN QUEUE NOTIFICATION BANNER ─── */}
        {todayBookings.length > 0 ? (
          <div style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
            color: "white",
            boxShadow: "0 10px 25px -5px rgba(49, 46, 129, 0.4)",
            border: "2px solid #6366f1",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(99, 102, 241, 0.2)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", boxShadow: "0 0 15px rgba(99,102,241,0.5)" }}>
                  👤
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ backgroundColor: "#ef4444", color: "white", fontSize: "0.7rem", fontWeight: 800, padding: "2px 8px", borderRadius: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      🔔 NEXT IN QUEUE
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#a5b4fc" }}>Waiting: ~3 mins</span>
                  </div>
                  <h3 style={{ margin: "4px 0 2px", fontSize: "1.2rem", fontWeight: 700, color: "white" }}>
                    {todayBookings[0].patient_name || "Patient Appointment"}
                  </h3>
                  <div style={{ fontSize: "0.85rem", color: "#c7d2fe" }}>
                    <strong>Chief Complaint:</strong> {todayBookings[0].notes || "Consultation Request"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={() => router.push(`/dashboard/doctor/consult/${todayBookings[0].id || 'instant'}`)}
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(16, 185, 129, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  📹 Admit & Start Video Call
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
            color: "white",
            border: "1px solid #334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                ☕
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "white" }}>No Patients Currently in Queue</h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Your waiting room is clear. When patients book slots or check in today, they will appear here automatically.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("schedule")}
              style={{
                padding: "8px 16px",
                backgroundColor: "rgba(255,255,255,0.1)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📅 Manage Available Slots
            </button>
          </div>
        )}


        {/* ═══ PROFILE TAB ═══ */}
        {activeTab === "profile" && (
          <DashboardProfile profile={profile} role="doctor" />
        )}

        {/* ═══ SCHEDULE TAB ═══ */}
        {activeTab === "schedule" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: "#1e293b", fontSize: "1.2rem" }}>Weekly Availability Schedule</h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                style={{
                  backgroundColor: "#0f4c81",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                {showAddForm ? "✕ Cancel" : "+ Add Availability"}
              </button>
            </div>

            {/* Add Form */}
            {showAddForm && (
              <div style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 24,
                marginBottom: 24,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "2px solid #0f4c8120",
              }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#0f4c81" }}>Add Availability Block</h3>
                <form onSubmit={handleAddAvailability}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Day</label>
                      <select
                        value={formData.day_of_week}
                        onChange={e => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      >
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: "0.82rem", color: "#475569", cursor: "pointer", fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={formData.apply_to_all_days}
                          onChange={e => setFormData({ ...formData, apply_to_all_days: e.target.checked })}
                        />
                        Apply to all 7 days
                      </label>
                      {formData.apply_to_all_days && (
                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: "0.78rem", color: "#b45309", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={formData.replace_existing}
                            onChange={e => setFormData({ ...formData, replace_existing: e.target.checked })}
                          />
                          Replace my current weekly hours
                        </label>
                      )}
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Start Time</label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>End Time</label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Slot Duration</label>
                      <select
                        value={formData.slot_duration_minutes}
                        onChange={e => setFormData({ ...formData, slot_duration_minutes: parseInt(e.target.value) })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      >
                        <option value={15}>15 minutes</option>
                        <option value={20}>20 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Mode</label>
                      <select
                        value={formData.consultation_mode}
                        onChange={e => setFormData({ ...formData, consultation_mode: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      >
                        {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Max Patients/Slot</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={formData.max_patients_per_slot}
                        onChange={e => setFormData({ ...formData, max_patients_per_slot: parseInt(e.target.value) })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Location Name (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., KIMS Hospital OPD Room 12"
                        value={formData.location_name}
                        onChange={e => setFormData({ ...formData, location_name: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Location Address (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., Waltair Main Road, Vizag"
                        value={formData.location_address}
                        onChange={e => setFormData({ ...formData, location_address: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    style={{
                      marginTop: 20,
                      backgroundColor: "#0f4c81",
                      color: "white",
                      border: "none",
                      padding: "12px 28px",
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    Save Availability
                  </button>
                </form>
              </div>
            )}

            {/* Weekly Calendar Grid */}
            {availability.length === 0 ? (
              <div style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 48,
                textAlign: "center",
                border: "2px dashed #d1d5db",
              }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>📅</div>
                <h3 style={{ color: "#475569", marginBottom: 8 }}>No Availability Set</h3>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                  Click &quot;+ Add Availability&quot; to start creating your weekly schedule.
                  Patients will only see slots for days you define here.
                </p>
              </div>
            ) : (
              <>
              {/* A schedule applied across the week can be removed as one unit,
                  rather than deleting the same block seven times. */}
              {Array.from(new Set(availability.map(a => a.template_group_id).filter(Boolean))).map(gid => {
                const inGroup = availability.filter(a => a.template_group_id === gid);
                const sample = inGroup[0];
                return (
                  <div key={gid as string} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    flexWrap: "wrap", gap: 10, marginBottom: 12, padding: "12px 16px",
                    borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe",
                  }}>
                    <div style={{ fontSize: "0.86rem", color: "#1e40af" }}>
                      <strong>Weekly schedule</strong> — {sample.start_time?.slice(0, 5)}–{sample.end_time?.slice(0, 5)} across {inGroup.length} day{inGroup.length === 1 ? "" : "s"}.
                      <span style={{ color: "#3b82f6" }}> Editing a single day below detaches it from this schedule.</span>
                    </div>
                    <button
                      onClick={() => handleDeleteGroup(gid as string)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, border: "1px solid #fca5a5",
                        background: "white", color: "#b91c1c", fontWeight: 700,
                        fontSize: "0.78rem", cursor: "pointer",
                      }}
                    >
                      Remove all {inGroup.length} days
                    </button>
                  </div>
                );
              })}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {DAYS.map((day, dayIndex) => {
                  const daySlots = availability.filter(a => a.day_of_week === dayIndex);
                  return (
                    <div
                      key={dayIndex}
                      style={{
                        backgroundColor: "white",
                        borderRadius: 12,
                        padding: 16,
                        minHeight: 160,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        border: daySlots.length > 0 ? "2px solid #0f4c8130" : "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{
                        fontWeight: 700,
                        color: daySlots.length > 0 ? "#0f4c81" : "#94a3b8",
                        fontSize: "0.8rem",
                        marginBottom: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>
                        {DAY_SHORT[dayIndex]}
                      </div>

                      {daySlots.length === 0 ? (
                        <div style={{ color: "#cbd5e1", fontSize: "0.75rem", fontStyle: "italic" }}>
                          No slots
                        </div>
                      ) : (
                        daySlots.map(slot => {
                          const mode = MODES.find(m => m.value === slot.consultation_mode);
                          return (
                            <div
                              key={slot.id}
                              style={{
                                backgroundColor: `${mode?.color || "#6b7280"}10`,
                                border: `1px solid ${mode?.color || "#6b7280"}30`,
                                borderRadius: 8,
                                padding: "8px 10px",
                                marginBottom: 6,
                                fontSize: "0.75rem",
                              }}
                            >
                              <div style={{ fontWeight: 700, color: "#1e293b" }}>
                                {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                              </div>
                              <div style={{ color: mode?.color || "#6b7280", fontWeight: 600, marginTop: 2 }}>
                                {mode?.label || slot.consultation_mode}
                              </div>
                              <div style={{ color: "#94a3b8", marginTop: 2 }}>
                                {slot.slot_duration_minutes}min slots
                              </div>
                              {slot.location_name && (
                                <div style={{ color: "#64748b", marginTop: 2, fontSize: "0.7rem" }}>
                                  📍 {slot.location_name}
                                </div>
                              )}
                              <button
                                onClick={() => handleDeleteAvailability(slot.id)}
                                style={{
                                  marginTop: 6,
                                  background: "none",
                                  border: "none",
                                  color: "#ef4444",
                                  fontSize: "0.7rem",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                🗑 Remove
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        )}

        {/* ═══ APPOINTMENTS TAB ═══ */}
        {activeTab === "appointments" && (
          <div>
            <h2 style={{ margin: "0 0 20px 0", color: "#1e293b", fontSize: "1.2rem" }}>Today&apos;s Appointments</h2>
            {todayBookings.length === 0 ? (
              <div style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 48,
                textAlign: "center",
                border: "2px dashed #d1d5db",
              }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>🗓️</div>
                <h3 style={{ color: "#475569", marginBottom: 8 }}>No Appointments Today</h3>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                  Once patients book appointments using your published schedule, they will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {todayBookings.map((booking, i) => (
                  <div
                    key={booking.id || i}
                    style={{
                      backgroundColor: "white",
                      borderRadius: 12,
                      padding: 20,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#1e293b" }}>
                        {booking.patient_name || "Patient"}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.85rem", marginTop: 4 }}>
                        {booking.slot_time || booking.time} • {booking.service_type || "Consultation"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button
                        onClick={() => router.push(`/dashboard/doctor/consult/${booking.id || "instant"}`)}
                        className="btn btn-teal btn-sm"
                        style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                      >
                        📹 Start Video Call
                      </button>
                      <span style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: booking.status === "confirmed" ? "#dcfce7" : "#fef3c7",
                        color: booking.status === "confirmed" ? "#166534" : "#92400e",
                      }}>
                        {booking.status || "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ HOME VISITS TAB ═══ */}
        {activeTab === "home_visits" && (
          <div style={{ margin: "-24px -40px" }}>
            <ProviderDispatchTracker
              title="Home Visits Dispatch"
              providerType="doctor"
              earningsRate={500}
            />
          </div>
        )}

        {/* ═══ FEES TAB ═══ */}
        {activeTab === "fees" && (
          <div>
            <h2 style={{ margin: "0 0 20px 0", color: "#1e293b", fontSize: "1.2rem" }}>Consultation Fees</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Current Fees */}
              <div style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Current Fees</h3>
                {fees.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No fees set yet. Set your consultation fees to start accepting bookings.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {fees.map(fee => {
                      const mode = MODES.find(m => m.value === fee.fee_type);
                      return (
                        <div
                          key={fee.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 16px",
                            backgroundColor: "#f8fafc",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <span style={{ color: mode?.color || "#475569", fontWeight: 600 }}>
                            {mode?.label || fee.fee_type}
                          </span>
                          <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "1.1rem" }}>
                            ₹{fee.amount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Set Fee Form */}
              <div style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Set / Update Fee</h3>
                <form onSubmit={handleSetFee}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Consultation Mode</label>
                    <select
                      value={feeForm.fee_type}
                      onChange={e => setFeeForm({ ...feeForm, fee_type: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                    >
                      <option value="in_person">🏥 In-Person</option>
                      <option value="online">💻 Online</option>
                      <option value="home_visit">🏠 Home Visit</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Amount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g., 500"
                      value={feeForm.amount}
                      onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      backgroundColor: "#0f4c81",
                      color: "white",
                      border: "none",
                      padding: "12px",
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    Save Fee
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ═══ LEAVE TAB ═══ */}
        {activeTab === "leave" && (
          <div>
            <h2 style={{ margin: "0 0 20px 0", color: "#1e293b", fontSize: "1.2rem" }}>Block Dates (Holidays & Leave)</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Block Date Form */}
              <div style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Block a Date</h3>
                <form onSubmit={handleBlockDate}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Date</label>
                    <input
                      type="date"
                      value={blockDate}
                      onChange={e => setBlockDate(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Reason (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., Personal leave, Conference"
                      value={blockReason}
                      onChange={e => setBlockReason(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: "none",
                      padding: "12px",
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    Block Date
                  </button>
                </form>
              </div>

              {/* Blocked Dates List */}
              <div style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Upcoming Blocked Dates</h3>
                {blockedDates.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No dates blocked.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {blockedDates.map(bd => (
                      <div
                        key={bd.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          backgroundColor: "#fef2f2",
                          borderRadius: 8,
                          border: "1px solid #fecaca",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: "#991b1b" }}>
                            {new Date(bd.blocked_date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          {bd.reason && (
                            <span style={{ color: "#b91c1c", marginLeft: 8, fontSize: "0.8rem" }}>
                              — {bd.reason}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnblockDate(bd.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#dc2626",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                          }}
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ PROFILE TAB ═══ */}
        {activeTab === "profile" && (
          <div>
            <SelfieVerificationCard />
            <DashboardProfile profile={profile} role="doctor" />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
