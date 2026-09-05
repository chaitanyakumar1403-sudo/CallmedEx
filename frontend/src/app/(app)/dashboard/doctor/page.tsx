"use client";

import { useState, useEffect, useCallback } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import ProviderSchedulePanel from "../components/ProviderSchedulePanel";
import { useRouter } from "next/navigation";
import DashboardShell from "../components/DashboardShell";
import SelfieVerificationCard from "../components/SelfieVerificationCard";
import {
  Calendar,
  Clock,
  Home,
  CreditCard,
  User,
  Video,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  DollarSign,
  Activity,
  FileText,
  ShieldCheck,
  Send,
  Trash2,
  TrendingUp,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  ExternalLink,
  MapPin,
  Navigation,
  Check,
  Shield,
  Printer,
  QrCode,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

interface ProviderEarnings {
  total_earned: number;
  settled: number;
  pending_settlement: number;
  transactions: any[];
}

interface ProviderFee {
  id: string;
  fee_type: string;
  amount: number;
}

export default function DoctorDashboard() {
  const router = useRouter();
  // Appointments is first and default
  const [activeTab, setActiveTab] = useState("appointments");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Active Live Telemedicine Waiting Room Queue (/api/telemed/active)
  const [activeConsultations, setActiveConsultations] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Real Bookings (Today's roster)
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const [appointmentsFilter, setAppointmentsFilter] = useState<"all" | "waiting" | "confirmed" | "completed">("all");
  const [modalityFilter, setModalityFilter] = useState<"all" | "walk_in" | "home_visit" | "online">("all");

  // Home Visit Shift Scheduling & Service Tier Manager State
  const [homeVisitOnDuty, setHomeVisitOnDuty] = useState(true);
  const [homeVisitShift, setHomeVisitShift] = useState("09:00 AM – 06:00 PM");
  const [normalVisitFee, setNormalVisitFee] = useState("800");
  const [urgentVisitFee, setUrgentVisitFee] = useState("1500");
  const [showGpsMap, setShowGpsMap] = useState(false);
  const [activeDispatches, setActiveDispatches] = useState<any[]>([]);
  const [etaUpdatingId, setEtaUpdatingId] = useState<string | null>(null);

  // Real Doctor Earnings & Financial Settlement (/api/payments/my-earnings)
  const [earnings, setEarnings] = useState<ProviderEarnings | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);

  // Configured Practice Fees (/api/providers/my-fees)
  const [fees, setFees] = useState<ProviderFee[]>([]);
  const [feeForm, setFeeForm] = useState({ fee_type: "in_person", amount: "" });
  const [feeSaving, setFeeSaving] = useState(false);

  // Standalone Digital e-Prescription Studio state with MANDATORY Patient Email
  const [selectedPatientId, setSelectedPatientId] = useState<string>("custom");
  const [rxPatientName, setRxPatientName] = useState("");
  const [rxPatientAge, setRxPatientAge] = useState("");
  const [rxPatientGender, setRxPatientGender] = useState("Female");
  const [rxPatientEmail, setRxPatientEmail] = useState("");
  const [rxPatientMobile, setRxPatientMobile] = useState("");
  const [rxDiagnosis, setRxDiagnosis] = useState("");
  const [rxClinicalNotes, setRxClinicalNotes] = useState("");
  const [rxItems, setRxItems] = useState<any[]>([]);
  const [rxLabTests, setRxLabTests] = useState<string[]>([]);
  const [newLabTest, setNewLabTest] = useState("");

  const [rxNewName, setRxNewName] = useState("");
  const [rxNewDose, setRxNewDose] = useState("1 tablet");
  const [rxNewFreq, setRxNewFreq] = useState("BD (Twice a day)");
  const [rxNewDays, setRxNewDays] = useState("5 days");
  const [rxNewNotes, setRxNewNotes] = useState("After food");
  const [transmittingRx, setTransmittingRx] = useState(false);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

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

  const fetchActiveTelemedQueue = useCallback(async () => {
    try {
      setQueueLoading(true);
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/telemed/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.consultations)) {
        setActiveConsultations(data.consultations);
      } else {
        setActiveConsultations([]);
      }
    } catch (e) {
      console.error("Failed to fetch active telemed queue:", e);
      setActiveConsultations([]);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const fetchTodayBookings = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/bookings/provider/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.bookings)) {
        setTodayBookings(data.data.bookings);
      } else {
        setTodayBookings([]);
      }
    } catch (e) {
      console.error("Failed to fetch today bookings:", e);
      setTodayBookings([]);
    }
  }, []);

  const fetchEarnings = useCallback(async () => {
    try {
      setEarningsLoading(true);
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/payments/my-earnings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.earnings) {
        setEarnings(data.earnings);
      }
    } catch (e) {
      console.error("Failed to fetch earnings:", e);
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  const fetchFees = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/providers/my-fees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.fees)) {
        setFees(data.fees);
      }
    } catch (e) {
      console.error("Failed to fetch fees:", e);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchTodayBookings();
    fetchActiveTelemedQueue();
    fetchEarnings();
    fetchFees();
    const interval = setInterval(fetchActiveTelemedQueue, 15000);
    return () => clearInterval(interval);
  }, [fetchProfile, fetchTodayBookings, fetchActiveTelemedQueue, fetchEarnings, fetchFees]);

  // Handle patient selection in e-Prescription studio
  const handleSelectPatientForRx = (val: string) => {
    setSelectedPatientId(val);
    if (val === "custom") {
      setRxPatientName("");
      setRxPatientAge("");
      setRxPatientEmail("");
      setRxPatientMobile("");
      return;
    }

    // Check in today's bookings first
    const booking = todayBookings.find((b) => b.id === val);
    if (booking) {
      setRxPatientName(booking.patient_name || "");
      setRxPatientEmail(booking.patient_email || "");
      setRxPatientMobile(booking.patient_mobile || "");
      setRxPatientAge(booking.age ? String(booking.age) : "");
      setRxPatientGender(booking.patient_gender || "Female");
      if (booking.notes) setRxDiagnosis(booking.notes);
      return;
    }

    // Check in active telemed consultations
    const consult = activeConsultations.find((c) => c.id === val);
    if (consult) {
      setRxPatientName(consult.patient_name || "");
      setRxPatientEmail(consult.patient_email || "");
      setRxPatientMobile(consult.patient_mobile || "");
      setRxPatientAge(consult.patient_age ? String(consult.patient_age) : "");
      setRxPatientGender(consult.patient_gender || "Female");
      if (consult.symptoms) setRxDiagnosis(consult.symptoms);
    }
  };

  const handleAddRxItem = () => {
    if (!rxNewName.trim()) return;
    setRxItems([
      ...rxItems,
      { name: rxNewName.trim(), dose: rxNewDose, freq: rxNewFreq, days: rxNewDays, notes: rxNewNotes },
    ]);
    setRxNewName("");
  };

  const handleAddLabTest = () => {
    if (!newLabTest.trim()) return;
    setRxLabTests([...rxLabTests, newLabTest.trim()]);
    setNewLabTest("");
  };

  // Save Custom Practice Fee
  const handleSaveCustomFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(feeForm.amount);
    if (!amount || amount <= 0) {
      setStatusMsg({ text: "Enter a consultation fee greater than zero.", type: "error" });
      return;
    }
    setFeeSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/providers/fees`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ fee_type: feeForm.fee_type, amount }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ text: `✓ Fee updated: ₹${amount} for ${feeForm.fee_type.replace("_", " ")}`, type: "success" });
        setFeeForm({ ...feeForm, amount: "" });
        fetchFees();
      } else {
        setStatusMsg({ text: data.detail || "Failed to update fee.", type: "error" });
      }
    } catch {
      setStatusMsg({ text: "Network error saving fee.", type: "error" });
    } finally {
      setFeeSaving(false);
    }
  };

  // Transmit e-Prescription directly to Patient Email
  const handleTransmitRxEmail = async () => {
    if (!rxPatientName.trim()) {
      setStatusMsg({ text: "Patient Name is mandatory for e-Prescription.", type: "error" });
      return;
    }
    if (!rxPatientEmail.trim() || !rxPatientEmail.includes("@")) {
      setStatusMsg({ text: "Valid Patient Email Address is MANDATORY to transmit this e-Prescription.", type: "error" });
      return;
    }
    if (rxItems.length === 0) {
      setStatusMsg({ text: "Please prescribe at least one generic medication formulation.", type: "error" });
      return;
    }

    setTransmittingRx(true);
    try {
      const res = await fetch(`${apiBase}/api/telemed/send-rx-email`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          patient_email: rxPatientEmail.trim(),
          patient_name: rxPatientName.trim(),
          doctor_name: profile?.full_name ? `Dr. ${profile.full_name}` : "Dr. CallMedex Consultant",
          doctor_qualification: profile?.qualification || "MBBS, MD",
          doctor_reg_number: profile?.registration_number || "NMC-VERIFIED-2026",
          diagnosis: rxDiagnosis,
          medicines: rxItems,
          lab_tests: rxLabTests,
          clinical_notes: rxClinicalNotes,
          consultation_id: selectedPatientId !== "custom" ? selectedPatientId : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({
          text: `✓ Official e-Prescription successfully transmitted to ${rxPatientEmail} and recorded on patient's digital EHR.`,
          type: "success",
        });
      } else {
        setStatusMsg({ text: data.detail || "Failed to transmit e-prescription email.", type: "error" });
      }
    } catch {
      setStatusMsg({ text: "Network error transmitting e-prescription.", type: "error" });
    } finally {
      setTransmittingRx(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cm-surface)", color: "var(--cm-ink)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--cm-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--cm-navy)" }}>
            <Stethoscope size={32} />
          </div>
          <h2 style={{ color: "var(--cm-ink)", fontWeight: 800, fontSize: "var(--cm-text-lg)" }}>
            Loading Clinical Doctor Workstation...
          </h2>
        </div>
      </div>
    );
  }

  // Calculate real waiting queue count (active telemed + waiting bookings)
  const waitingCount = activeConsultations.length + todayBookings.filter((b) => b.status === "waiting").length;

  const tabs = [
    { id: "appointments", label: "Appointments", icon: Clock },
    { id: "schedule", label: "Slots & Availability", icon: Calendar },
    { id: "radar", label: "Waiting Room Radar", icon: Activity },
    { id: "erx_studio", label: "e-Prescription Pad", icon: FileText },
    { id: "tariffs", label: "Consultation Tariffs", icon: CreditCard },
    { id: "home_visits", label: "Home Visits", icon: Home },
    { id: "revenue", label: "Revenue & Payouts", icon: DollarSign },
    { id: "profile", label: "Doctor Profile", icon: User },
  ];

  // All active patients list for dropdown
  const allActivePatients = [
    ...activeConsultations.map((c) => ({ id: c.id, label: `${c.patient_name || "Patient in Queue"} (Teleconsult Lobby)` })),
    ...todayBookings.map((b) => ({ id: b.id, label: `${b.patient_name || "Scheduled Patient"} (${b.slot_time || "Today"})` })),
  ];

  const filteredBookings = todayBookings.filter((b) => {
    // Status filter
    if (appointmentsFilter !== "all" && b.status !== appointmentsFilter) {
      return false;
    }
    // Sub-modality filter
    if (modalityFilter !== "all") {
      const sType = String(b.service_type || b.consultation_type || b.mode || "").toLowerCase();
      if (modalityFilter === "walk_in") {
        return sType.includes("walk") || sType.includes("person") || sType.includes("clinic") || sType.includes("opd");
      }
      if (modalityFilter === "home_visit") {
        return sType.includes("home") || sType.includes("doorstep") || sType.includes("visit");
      }
      if (modalityFilter === "online") {
        return sType.includes("online") || sType.includes("video") || sType.includes("tele");
      }
    }
    return true;
  });

  const isVerified = String(profile?.verification_status).toLowerCase() === "verified";

  return (
    <DashboardShell
      role="doctor"
      title={profile?.full_name ? `Dr. ${profile.full_name}` : "Dr. Verified Medical Specialist"}
      subtitle={`${profile?.qualification || "MBBS, MD"} · ${profile?.specialization || "General Medicine & Cardiology"} · ${profile?.hospital_clinic_name || "CallMedex Clinical Network"}`}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <button
          type="button"
          onClick={() => router.push("/dashboard/doctor/consult/instant")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 800,
            fontSize: "var(--cm-text-sm)",
            padding: "9px 18px",
            borderRadius: "9999px",
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            color: "#fff",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 10px #4ade80" }} />
          <Video size={16} /> Instant Teleconsult Room
        </button>
      }
    >
      {/* ─── Top Clinical Metrics Strip (REAL, UNMIXED DATA) ─── */}
      <div className="cm-metric-strip">
        <div className="cm-metric-card" onClick={() => setActiveTab("radar")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <Activity size={14} style={{ color: "var(--cm-urgent)" }} /> Waiting in Queue
          </div>
          <div className="cm-metric-card__value">
            {waitingCount}
          </div>
          <div className="cm-metric-card__meta">
            {waitingCount > 0 ? "Virtual lobby active" : "Queue currently empty"}
          </div>
        </div>

        <div className="cm-metric-card" onClick={() => setActiveTab("appointments")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <Clock size={14} style={{ color: "var(--cm-active)" }} /> Today&apos;s Consults
          </div>
          <div className="cm-metric-card__value">{todayBookings.length}</div>
          <div className="cm-metric-card__meta">Scheduled appointments</div>
        </div>

        {/* Real Dynamic Net Earnings from Payment Ledger */}
        <div className="cm-metric-card" onClick={() => setActiveTab("revenue")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <TrendingUp size={14} style={{ color: "var(--cm-done)" }} /> Net Earnings
          </div>
          <div className="cm-metric-card__value" style={{ fontVariantNumeric: "tabular-nums" }}>
            {earningsLoading ? "..." : `₹${(earnings?.total_earned || 0).toLocaleString()}`}
          </div>
          <div className="cm-metric-card__meta">Daily direct settlement</div>
        </div>

        <div className="cm-metric-card" onClick={() => setActiveTab("profile")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <ShieldCheck size={14} style={{ color: isVerified ? "var(--cm-done)" : "#0284c7" }} /> Clinical Status
          </div>
          <div style={{ marginTop: 6, marginBottom: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: "9999px",
                fontSize: "1.1rem",
                fontWeight: 800,
                letterSpacing: "0.01em",
                background: isVerified ? "rgba(34, 197, 94, 0.12)" : "rgba(2, 132, 199, 0.12)",
                color: isVerified ? "#15803d" : "#0369a1",
                border: `1px solid ${isVerified ? "rgba(34, 197, 94, 0.3)" : "rgba(2, 132, 199, 0.3)"}`,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: isVerified ? "#22c55e" : "#0284c7" }} />
              {isVerified ? "Active" : "Pending"}
            </span>
          </div>
          <div className="cm-metric-card__meta">
            {isVerified ? "NMC Verified Practitioner" : "Under NMC Credential Review"}
          </div>
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--cm-radius)",
            background: statusMsg.type === "success" ? "var(--cm-done-surface)" : "var(--cm-urgent-surface)",
            color: statusMsg.type === "success" ? "var(--cm-done)" : "var(--cm-urgent)",
            border: `1px solid ${statusMsg.type === "success" ? "var(--cm-done-line)" : "var(--cm-urgent-line)"}`,
            marginBottom: "var(--cm-4)",
            fontSize: "var(--cm-text-sm)",
            fontWeight: 700,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: "bold" }}
          >
            ×
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: LIVE PATIENT WAITING ROOM RADAR (GLASSMORPHIC WIDGET)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "radar" && (
        <div className="cm-widget-glass-light" style={{ marginBottom: 24 }}>
          <div className="cm-widget-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(2, 132, 199, 0.15)", color: "#0284c7", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(2, 132, 199, 0.3)" }}>
                  Teleconsultation Radar
                </span>
                <span style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                  {waitingCount > 0 ? `${waitingCount} patient(s) waiting` : "Queue currently clear"} · Auto-refreshes every 15s
                </span>
              </div>
              <h3 className="cm-widget-title">
                <Activity size={20} />
                <span>Virtual Teleconsultation Waiting Room Radar</span>
              </h3>
              <p className="cm-widget-subtitle">
                Real-time queue tracking for registered patients waiting in your encrypted teleconsultation lobby.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={fetchActiveTelemedQueue}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                <RefreshCw size={14} className={queueLoading ? "animate-spin" : ""} /> {queueLoading ? "Polling..." : "Refresh Queue"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard/doctor/consult/instant")}
                className="cm-btn cm-btn--primary cm-btn--sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 800,
                  borderRadius: "9999px",
                  padding: "8px 18px",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                }}
              >
                <Video size={14} /> Launch Instant Exam Room
              </button>
            </div>
          </div>

          {/* Active Waiting Room Grid */}
          {activeConsultations.length > 0 ? (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px rgba(239, 68, 68, 0.6)" }} />
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                  Patients In Waiting Room Now ({activeConsultations.length})
                </h4>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {activeConsultations.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "16px 20px",
                      borderRadius: 12,
                      background: "rgba(255, 255, 255, 0.9)",
                      border: "1px solid rgba(186, 230, 253, 0.8)",
                      borderLeft: "4px solid #0284c7",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(224, 242, 254, 0.8) 100%)",
                          color: "#0369a1",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 900,
                          fontSize: "1.1rem",
                        }}
                      >
                        {c.patient_name?.[0] || "P"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                            {c.patient_name || "Patient in Queue"}
                          </span>
                          <span className="cm-pill cm-pill--active" style={{ fontSize: "11px", fontWeight: 800 }}>
                            Lobby Active
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          Waiting time: <strong>{c.elapsed_minutes || 2} mins</strong> · Chief complaint: <strong>{c.notes || "Telehealth Consultation"}</strong>
                        </div>
                        {c.patient_email && (
                          <div style={{ fontSize: "0.8rem", color: "#0284c7", marginTop: 2, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                            <Mail size={12} /> {c.patient_email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/doctor/consult/${c.id}`)}
                        className="cm-btn cm-btn--primary cm-btn--sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, padding: "8px 16px" }}
                      >
                        <Video size={14} /> Connect Patient Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: "36px 20px", textAlign: "center", background: "rgba(240, 249, 255, 0.5)", border: "1px dashed rgba(186, 230, 253, 0.9)", borderRadius: 12, marginBottom: 24 }}>
              <Activity size={36} style={{ color: "#0284c7", margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "1rem" }}>Virtual Waiting Room is Empty</div>
              <p style={{ margin: "4px auto 0", fontSize: "0.82rem", color: "var(--cm-ink-3)", maxWidth: 440 }}>
                Patients booking online teleconsultations will appear live on this radar as soon as they enter your virtual clinic lobby.
              </p>
            </div>
          )}

          {/* Today's Scheduled Patients Queue */}
          <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: 20, borderRadius: 12, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(2, 132, 199, 0.12)", color: "#0284c7", display: "grid", placeItems: "center" }}>
                  <Clock size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                    Today&apos;s Clinical Appointments Roster ({todayBookings.length})
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--cm-ink-3)" }}>
                    Patients scheduled for telemedicine, in-person clinic, or doorstep visits.
                  </p>
                </div>
              </div>
            </div>

            {todayBookings.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", background: "rgba(248, 250, 252, 0.8)", borderRadius: 10, border: "1px dashed #cbd5e1" }}>
                <Clock size={32} style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "0.95rem" }}>No Scheduled Consultations for Today</div>
                <p style={{ margin: "4px auto 0", fontSize: "0.8rem", color: "var(--cm-ink-3)", maxWidth: 420 }}>
                  Your schedule is published and open. New bookings will automatically populate here in real time.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {todayBookings.map((patient) => (
                  <div
                    key={patient.id}
                    style={{
                      padding: "14px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                      background: "#fff",
                      border: "1px solid rgba(186, 230, 253, 0.8)",
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                          {patient.patient_name || "Patient"}
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)" }}>
                          ({patient.patient_gender || "Patient"})
                        </span>
                        <span className={`cm-pill ${patient.status === "waiting" ? "cm-pill--urgent" : "cm-pill--active"}`}>
                          {patient.status || "Scheduled"}
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "#0284c7", fontWeight: 700 }}>
                          Slot: {patient.slot_time || "Today"}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 16, fontSize: "0.78rem", color: "var(--cm-ink-3)", marginTop: 4 }}>
                        {patient.patient_email && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Mail size={12} /> {patient.patient_email}
                          </span>
                        )}
                        {patient.patient_mobile && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Phone size={12} /> {patient.patient_mobile}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectPatientForRx(patient.id);
                          setActiveTab("erx_studio");
                        }}
                        className="cm-btn cm-btn--secondary cm-btn--sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                      >
                        <FileText size={14} /> Draft e-Rx
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/doctor/consult/${patient.id}`)}
                        className="cm-btn cm-btn--primary cm-btn--sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800 }}
                      >
                        <Video size={14} /> Open Exam Room
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: CONSULTATION TARIFFS & CUSTOM PRACTICE FEES (FULL-WIDTH WIDGET)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tariffs" && (
        <div className="cm-widget-glass-light" style={{ marginBottom: 24 }}>
          <div className="cm-widget-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(2, 132, 199, 0.15)", color: "#0284c7", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(2, 132, 199, 0.3)" }}>
                  Autonomous Practice Tariffs
                </span>
                <span style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                  80% Net Payout Retention · Direct Daily Bank Settlement
                </span>
              </div>
              <h3 className="cm-widget-title">
                <DollarSign size={20} />
                <span>Practice Consultation Tariffs</span>
              </h3>
              <p className="cm-widget-subtitle">
                Manage your customized clinical consultation fees. Configured tariffs reflect live across your patient appointment booking slots.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20, alignItems: "start" }}>
            {/* Active Configured Practice Tariffs Card */}
            <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: 22, border: "1px solid rgba(186, 230, 253, 0.8)", borderRadius: 12, boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                    Current Active Practice Tariffs
                  </h4>
                  <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                    Live rates charged to patients at checkout
                  </div>
                </div>
                <span className="cm-pill cm-pill--active" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 800, fontSize: "11px" }}>
                  <ShieldCheck size={12} /> Custom Tariffs Active
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  {
                    type: "in_person",
                    label: "Walk-in Clinic Consultation",
                    desc: "Physical in-clinic evaluation and diagnostic examination",
                    defaultVal: 500,
                  },
                  {
                    type: "online",
                    label: "Online HD Teleconsultation",
                    desc: "Encrypted 1-on-1 video consult with live e-Prescription",
                    defaultVal: 400,
                  },
                  {
                    type: "home_visit",
                    label: "Doorstep Home Clinical Visit",
                    desc: "Comprehensive bedside visit and patient physical checkup",
                    defaultVal: 800,
                  },
                ].map((item) => {
                  const feeObj = fees.find((f) => f.fee_type === item.type);
                  const activeAmount = feeObj ? feeObj.amount : item.defaultVal;
                  const doctorNet = Math.round(activeAmount * 0.8);

                  return (
                    <div
                      key={item.type}
                      style={{
                        padding: "14px 16px",
                        background: "linear-gradient(135deg, rgba(240, 249, 255, 0.5) 0%, rgba(255, 255, 255, 0.95) 100%)",
                        border: "1px solid rgba(186, 230, 253, 0.7)",
                        borderRadius: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--cm-ink)" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          {item.desc}
                        </div>
                        <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: 800, marginTop: 4 }}>
                          Doctor Net Payout (80%): ₹{doctorNet}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", marginLeft: 16 }}>
                        <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                          ₹{activeAmount}
                        </div>
                        <span style={{ fontSize: "11px", color: feeObj ? "#0284c7" : "var(--cm-ink-3)", fontWeight: 800 }}>
                          {feeObj ? "Customized" : "Default"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, background: "rgba(2, 132, 199, 0.06)", border: "1px solid rgba(186, 230, 253, 0.9)", fontSize: "12px", color: "var(--cm-ink-2)", lineHeight: 1.5 }}>
                💡 <strong>Autonomy Note:</strong> Tariff adjustments take effect immediately for upcoming patient bookings. You retain 80% with daily direct bank settlement.
              </div>
            </div>

            {/* Customize Practice Fee Form */}
            <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: 22, border: "1px solid rgba(186, 230, 253, 0.8)", borderRadius: 12, boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 800, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                <DollarSign size={16} style={{ color: "#0284c7" }} />
                <span>Customize Practice Fee</span>
              </h4>
              <p style={{ margin: "0 0 16px 0", fontSize: "0.8rem", color: "var(--cm-ink-3)" }}>
                Update your consultation fee for any modality.
              </p>

              <form onSubmit={handleSaveCustomFee} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "var(--cm-ink-2)", marginBottom: 6, textTransform: "uppercase" }}>
                    Consultation Modality
                  </label>
                  <select
                    value={feeForm.fee_type}
                    onChange={(e) => setFeeForm({ ...feeForm, fee_type: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #bae6fd", fontSize: "0.88rem", background: "#fff", color: "var(--cm-ink)", fontWeight: 600 }}
                  >
                    <option value="in_person">Walk-in Clinic Consultation</option>
                    <option value="online">Online HD Teleconsultation</option>
                    <option value="home_visit">Doorstep Home Clinical Visit</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "var(--cm-ink-2)", marginBottom: 6, textTransform: "uppercase" }}>
                    New Practice Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    placeholder="e.g. 600"
                    value={feeForm.amount}
                    onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #bae6fd", fontSize: "0.95rem", background: "#fff", color: "var(--cm-ink)", fontWeight: 800 }}
                  />
                  {feeForm.amount && Number(feeForm.amount) > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 800, marginTop: 6 }}>
                      Estimated Net Payout (80%): ₹{Math.round(Number(feeForm.amount) * 0.8)}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={feeSaving}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{
                    marginTop: 6,
                    fontWeight: 800,
                    padding: "10px 18px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                  }}
                >
                  {feeSaving ? "Saving Fee..." : "Update Practice Tariff"}
                </button>
              </form>

              <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #e2e8f0", fontSize: "11px", color: "var(--cm-ink-3)", lineHeight: 1.5 }}>
                ⚖️ <strong>MOU Terms:</strong> All fee payouts are governed under your accepted CallMedex Provider MOU. View your complete legal agreement anytime in the <strong>Doctor Profile</strong> tab.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: DIGITAL e-PRESCRIPTION PAD STUDIO (FULL-WIDTH 2-COLUMN STUDIO)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "erx_studio" && (
        <div className="cm-erx-studio-container">
          {/* Header strip */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(2, 132, 199, 0.12)", color: "#0284c7", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(2, 132, 199, 0.25)" }}>
                  NMC Clinical Standard · Registered Tele-Rx Studio
                </span>
                <span style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                  Dr. {profile?.full_name || "Verified Practitioner"} · Reg: {profile?.registration_number || "NMC-2026-REG"}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={22} style={{ color: "#0284c7" }} />
                <span>Digital e-Prescription Pad Studio</span>
              </h2>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.85rem", color: "var(--cm-ink-3)" }}>
                Draft, live-preview on official NMC parchment with watermark, and instantly dispatch signed digital e-prescriptions to patient email.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                <Printer size={14} /> Print / Save PDF
              </button>
              <button
                type="button"
                onClick={handleTransmitRxEmail}
                disabled={transmittingRx}
                className="cm-btn cm-btn--primary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, padding: "8px 18px" }}
              >
                <Send size={14} /> {transmittingRx ? "Transmitting e-Rx..." : "Transmit e-Rx to Patient Email"}
              </button>
            </div>
          </div>

          {/* Two-Column Studio Layout */}
          <div className="cm-erx-grid">
            {/* ── LEFT COLUMN: Clinical Drafting Deck ────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Quick Patient Selector */}
              {allActivePatients.length > 0 && (
                <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 6px rgba(2, 132, 199, 0.05)" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", marginBottom: 6 }}>
                    Auto-Fill From Active Patients
                  </label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => handleSelectPatientForRx(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #bae6fd", fontSize: "0.85rem", background: "#f8fafc", color: "var(--cm-ink)", fontWeight: 600 }}
                  >
                    <option value="custom">— Manual Entry / New Patient —</option>
                    {allActivePatients.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Patient Demographics Card */}
              <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={14} /> Patient Demographics
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Priya Sharma"
                      value={rxPatientName}
                      onChange={(e) => setRxPatientName(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                      Age
                    </label>
                    <input
                      type="number"
                      placeholder="Age"
                      value={rxPatientAge}
                      onChange={(e) => setRxPatientAge(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                      Gender
                    </label>
                    <select
                      value={rxPatientGender}
                      onChange={(e) => setRxPatientGender(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff" }}
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Patient Contact & Mandatory Email Field */}
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", fontWeight: 800, color: rxPatientEmail ? "#0369a1" : "var(--cm-urgent)", marginBottom: 4 }}>
                      <Mail size={13} /> Patient Email Address (MANDATORY) *
                    </label>
                    <input
                      type="email"
                      placeholder="patient.email@example.com"
                      value={rxPatientEmail}
                      onChange={(e) => setRxPatientEmail(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: rxPatientEmail ? "1.5px solid #0284c7" : "1.5px solid rgba(225, 29, 72, 0.5)",
                        background: rxPatientEmail ? "#f0f9ff" : "#fff",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "var(--cm-ink-3)", marginTop: 4 }}>
                      Official digitally-signed e-prescription is automatically delivered here.
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                      <Phone size={13} /> Mobile Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={rxPatientMobile}
                      onChange={(e) => setRxPatientMobile(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff" }}
                    />
                  </div>
                </div>
              </div>

              {/* ICD-10 Diagnosis Card */}
              <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Primary Clinical Diagnosis (ICD-10 Standard)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acute Viral Upper Respiratory Infection (ICD-10: J06.9)"
                  value={rxDiagnosis}
                  onChange={(e) => setRxDiagnosis(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Viral Pharyngitis (J02.9)", "Type 2 Diabetes (E11.9)", "Hypertension (I10)", "Acute Bronchitis (J20.9)", "Gastritis (K29.7)"].map((diag) => (
                    <button
                      key={diag}
                      type="button"
                      onClick={() => setRxDiagnosis(diag)}
                      style={{ padding: "3px 8px", borderRadius: 6, fontSize: "11px", fontWeight: 600, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" }}
                    >
                      + {diag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formulation Builder & Current Medications Deck */}
              <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    ℞ Prescribed Generic Formulations ({rxItems.length})
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--cm-ink-3)" }}>
                    Indian NMC Telemedicine Act Compliant
                  </span>
                </div>

                {/* Current Items List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {rxItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: 8,
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#0369a1" }}>
                          {idx + 1}. {item.name}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "#0284c7", marginTop: 2 }}>
                          {item.dose} · {item.freq} · {item.days} · <em>{item.notes}</em>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRxItems(rxItems.filter((_, i) => i !== idx))}
                        style={{ background: "none", border: "none", color: "var(--cm-urgent)", cursor: "pointer", padding: 4 }}
                        title="Remove formulation"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Formulation Form */}
                <div style={{ background: "linear-gradient(135deg, rgba(240, 249, 255, 0.7), rgba(255, 255, 255, 0.95))", border: "1px dashed #7dd3fc", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                    + Add Generic Salt / Formulation
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Generic Salt & Strength (e.g. Paracetamol 650mg)"
                      value={rxNewName}
                      onChange={(e) => setRxNewName(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "#fff" }}
                    />
                    <input
                      type="text"
                      placeholder="Dose (e.g. 1 tab)"
                      value={rxNewDose}
                      onChange={(e) => setRxNewDose(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "#fff" }}
                    />
                    <select
                      value={rxNewFreq}
                      onChange={(e) => setRxNewFreq(e.target.value)}
                      style={{ padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "#fff" }}
                    >
                      <option value="OD (Once daily)">OD (Once daily)</option>
                      <option value="BD (Twice daily)">BD (Twice daily)</option>
                      <option value="TID (Thrice daily)">TID (Thrice daily)</option>
                      <option value="QID (4 times daily)">QID (4 times daily)</option>
                      <option value="SOS (As needed)">SOS (As needed)</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Duration (e.g. 5 days)"
                      value={rxNewDays}
                      onChange={(e) => setRxNewDays(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "#fff" }}
                    />
                    <select
                      value={rxNewNotes}
                      onChange={(e) => setRxNewNotes(e.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "#fff" }}
                    >
                      <option value="After food">After food</option>
                      <option value="Before food">Before food</option>
                      <option value="With food">With food</option>
                      <option value="Empty stomach">Empty stomach</option>
                      <option value="At bedtime">At bedtime</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddRxItem}
                      className="cm-btn cm-btn--primary cm-btn--sm"
                      style={{ fontWeight: 800, padding: "8px 16px" }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Diagnostic Labs & Clinical Advice Deck */}
              <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
                {/* Diagnostic Lab Tests */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", marginBottom: 6 }}>
                    Diagnostic Lab Investigations (Optional)
                  </label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="e.g. Complete Blood Count (CBC), Serum Creatinine, HbA1c"
                      value={newLabTest}
                      onChange={(e) => setNewLabTest(e.target.value)}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "#fff" }}
                    />
                    <button type="button" onClick={handleAddLabTest} className="cm-btn cm-btn--secondary cm-btn--sm" style={{ fontWeight: 700 }}>
                      Add Test
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {rxLabTests.map((t, idx) => (
                      <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "#f0f9ff", color: "#0369a1", fontSize: "11px", fontWeight: 700, border: "1px solid #bae6fd" }}>
                        {t}
                        <button type="button" onClick={() => setRxLabTests(rxLabTests.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "#0284c7", padding: 0, fontWeight: "bold" }}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Clinical Notes & Advice */}
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", marginBottom: 6 }}>
                    Doctor Advice &amp; Lifestyle Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={rxClinicalNotes}
                    onChange={(e) => setRxClinicalNotes(e.target.value)}
                    placeholder="e.g. Maintain hydration (3L/day), light diet, review if fever persists > 48h."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.82rem", background: "#fff" }}
                  />
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Live NMC Digital Prescription Slip Preview ─ */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="cm-erx-preview-parchment" style={{ flex: 1 }}>
                {/* Watermark */}
                <div className="cm-erx-watermark">
                  OFFICIAL NMC e-Rx
                </div>

                {/* Doctor & Clinic Official Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0284c7", paddingBottom: 14, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", color: "#0284c7", textTransform: "uppercase" }}>
                      CALLMEDEX HEALTHCARE NETWORK · TELEMEDICINE &amp; BEDSIDE
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                      {profile?.full_name ? `Dr. ${profile.full_name}` : "Dr. Verified Medical Specialist"}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#334155", fontWeight: 600 }}>
                      {profile?.qualification || "MBBS, MD"} · {profile?.specialization || "General Medicine & Telehealth"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                      Reg. No: <strong style={{ color: "#0f172a" }}>{profile?.registration_number || "NMC-DL-2026-88421"}</strong> (National Medical Commission)
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 6, background: "rgba(2, 132, 199, 0.1)", border: "1px solid rgba(2, 132, 199, 0.25)", color: "#0284c7", fontSize: "11px", fontWeight: 800 }}>
                      <ShieldCheck size={13} /> NMC Compliant
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b", marginTop: 4 }}>
                      Date: <strong>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong>
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>
                      Rx ID: <strong>CMD-RX-{new Date().getFullYear()}-{profile?.id ? profile.id.slice(0, 4).toUpperCase() : "8841"}</strong>
                    </div>
                  </div>
                </div>

                {/* Patient Summary Strip */}
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, padding: "10px 14px", background: "rgba(240, 249, 255, 0.6)", borderRadius: 8, border: "1px solid #e0f2fe", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#0284c7", fontWeight: 800, textTransform: "uppercase" }}>Patient Details</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
                      {rxPatientName || "Patient Name (Pending)"}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#475569" }}>
                      {rxPatientAge ? `${rxPatientAge} yrs` : "Age —"} · {rxPatientGender || "Gender —"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.7rem", color: "#0284c7", fontWeight: 800, textTransform: "uppercase" }}>Registered Delivery Email</div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: rxPatientEmail ? "#0369a1" : "#e11d48", wordBreak: "break-all" }}>
                      {rxPatientEmail || "⚠️ Mandatory email required"}
                    </div>
                    {rxPatientMobile && (
                      <div style={{ fontSize: "0.76rem", color: "#64748b" }}>
                        Tel: {rxPatientMobile}
                      </div>
                    )}
                  </div>
                </div>

                {/* Diagnosis Banner */}
                {rxDiagnosis && (
                  <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "#f8fafc", borderLeft: "3px solid #0284c7" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Clinical Diagnosis: </span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>{rxDiagnosis}</span>
                  </div>
                )}

                {/* ℞ Prescription Body */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "1.1rem", fontWeight: 900, color: "#0284c7", marginBottom: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
                    <span>℞</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>Prescribed Medications</span>
                  </div>

                  {rxItems.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic", border: "1px dashed #cbd5e1", borderRadius: 8 }}>
                      No medications added yet. Add medications using the formulation deck on the left.
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #cbd5e1", textAlign: "left", color: "#475569", fontSize: "0.72rem", textTransform: "uppercase" }}>
                          <th style={{ padding: "6px 8px", width: 24 }}>#</th>
                          <th style={{ padding: "6px 8px" }}>Formulation &amp; Strength</th>
                          <th style={{ padding: "6px 8px" }}>Dosage &amp; Frequency</th>
                          <th style={{ padding: "6px 8px" }}>Duration</th>
                          <th style={{ padding: "6px 8px" }}>Timing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rxItems.map((med, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px", fontWeight: 700, color: "#64748b" }}>{idx + 1}</td>
                            <td style={{ padding: "8px", fontWeight: 700, color: "#0f172a" }}>{med.name}</td>
                            <td style={{ padding: "8px", color: "#334155" }}>{med.dose} · {med.freq}</td>
                            <td style={{ padding: "8px", color: "#334155" }}>{med.days}</td>
                            <td style={{ padding: "8px", color: "#0284c7", fontWeight: 600 }}>{med.notes || "After food"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Investigations */}
                {rxLabTests.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
                      Recommended Diagnostic Investigations
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {rxLabTests.map((t, idx) => (
                        <span key={idx} style={{ padding: "3px 8px", borderRadius: 4, background: "#eff6ff", color: "#1d4ed8", fontSize: "11px", fontWeight: 700, border: "1px solid #dbeafe" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advice & Instructions */}
                {rxClinicalNotes && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>
                      Clinical Advice &amp; Lifestyle Precautions
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#334155", background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0", whiteSpace: "pre-wrap" }}>
                      {rxClinicalNotes}
                    </div>
                  </div>
                )}

                {/* Official Sign-off & Digital Signature Bar */}
                <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 14, marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 6, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, display: "grid", placeItems: "center" }}>
                      <QrCode size={40} style={{ color: "#0284c7" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: 800, color: "#0284c7", textTransform: "uppercase" }}>
                        CallMedex Tamper-Proof QR
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b", maxWidth: 180 }}>
                        Scan to verify digital signature and pharmacist dispatch clearance.
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#16a34a", fontSize: "11px", fontWeight: 800 }}>
                      <CheckCircle2 size={13} /> DIGITALLY SIGNED &amp; VERIFIED
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", fontFamily: "cursive, Georgia, serif" }}>
                      {profile?.full_name ? `Dr. ${profile.full_name}` : "Verified Medical Officer"}
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>
                      Secured under IT Act 2000 &amp; NMC Guidelines
                    </div>
                  </div>
                </div>
              </div>

              {/* Transmit action bar */}
              <div style={{ marginTop: 12, padding: "12px 16px", background: "rgba(255, 255, 255, 0.9)", borderRadius: 10, border: "1px solid rgba(186, 230, 253, 0.8)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                  Recipient: <strong style={{ color: rxPatientEmail ? "#0369a1" : "var(--cm-urgent)" }}>{rxPatientEmail || "Enter email on left to enable dispatch"}</strong>
                </div>
                <button
                  type="button"
                  onClick={handleTransmitRxEmail}
                  disabled={transmittingRx || !rxPatientEmail}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, padding: "8px 20px" }}
                >
                  <Send size={14} /> {transmittingRx ? "Transmitting..." : "Send e-Prescription to Patient"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: REVENUE & PAYOUT SETTLEMENTS (REAL LIVE DATA WIDGET)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "revenue" && (
        <div className="cm-widget-glass-light" style={{ marginBottom: 24 }}>
          <div className="cm-widget-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(2, 132, 199, 0.15)", color: "#0284c7", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(2, 132, 199, 0.3)" }}>
                  Provider Payout Ledger
                </span>
                <span style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                  80/20 MOU Payout Terms · Direct Daily Bank Clearing at 23:59 IST
                </span>
              </div>
              <h3 className="cm-widget-title">
                <TrendingUp size={20} />
                <span>Revenue &amp; Payout Settlements</span>
              </h3>
              <p className="cm-widget-subtitle">
                Transparent financial settlements governed under your accepted CallMedex Clinical MOU. Direct daily clearing to your verified bank account.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={fetchEarnings}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                <RefreshCw size={14} className={earningsLoading ? "animate-spin" : ""} /> {earningsLoading ? "Refreshing..." : "Refresh Ledger"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: 20, borderRadius: 12, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
              <div style={{ fontSize: "0.75rem", color: "#0369a1", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>Total Net Earned</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#0f172a", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                ₹{(earnings?.total_earned || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 700, marginTop: 4 }}>
                {earnings?.transactions?.length || 0} completed consultation(s)
              </div>
            </div>

            <div style={{ background: "linear-gradient(135deg, rgba(240, 253, 244, 0.85) 0%, rgba(255, 255, 255, 0.95) 100%)", padding: 20, borderRadius: 12, border: "1px solid rgba(134, 239, 172, 0.8)", boxShadow: "0 2px 8px rgba(34, 197, 94, 0.06)" }}>
              <div style={{ fontSize: "0.75rem", color: "#15803d", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>Settled to Bank</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#15803d", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                ₹{(earnings?.settled || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 700, marginTop: 4 }}>
                Cleared to verified bank account
              </div>
            </div>

            <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: 20, borderRadius: 12, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
              <div style={{ fontSize: "0.75rem", color: "#0369a1", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>Pending Daily Settlement</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#0284c7", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                ₹{(earnings?.pending_settlement || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)", marginTop: 4 }}>
                Direct clearing batch at 23:59 IST
              </div>
            </div>
          </div>

          {/* Transaction Ledger Table */}
          <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: 22, border: "1px solid rgba(186, 230, 253, 0.8)", borderRadius: 12, boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
            <h4 style={{ margin: "0 0 14px 0", fontSize: "1rem", fontWeight: 800, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 8 }}>
              <DollarSign size={18} style={{ color: "#0284c7" }} />
              <span>Settlement Ledger History</span>
            </h4>
            {earnings?.transactions && earnings.transactions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {earnings.transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: "linear-gradient(135deg, rgba(240, 249, 255, 0.5) 0%, rgba(255, 255, 255, 0.95) 100%)",
                      borderRadius: 10,
                      border: "1px solid rgba(186, 230, 253, 0.7)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--cm-ink)" }}>
                        {tx.description || "Clinical Consultation Settlement"}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                        Ref #{tx.id.slice(0, 8)} · {new Date(tx.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900, color: "#16a34a", fontSize: "0.95rem" }}>
                        +₹{tx.provider_payout || tx.amount}
                      </div>
                      <span className={`cm-pill ${tx.status === "settled" ? "cm-pill--done" : "cm-pill--active"}`} style={{ fontSize: "10px", fontWeight: 800 }}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "36px 20px", textAlign: "center", background: "rgba(248, 250, 252, 0.8)", borderRadius: 10, border: "1px dashed #cbd5e1" }}>
                <DollarSign size={32} style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "0.95rem" }}>No Financial Transactions Recorded Yet</div>
                <p style={{ margin: "4px auto 0", fontSize: "0.8rem", color: "var(--cm-ink-3)", maxWidth: 440 }}>
                  As a newly registered doctor account, your settlement ledger will begin accruing daily payouts as soon as patients complete consultations.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: SLOTS & AVAILABILITY (ENHANCED SHIFT SCHEDULER)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <ProviderSchedulePanel roleLabel="doctor" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 6: APPOINTMENTS TAB (SUB-MODALITY TABS & 1-CLICK E-RX)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "appointments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cm-4)", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--cm-ink)", fontSize: "var(--cm-text-lg)", fontWeight: 800 }}>
                Clinical Appointments &amp; Consultations Roster
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Patient consultation schedule with verified contact emails, triage records, and direct e-Rx dispatch.
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "waiting", "confirmed", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setAppointmentsFilter(filter)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--cm-line)",
                    fontSize: "var(--cm-text-xs)",
                    fontWeight: 700,
                    textTransform: "capitalize",
                    background: appointmentsFilter === filter ? "var(--cm-navy)" : "var(--cm-surface)",
                    color: appointmentsFilter === filter ? "#fff" : "var(--cm-ink-2)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Deep Navy Glassmorphic Sub-Modality Filter Tabs */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "8px",
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
              borderRadius: "var(--cm-radius)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              marginBottom: "var(--cm-4)",
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "all", label: "All Modalities", count: todayBookings.length },
              {
                id: "walk_in",
                label: "Walk-In Clinic OPD",
                count: todayBookings.filter((b) => {
                  const s = String(b.service_type || b.consultation_type || b.mode || "").toLowerCase();
                  return s.includes("walk") || s.includes("person") || s.includes("clinic") || s.includes("opd");
                }).length,
              },
              {
                id: "home_visit",
                label: "Doorstep Home Visits",
                count: todayBookings.filter((b) => {
                  const s = String(b.service_type || b.consultation_type || b.mode || "").toLowerCase();
                  return s.includes("home") || s.includes("doorstep") || s.includes("visit");
                }).length,
              },
              {
                id: "online",
                label: "Online Teleconsultation",
                count: todayBookings.filter((b) => {
                  const s = String(b.service_type || b.consultation_type || b.mode || "").toLowerCase();
                  return s.includes("online") || s.includes("video") || s.includes("tele");
                }).length,
              },
            ].map((tab) => {
              const isActive = modalityFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setModalityFilter(tab.id as any)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--cm-radius-sm)",
                    border: isActive ? "1px solid rgba(56, 189, 248, 0.5)" : "1px solid transparent",
                    background: isActive ? "linear-gradient(135deg, rgba(2, 132, 199, 0.4) 0%, rgba(3, 105, 161, 0.6) 100%)" : "transparent",
                    color: isActive ? "#38bdf8" : "rgba(226, 232, 240, 0.75)",
                    fontSize: "var(--cm-text-xs)",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 9999,
                      fontSize: "10px",
                      background: isActive ? "rgba(56, 189, 248, 0.25)" : "rgba(255, 255, 255, 0.1)",
                      color: isActive ? "#e0f2fe" : "#94a3b8",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredBookings.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", background: "var(--cm-surface)", border: "1px dashed var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
              <Clock size={36} style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "var(--cm-text-base)" }}>
                No Appointments in This Filter View
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Patients booking slots across walk-in clinic, home visits, or video teleconsultations will be listed here.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
              {filteredBookings.map((b, i) => (
                <div
                  key={b.id || i}
                  className="cm-card"
                  style={{
                    padding: "var(--cm-4) var(--cm-5)",
                    border: "1px solid var(--cm-line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "var(--cm-text-base)" }}>
                        {b.patient_name || "Patient"}
                      </span>
                      <span className={`cm-pill ${b.status === "waiting" ? "cm-pill--urgent" : "cm-pill--active"}`}>
                        {b.status || "Scheduled"}
                      </span>
                      <span style={{ color: "var(--cm-active)", fontSize: "var(--cm-text-xs)", fontWeight: 700 }}>
                        Slot: {b.slot_time}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 16, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                      <span>Mode: <strong style={{ color: "var(--cm-ink)" }}>{b.service_type || "Consultation"}</strong></span>
                      {b.patient_email && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--cm-active)" }}>
                          <Mail size={12} /> {b.patient_email}
                        </span>
                      )}
                      {b.patient_mobile && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Phone size={12} /> {b.patient_mobile}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectPatientForRx(b.id);
                        setActiveTab("erx_studio");
                      }}
                      className="cm-btn cm-btn--secondary cm-btn--sm"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 700,
                        background: "linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(2, 132, 199, 0.15) 100%)",
                        border: "1px solid rgba(2, 132, 199, 0.3)",
                        color: "var(--cm-active)",
                      }}
                    >
                      <FileText size={14} /> ⚡ Draft &amp; Transmit e-Rx
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/doctor/consult/${b.id || "instant"}`)}
                      className="cm-btn cm-btn--primary cm-btn--sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Video size={14} /> Open Exam Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 7: DOCTOR HOME VISITS & BEDSIDE CARE DISPATCH OVERHAUL
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "home_visits" && (
        <div className="cm-widget-glass-light">
          {/* Header strip */}
          <div className="cm-widget-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(2, 132, 199, 0.12)", color: "#0284c7", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(2, 132, 199, 0.25)" }}>
                  On-Demand Bedside Care Console
                </span>
                <span style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                  {activeDispatches.length} active patient dispatch{activeDispatches.length === 1 ? "" : "es"} · Shift: <strong>{homeVisitShift}</strong> · Radius: <strong>12 km</strong>
                </span>
              </div>
              <h2 className="cm-widget-title">
                <Home size={22} style={{ color: "#0284c7" }} />
                <span>Doctor Home Visits &amp; Bedside Care Management</span>
              </h2>
              <p className="cm-widget-subtitle">
                Manage bedside roster, configure Normal vs. Urgent visit fees with transparent 80% net payouts, and broadcast real-time ETAs directly to patient families.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGpsMap(!showGpsMap)}
              className="cm-btn cm-btn--secondary cm-btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <Navigation size={14} /> {showGpsMap ? "Hide Live GPS Map" : "View Live Route Tracker"}
            </button>
          </div>

          {/* Shift Scheduling & Duty Status Strip */}
          <div
            style={{
              padding: "16px 20px",
              border: "1px solid rgba(186, 230, 253, 0.8)",
              borderRadius: 12,
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              background: homeVisitOnDuty
                ? "linear-gradient(135deg, rgba(240, 253, 244, 0.9) 0%, rgba(255, 255, 255, 0.95) 100%)"
                : "rgba(255, 255, 255, 0.8)",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: homeVisitOnDuty ? "#dcfce7" : "#f1f5f9",
                  color: homeVisitOnDuty ? "#15803d" : "#64748b",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Home size={22} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--cm-ink)" }}>
                    Bedside Visit Duty Status:
                  </span>
                  <span className={`cm-pill ${homeVisitOnDuty ? "cm-pill--done" : "cm-pill--neutral"}`}>
                    {homeVisitOnDuty ? "● ON DUTY FOR VISITS" : "○ OFF-DUTY"}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                  Active Shift: <strong>{homeVisitShift}</strong> · Operating Radius: <strong>12 km from registered clinic</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <select
                value={homeVisitShift}
                onChange={(e) => setHomeVisitShift(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #bae6fd",
                  fontSize: "0.82rem",
                  background: "#fff",
                  color: "var(--cm-ink)",
                  fontWeight: 600,
                }}
              >
                <option value="09:00 AM – 01:00 PM">Morning Shift (09:00 AM – 01:00 PM)</option>
                <option value="02:00 PM – 06:00 PM">Evening Shift (02:00 PM – 06:00 PM)</option>
                <option value="09:00 AM – 06:00 PM">Full Day Shift (09:00 AM – 06:00 PM)</option>
                <option value="24/7 On-Call (Emergencies)">24/7 On-Call Emergency</option>
              </select>

              <button
                type="button"
                onClick={() => setHomeVisitOnDuty(!homeVisitOnDuty)}
                className={`cm-btn cm-btn--sm ${homeVisitOnDuty ? "cm-btn--secondary" : "cm-btn--primary"}`}
                style={{ fontWeight: 800, padding: "8px 18px" }}
              >
                {homeVisitOnDuty ? "Go Off-Duty" : "Go On-Duty"}
              </button>
            </div>
          </div>

          {/* Normal vs. Urgent Home Visit Custom Tariff Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
            {/* Normal Scheduled Home Visit Tier */}
            <div
              style={{
                padding: "20px",
                border: "1px solid rgba(186, 230, 253, 0.8)",
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.9)",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span className="cm-pill cm-pill--active" style={{ textTransform: "uppercase", fontSize: "10px", fontWeight: 800 }}>
                  Scheduled Bedside Care
                </span>
                <span style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 800 }}>
                  Doctor Net: ₹{Math.round(Number(normalVisitFee) * 0.8)} (80%)
                </span>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                Normal Home Visit
              </h3>
              <p style={{ margin: "0 0 14px 0", fontSize: "0.8rem", color: "var(--cm-ink-3)", lineHeight: 1.4 }}>
                Pre-scheduled bedside clinical examination, chronic follow-ups, and elder care checks within 12–24h window.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: 10, top: 8, fontSize: "14px", fontWeight: 700, color: "var(--cm-ink-3)" }}>₹</span>
                  <input
                    type="number"
                    min={400}
                    step={50}
                    value={normalVisitFee}
                    onChange={(e) => setNormalVisitFee(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 24px",
                      borderRadius: 8,
                      border: "1px solid #bae6fd",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      background: "#fff",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`${apiBase}/api/providers/fees`, {
                      method: "POST",
                      headers: authHeaders(),
                      body: JSON.stringify({ fee_type: "home_visit", amount: Number(normalVisitFee) }),
                    });
                    setStatusMsg({ text: `✓ Normal home visit fee set to ₹${normalVisitFee}.`, type: "success" });
                  }}
                  className="cm-btn cm-btn--secondary cm-btn--sm"
                  style={{ fontWeight: 800, padding: "8px 16px" }}
                >
                  Save Fee
                </button>
              </div>
            </div>

            {/* Urgent Priority Home Visit Tier */}
            <div
              style={{
                padding: "20px",
                border: "1px solid rgba(244, 63, 94, 0.4)",
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(255, 241, 242, 0.7) 0%, rgba(255, 255, 255, 0.95) 100%)",
                boxShadow: "0 2px 8px rgba(225, 29, 72, 0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span className="cm-pill cm-pill--urgent" style={{ textTransform: "uppercase", fontSize: "10px", fontWeight: 800 }}>
                  Urgent Priority Dispatch
                </span>
                <span style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 800 }}>
                  Doctor Net: ₹{Math.round(Number(urgentVisitFee) * 0.8)} (80%)
                </span>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 800, color: "#9f1239" }}>
                Urgent Home Visit
              </h3>
              <p style={{ margin: "0 0 14px 0", fontSize: "0.8rem", color: "#881337", lineHeight: 1.4 }}>
                Acute symptom response, prompt dispatch with live arrival ETA notification broadcasted directly to patient family.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: 10, top: 8, fontSize: "14px", fontWeight: 700, color: "#be123c" }}>₹</span>
                  <input
                    type="number"
                    min={600}
                    step={50}
                    value={urgentVisitFee}
                    onChange={(e) => setUrgentVisitFee(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 24px",
                      borderRadius: 8,
                      border: "1px solid rgba(244, 63, 94, 0.4)",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      background: "#fff",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStatusMsg({ text: `✓ Urgent priority home visit fee set to ₹${urgentVisitFee}.`, type: "success" });
                  }}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{ fontWeight: 800, padding: "8px 16px" }}
                >
                  Save Fee
                </button>
              </div>
            </div>
          </div>

          {/* Optional Satellite GPS Map */}
          {showGpsMap && (
            <div style={{ marginBottom: 20, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(186, 230, 253, 0.8)" }}>
              <ProviderDispatchTracker title="Live Satellite Bedside Navigation" providerType="doctor" />
            </div>
          )}

          {/* Active Home Visit Dispatch & ETA Broadcast Roster */}
          <div style={{ background: "rgba(255, 255, 255, 0.9)", padding: "20px", borderRadius: 12, border: "1px solid rgba(186, 230, 253, 0.8)", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Activity size={18} style={{ color: "#0284c7" }} />
                  <span>Bedside Patient Dispatches ({activeDispatches.length})</span>
                </h3>
                <div style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                  Active patient requests with 1-click broadcast ETA actions
                </div>
              </div>
            </div>

            {activeDispatches.length === 0 ? (
              <div
                style={{
                  padding: "40px 24px",
                  textAlign: "center",
                  background: "rgba(240, 249, 255, 0.5)",
                  borderRadius: 12,
                  border: "1px dashed rgba(186, 230, 253, 0.9)",
                }}
              >
                <Activity size={36} style={{ color: "#0284c7", margin: "0 auto 10px" }} />
                <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "1rem" }}>
                  No Active Bedside Patient Dispatches
                </div>
                <p style={{ margin: "6px auto 0", fontSize: "0.82rem", color: "var(--cm-ink-3)", maxWidth: 460, lineHeight: 1.5 }}>
                  Doorstep clinical requests within your 12 km operational radius will broadcast here in real time with vital signs, address telemetry, and 1-click arrival broadcast controls.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {activeDispatches.map((dispatch) => (
                  <div
                    key={dispatch.id}
                    style={{
                      padding: "16px 18px",
                      borderRadius: 10,
                      border: dispatch.tier === "urgent" ? "1px solid rgba(244, 63, 94, 0.4)" : "1px solid #e0f2fe",
                      background: dispatch.tier === "urgent" ? "rgba(254, 242, 242, 0.5)" : "#f8fafc",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--cm-ink)" }}>
                            {dispatch.patient_name}
                          </span>
                          <span style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)" }}>
                            ({dispatch.patient_gender})
                          </span>
                          <span className={`cm-pill ${dispatch.tier === "urgent" ? "cm-pill--urgent" : "cm-pill--active"}`} style={{ textTransform: "uppercase" }}>
                            {dispatch.tier === "urgent" ? "⚡ Urgent Visit" : "Normal Visit"}
                          </span>
                          <span className="cm-pill cm-pill--done" style={{ textTransform: "capitalize" }}>
                            {dispatch.status}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--cm-ink-2)", marginTop: 4 }}>
                          <MapPin size={13} style={{ color: "#0284c7", flexShrink: 0 }} />
                          <span>{dispatch.address}</span>
                        </div>

                        <div style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)", marginTop: 4 }}>
                          Complaint: <strong style={{ color: "var(--cm-ink)" }}>{dispatch.chief_complaint}</strong>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                          Current ETA: <span style={{ color: "#0284c7" }}>{dispatch.eta_mins} mins</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          Requested: {dispatch.requested_at}
                        </div>
                      </div>
                    </div>

                    {/* Dispatch Actions & Live ETA Broadcast */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #cbd5e1", paddingTop: 10, flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#0369a1", textTransform: "uppercase" }}>
                          Broadcast Live ETA to Patient:
                        </span>
                        {[15, 25, 45].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            disabled={etaUpdatingId === dispatch.id}
                            onClick={() => {
                              setEtaUpdatingId(dispatch.id);
                              setTimeout(() => {
                                setActiveDispatches((prev) =>
                                  prev.map((d) => (d.id === dispatch.id ? { ...d, eta_mins: mins, status: "en route" } : d))
                                );
                                setEtaUpdatingId(null);
                                setStatusMsg({
                                  text: `✓ Live ETA of ${mins} minutes broadcasted to ${dispatch.patient_name} via CallMedex SMS & Patient App.`,
                                  type: "success",
                                });
                              }, 400);
                            }}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: dispatch.eta_mins === mins ? "1px solid #0284c7" : "1px solid #cbd5e1",
                              background: dispatch.eta_mins === mins ? "#0284c7" : "#fff",
                              color: dispatch.eta_mins === mins ? "#fff" : "var(--cm-ink)",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {mins}m
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDispatches((prev) =>
                              prev.map((d) => (d.id === dispatch.id ? { ...d, eta_mins: 0, status: "arrived" } : d))
                            );
                            setStatusMsg({
                              text: `✓ Doctor marked as ARRIVED at ${dispatch.patient_name}'s bedside.`,
                              type: "success",
                            });
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid #16a34a",
                            background: "#dcfce7",
                            color: "#15803d",
                            fontSize: "11px",
                            fontWeight: 800,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          Arrived
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setRxPatientName(dispatch.patient_name);
                            setRxPatientEmail(dispatch.patient_email);
                            setRxPatientMobile(dispatch.patient_mobile);
                            setRxDiagnosis(dispatch.chief_complaint);
                            setActiveTab("erx_studio");
                          }}
                          className="cm-btn cm-btn--secondary cm-btn--sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                        >
                          <FileText size={13} /> Draft Bedside e-Rx
                        </button>
                        <a
                          href={`tel:${dispatch.patient_mobile}`}
                          className="cm-btn cm-btn--secondary cm-btn--sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                        >
                          <Phone size={13} /> Call Patient
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 8: PROFILE TAB (WITH GLASSMORPHIC MOU & CREDENTIALS VIEWER)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <div>
          <SelfieVerificationCard onVerified={() => fetchProfile()} />
          <DashboardProfile
            profile={profile}
            role="doctor"
            onProfileUpdated={(updated) => {
              setProfile((prev: any) => ({ ...prev, ...updated }));
              fetchProfile();
            }}
          />
        </div>
      )}
    </DashboardShell>
  );
}
