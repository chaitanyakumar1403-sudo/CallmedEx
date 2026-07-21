"use client";
import { useState, useEffect, useCallback } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import { useRouter } from "next/navigation";

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
      if (data.success) {
        setStatusMsg("✅ Availability added!");
        setShowAddForm(false);
        fetchAvailability();
      } else {
        setStatusMsg(`❌ ${data.detail || "Failed"}`);
      }
    } catch (e) {
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
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      {/* ─── Header ─── */}
      <div style={{
        background: "linear-gradient(135deg, #0f4c81 0%, #1a6fb5 50%, #0f4c81 100%)",
        padding: "24px 40px",
        color: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#ffffff" }}>
            👨‍⚕️ Doctor Command Center
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>
            Welcome, {profile?.full_name || "Doctor"} • Manage your schedule, fees, and appointments
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{
            backgroundColor: availability.length > 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
            color: availability.length > 0 ? "#86efac" : "#fca5a5",
            padding: "6px 14px",
            borderRadius: 20,
            fontSize: "0.8rem",
            fontWeight: 600,
          }}>
            {availability.length > 0 ? `${availability.length} Slots Active` : "No Slots Set"}
          </span>
        </div>
      </div>

      {/* ─── Stats Bar ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "20px 40px" }}>
        {[
          { label: "Active Slots", value: availability.filter(a => a.is_active).length, icon: "📅", color: "#2563eb", action: () => setActiveTab("schedule") },
          { label: "Today's Appointments", value: todayBookings.length, icon: "🗓️", color: "#16a34a", action: () => setActiveTab("appointments") },
          { label: "Fee Types Set", value: fees.length, icon: "💰", color: "#d97706", action: () => setActiveTab("fees") },
          { label: "Blocked Dates", value: blockedDates.length, icon: "🏖️", color: "#dc2626", action: () => setActiveTab("schedule") },
        ].map((stat, i) => (
          <div key={i} onClick={stat.action} style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            cursor: "pointer",
            transition: "transform 0.2s, box-shadow 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"; }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              backgroundColor: `${stat.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem",
            }}>{stat.icon}</div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>{stat.value}</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Tabs ─── */}
      <div style={{ padding: "0 40px", display: "flex", gap: 4, borderBottom: "1px solid #e2e8f0" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px",
              border: "none",
              backgroundColor: activeTab === tab.id ? "white" : "transparent",
              color: activeTab === tab.id ? "#0f4c81" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "0.9rem",
              cursor: "pointer",
              borderBottom: activeTab === tab.id ? "3px solid #0f4c81" : "3px solid transparent",
              borderRadius: "8px 8px 0 0",
              transition: "all 0.2s",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Content ─── */}
      <div style={{ padding: "24px 40px" }}>
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
              icon="🏠"
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
      </div>
    </div>
  );
}
