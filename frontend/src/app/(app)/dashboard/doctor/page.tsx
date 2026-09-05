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
  const [activeDispatches, setActiveDispatches] = useState<any[]>([
    {
      id: "hv-001",
      patient_name: "Mrs. Saraswathi Rao",
      patient_gender: "Female, 71y",
      patient_mobile: "+91 94401 23456",
      patient_email: "saraswathi.rao@example.com",
      address: "Plot 42, Sector 5, MVP Colony, Visakhapatnam",
      tier: "urgent",
      chief_complaint: "Acute hypertension spike & dizziness, post-CABG review",
      status: "dispatched",
      eta_mins: 25,
      requested_at: "Today, 10:15 AM",
    },
    {
      id: "hv-002",
      patient_name: "Ramesh Kumar Verma",
      patient_gender: "Male, 58y",
      patient_mobile: "+91 98480 87654",
      patient_email: "ramesh.verma@example.com",
      address: "Flat 302, Sai Residency, Lawsons Bay Colony, Visakhapatnam",
      tier: "normal",
      chief_complaint: "Routine monthly geriatric clinical evaluation & vitals check",
      status: "confirmed",
      eta_mins: 60,
      requested_at: "Today, 02:30 PM",
    },
  ]);
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
  const [rxDiagnosis, setRxDiagnosis] = useState("Acute Upper Respiratory Tract Infection (J06.9)");
  const [rxClinicalNotes, setRxClinicalNotes] = useState("Ensure adequate hydration, warm saline gargles, and light diet. Review if fever persists past 3 days.");
  const [rxItems, setRxItems] = useState<any[]>([
    { name: "Paracetamol 650mg", dose: "1 tab", freq: "TID (3 times a day)", days: "3 days", notes: "After meals" },
    { name: "Cetirizine 10mg", dose: "1 tab", freq: "OD (Bedtime)", days: "5 days", notes: "At night" },
  ]);
  const [rxLabTests, setRxLabTests] = useState<string[]>(["Complete Blood Count (CBC)", "C-Reactive Protein (CRP)"]);
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
      title={profile?.full_name ? `Dr. ${profile.full_name} — Workstation Dashboard` : "Clinical Doctor Workstation"}
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
            <ShieldCheck size={14} style={{ color: isVerified ? "var(--cm-done)" : "#f59e0b" }} /> Clinical Status
          </div>
          <div className="cm-metric-card__value" style={{ color: isVerified ? "var(--cm-done)" : "#d97706" }}>
            {isVerified ? "Active" : "Pending"}
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
          TAB 1: LIVE PATIENT WAITING ROOM RADAR
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "radar" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cm-4)", flexWrap: "wrap", gap: "var(--cm-3)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Virtual Teleconsultation Waiting Room Radar
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
                Real-time queue tracking for registered patients waiting in your teleconsultation lobby.
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--cm-2)" }}>
              <button
                type="button"
                onClick={fetchActiveTelemedQueue}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <RefreshCw size={14} className={queueLoading ? "animate-spin" : ""} /> {queueLoading ? "Polling..." : "Refresh Queue"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard/doctor/consult/instant")}
                className="cm-btn cm-btn--primary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Video size={14} /> Launch Instant Exam Room
              </button>
            </div>
          </div>

          {/* Active Waiting Room Grid */}
          {activeConsultations.length > 0 ? (
            <div style={{ marginBottom: "var(--cm-5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--cm-3)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cm-urgent)" }} />
                <h3 style={{ margin: 0, fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                  Patients In Waiting Room Now ({activeConsultations.length})
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
                {activeConsultations.map((c) => (
                  <div
                    key={c.id}
                    className="cm-card"
                    style={{
                      border: "1px solid var(--cm-line)",
                      borderLeft: "4px solid var(--cm-active)",
                      padding: "var(--cm-4) var(--cm-5)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "var(--cm-3)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-4)" }}>
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: "var(--cm-radius)",
                          background: "var(--cm-surface-2)",
                          color: "var(--cm-navy)",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 800,
                          fontSize: "var(--cm-text-base)",
                        }}
                      >
                        {c.patient_name?.[0] || "P"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h4 style={{ margin: 0, fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                            {c.patient_name || "Patient in Queue"}
                          </h4>
                          <span className="cm-pill cm-pill--active">
                            Lobby Active
                          </span>
                        </div>
                        <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          Waiting time: {c.elapsed_minutes || 2} mins · Chief complaint: {c.notes || "Telehealth Consultation"}
                        </div>
                        {c.patient_email && (
                          <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
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
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <Video size={14} /> Connect Patient Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: "32px 20px", textAlign: "center", background: "var(--cm-surface)", border: "1px dashed var(--cm-line)", borderRadius: "var(--cm-radius)", marginBottom: 24 }}>
              <Activity size={36} style={{ color: "var(--cm-ink-3)", margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "var(--cm-text-base)" }}>Virtual Waiting Room is Empty</div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
                Patients booking online teleconsultations will appear live on this radar as soon as they enter your virtual clinic.
              </p>
            </div>
          )}

          {/* Today's Scheduled Patients Queue */}
          <div className="cm-clinical-section" style={{ padding: "var(--cm-5)" }}>
            <div className="cm-clinical-section__head" style={{ marginBottom: "var(--cm-4)" }}>
              <div className="cm-clinical-section__title-group">
                <div className="cm-clinical-section__icon-box">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="cm-clinical-section__title" style={{ fontSize: "var(--cm-text-base)" }}>
                    Today&apos;s Clinical Appointments Roster ({todayBookings.length})
                  </h3>
                  <p className="cm-clinical-section__subtitle">
                    Patients scheduled for telemedicine, in-person clinic, or doorstep visits.
                  </p>
                </div>
              </div>
            </div>

            {todayBookings.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", background: "var(--cm-surface-2)", borderRadius: "var(--cm-radius)" }}>
                <Clock size={32} style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 700, color: "var(--cm-ink)" }}>No Scheduled Consultations for Today</div>
                <p style={{ margin: "4px 0 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                  Your schedule is published and open. New bookings will automatically populate here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
                {todayBookings.map((patient) => (
                  <div
                    key={patient.id}
                    className="cm-card"
                    style={{
                      padding: "var(--cm-4) var(--cm-5)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "var(--cm-3)",
                      border: "1px solid var(--cm-line)",
                      borderRadius: "var(--cm-radius)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <h4 style={{ margin: 0, fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                          {patient.patient_name || "Patient"}
                        </h4>
                        <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                          ({patient.patient_gender || "Patient"})
                        </span>
                        <span className={`cm-pill ${patient.status === "waiting" ? "cm-pill--urgent" : "cm-pill--active"}`}>
                          {patient.status || "Scheduled"}
                        </span>
                        <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", fontWeight: 700 }}>
                          Slot: {patient.slot_time || "Today"}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 16, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 4 }}>
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
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <FileText size={14} /> Draft e-Rx
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/doctor/consult/${patient.id}`)}
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: CONSULTATION TARIFFS & CUSTOM PRACTICE FEES
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tariffs" && (
        <div style={{ maxWidth: 1000 }}>
          <div style={{ marginBottom: "var(--cm-4)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
              Practice Consultation Tariffs
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
              Manage your customized clinical consultation fees. Configured tariffs reflect live across your patient appointment booking slots.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "var(--cm-5)", alignItems: "start" }}>
            {/* Active Configured Practice Tariffs Card */}
            <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                    Current Active Practice Tariffs
                  </h3>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                    Live rates charged to patients at checkout
                  </div>
                </div>
                <span className="cm-pill cm-pill--active" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
                        background: "var(--cm-surface-2)",
                        border: "1px solid var(--cm-line)",
                        borderRadius: "var(--cm-radius-sm)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          {item.desc}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--cm-done)", fontWeight: 700, marginTop: 4 }}>
                          Doctor Net Payout (80%): ₹{doctorNet}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", marginLeft: 16 }}>
                        <div style={{ fontSize: "var(--cm-text-xl)", fontWeight: 900, color: "var(--cm-ink)", fontVariantNumeric: "tabular-nums" }}>
                          ₹{activeAmount}
                        </div>
                        <span style={{ fontSize: "11px", color: feeObj ? "var(--cm-active)" : "var(--cm-ink-3)", fontWeight: 700 }}>
                          {feeObj ? "Customized" : "Default"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(2, 132, 199, 0.05)", border: "1px solid rgba(2, 132, 199, 0.15)", fontSize: "12px", color: "var(--cm-ink-2)" }}>
                💡 <strong>Autonomy Note:</strong> Tariff adjustments take effect immediately for upcoming patient bookings. You retain 80% with daily bank settlement.
              </div>
            </div>

            {/* Customize Practice Fee Form */}
            <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                ✏️ Customize Practice Fee
              </h3>
              <p style={{ margin: "0 0 16px 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Update your consultation fee for any modality.
              </p>

              <form onSubmit={handleSaveCustomFee} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 6 }}>
                    Consultation Modality
                  </label>
                  <select
                    value={feeForm.fee_type}
                    onChange={(e) => setFeeForm({ ...feeForm, fee_type: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)", background: "var(--cm-surface)", color: "var(--cm-ink)" }}
                  >
                    <option value="in_person">Walk-in Clinic Consultation</option>
                    <option value="online">Online HD Teleconsultation</option>
                    <option value="home_visit">Doorstep Home Clinical Visit</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 6 }}>
                    New Practice Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    placeholder="e.g. 600"
                    value={feeForm.amount}
                    onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)", background: "var(--cm-surface)", color: "var(--cm-ink)" }}
                  />
                  {feeForm.amount && Number(feeForm.amount) > 0 && (
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 700, marginTop: 6 }}>
                      Estimated Net Payout (80%): ₹{Math.round(Number(feeForm.amount) * 0.8)}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={feeSaving}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{ marginTop: 6, fontWeight: 700, padding: "10px 16px" }}
                >
                  {feeSaving ? "Saving Fee..." : "Update Practice Tariff"}
                </button>
              </form>

              <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--cm-line)", fontSize: "11px", color: "var(--cm-ink-3)", lineHeight: 1.5 }}>
                ⚖️ <strong>MOU Terms:</strong> All fee payouts are governed under your accepted CallMedex Provider MOU. View your complete legal agreement anytime in the <strong>Doctor Profile</strong> tab.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: DIGITAL E-PRESCRIPTION PAD STUDIO (MANDATORY PATIENT EMAIL)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "erx_studio" && (
        <div style={{ maxWidth: "900px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cm-4)", flexWrap: "wrap", gap: "var(--cm-3)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Digital e-Prescription Pad Studio
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
                Draft, sign, and instantly dispatch official NMC-compliant e-prescriptions directly to patient email.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTransmitRxEmail}
              disabled={transmittingRx}
              className="cm-btn cm-btn--primary cm-btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <Send size={14} /> {transmittingRx ? "Transmitting e-Rx..." : "Transmit e-Rx to Patient Email"}
            </button>
          </div>

          <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)", marginBottom: 20 }}>
            {/* Quick Patient Selector */}
            {allActivePatients.length > 0 && (
              <div style={{ marginBottom: "var(--cm-4)", background: "var(--cm-surface-2)", padding: "10px 14px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line)" }}>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 800, color: "var(--cm-navy)", textTransform: "uppercase", marginBottom: 4 }}>
                  Auto-Fill From Active Patients
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => handleSelectPatientForRx(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)" }}
                >
                  <option value="custom">— Manual Entry / New Patient —</option>
                  {allActivePatients.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Patient Demographics & MANDATORY Patient Email */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "var(--cm-3)", marginBottom: "var(--cm-3)" }}>
              <div>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={rxPatientName}
                  onChange={(e) => setRxPatientName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Patient Age
                </label>
                <input
                  type="number"
                  placeholder="Age"
                  value={rxPatientAge}
                  onChange={(e) => setRxPatientAge(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Gender
                </label>
                <select
                  value={rxPatientGender}
                  onChange={(e) => setRxPatientGender(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)" }}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Patient Contact & Mandatory Email Field */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: "var(--cm-3)", marginBottom: "var(--cm-4)" }}>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--cm-text-xs)", fontWeight: 800, color: "var(--cm-urgent)", marginBottom: 4 }}>
                  <Mail size={13} /> Patient Email Address (MANDATORY for e-Rx Transmission) *
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
                    borderRadius: "var(--cm-radius-sm)",
                    border: rxPatientEmail ? "1px solid var(--cm-active)" : "1px solid var(--cm-urgent-line)",
                    background: rxPatientEmail ? "#f0f9ff" : "#fff",
                    fontSize: "var(--cm-text-sm)",
                    fontWeight: 600,
                  }}
                />
                <div style={{ fontSize: "11px", color: "var(--cm-ink-3)", marginTop: 3 }}>
                  ✉️ The patient will receive the official signed digital e-prescription at this email address.
                </div>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  <Phone size={13} /> Patient Mobile (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={rxPatientMobile}
                  onChange={(e) => setRxPatientMobile(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "var(--cm-4)" }}>
              <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                Primary Clinical Diagnosis (ICD-10 Standard)
              </label>
              <input
                type="text"
                value={rxDiagnosis}
                onChange={(e) => setRxDiagnosis(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)" }}
              />
            </div>

            {/* Prescribed Medications Table */}
            <div style={{ marginBottom: "var(--cm-4)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 800, color: "var(--cm-ink)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                ℞ Prescribed Generic Medications ({rxItems.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-2)" }}>
                {rxItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--cm-surface-2)",
                      border: "1px solid var(--cm-line)",
                      borderRadius: "var(--cm-radius-sm)",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                        {idx + 1}. {item.name}
                      </div>
                      <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                        {item.dose} · {item.freq} · {item.days} ({item.notes})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRxItems(rxItems.filter((_, i) => i !== idx))}
                      style={{ background: "none", border: "none", color: "var(--cm-urgent)", cursor: "pointer", padding: 4 }}
                      title="Remove medication"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Add Medicine Form */}
            <div style={{ background: "var(--cm-surface)", border: "1px dashed var(--cm-line-strong)", borderRadius: "var(--cm-radius)", padding: "var(--cm-4)", marginBottom: 16 }}>
              <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-navy)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                + Add Generic Formulation
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Salt name (e.g. Amoxicillin 500mg)"
                  value={rxNewName}
                  onChange={(e) => setRxNewName(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-xs)" }}
                />
                <input
                  type="text"
                  placeholder="Dosage"
                  value={rxNewDose}
                  onChange={(e) => setRxNewDose(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-xs)" }}
                />
                <select
                  value={rxNewFreq}
                  onChange={(e) => setRxNewFreq(e.target.value)}
                  style={{ padding: "8px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-xs)" }}
                >
                  <option value="OD (Once daily)">OD</option>
                  <option value="BD (Twice daily)">BD</option>
                  <option value="TID (3 times daily)">TID</option>
                  <option value="QID (4 times daily)">QID</option>
                  <option value="SOS (As needed)">SOS</option>
                </select>
                <input
                  type="text"
                  placeholder="Duration"
                  value={rxNewDays}
                  onChange={(e) => setRxNewDays(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-xs)" }}
                />
                <button
                  type="button"
                  onClick={handleAddRxItem}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Diagnostic Lab Tests */}
            <div style={{ marginBottom: "var(--cm-4)" }}>
              <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                Diagnostic Lab Investigations (Optional)
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="e.g. Serum Creatinine, HbA1c, Lipid Profile"
                  value={newLabTest}
                  onChange={(e) => setNewLabTest(e.target.value)}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-xs)" }}
                />
                <button type="button" onClick={handleAddLabTest} className="cm-btn cm-btn--secondary cm-btn--sm">
                  Add Test
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {rxLabTests.map((t, idx) => (
                  <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: "11px", fontWeight: 600, border: "1px solid #bfdbfe" }}>
                    {t}
                    <button type="button" onClick={() => setRxLabTests(rxLabTests.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Clinical Notes & Advice */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                Doctor Advice &amp; Lifestyle Instructions
              </label>
              <textarea
                rows={3}
                value={rxClinicalNotes}
                onChange={(e) => setRxClinicalNotes(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-xs)" }}
              />
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--cm-line)", paddingTop: 14 }}>
              <div style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                Practitioner: <strong style={{ color: "var(--cm-ink)" }}>{profile?.full_name ? `Dr. ${profile.full_name}` : "Verified NMC Doctor"}</strong>
              </div>
              <button
                type="button"
                onClick={handleTransmitRxEmail}
                disabled={transmittingRx}
                className="cm-btn cm-btn--primary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                <Send size={14} /> {transmittingRx ? "Transmitting..." : "Transmit e-Rx to Patient Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: REVENUE & PAYOUT SETTLEMENTS (REAL LIVE DATA)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "revenue" && (
        <div>
          <div style={{ marginBottom: "var(--cm-4)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
              Revenue &amp; Payout Settlements
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
              Transparent financial settlements as per CallMedex Provider Agreement. Direct daily clearing to verified bank accounts.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--cm-4)", marginBottom: "var(--cm-5)" }}>
            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Total Net Earned</div>
              <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                ₹{(earnings?.total_earned || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", marginTop: 2 }}>
                {earnings?.transactions?.length || 0} completed consultation(s)
              </div>
            </div>

            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-done-line)", background: "var(--cm-done-surface)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", textTransform: "uppercase", fontWeight: 700 }}>Settled to Bank</div>
              <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-done)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                ₹{(earnings?.settled || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", marginTop: 2 }}>
                Cleared to verified bank account
              </div>
            </div>

            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Pending Daily Settlement</div>
              <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-active)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                ₹{(earnings?.pending_settlement || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                Direct clearing batch at 23:59 IST
              </div>
            </div>
          </div>

          {/* Transaction Ledger Table */}
          <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
              Settlement Ledger History
            </h3>
            {earnings?.transactions && earnings.transactions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {earnings.transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--cm-surface-2)",
                      borderRadius: 8,
                      border: "1px solid var(--cm-line)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                        {tx.description || "Clinical Consultation Settlement"}
                      </div>
                      <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                        Ref #{tx.id.slice(0, 8)} · {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: "var(--cm-done)", fontSize: "var(--cm-text-sm)" }}>
                        +₹{tx.provider_payout || tx.amount}
                      </div>
                      <span className={`cm-pill ${tx.status === "settled" ? "cm-pill--done" : "cm-pill--active"}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "32px 20px", textAlign: "center", background: "var(--cm-surface-2)", borderRadius: "var(--cm-radius)" }}>
                <DollarSign size={32} style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 700, color: "var(--cm-ink)" }}>No Financial Transactions Recorded Yet</div>
                <p style={{ margin: "4px 0 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
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
        <div style={{ maxWidth: 1050 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: "var(--cm-4)" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--cm-ink)", fontSize: "var(--cm-text-lg)", fontWeight: 800 }}>
                Doctor Home Visits &amp; Bedside Care Management
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Manage home visit shifts, set independent Normal vs. Urgent visit tariffs, and broadcast real-time ETAs to patients.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGpsMap(!showGpsMap)}
              className="cm-btn cm-btn--secondary cm-btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Navigation size={14} /> {showGpsMap ? "Hide Live GPS Map" : "View Live Route Tracker"}
            </button>
          </div>

          {/* Shift Scheduling & Duty Status Strip */}
          <div
            className="cm-card"
            style={{
              padding: "16px 20px",
              border: "1px solid var(--cm-line)",
              borderRadius: "var(--cm-radius)",
              marginBottom: "var(--cm-4)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              background: homeVisitOnDuty ? "linear-gradient(135deg, rgba(22, 163, 74, 0.06) 0%, rgba(2, 132, 199, 0.04) 100%)" : "var(--cm-surface-2)",
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
                  <span style={{ fontWeight: 800, fontSize: "var(--cm-text-base)", color: "var(--cm-ink)" }}>
                    Bedside Visit Duty Status:
                  </span>
                  <span className={`cm-pill ${homeVisitOnDuty ? "cm-pill--done" : "cm-pill--neutral"}`}>
                    {homeVisitOnDuty ? "● ON DUTY FOR VISITS" : "○ OFF-DUTY"}
                  </span>
                </div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                  Active Shift: <strong>{homeVisitShift}</strong> · Operating Radius: <strong>12 km from clinic</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <select
                value={homeVisitShift}
                onChange={(e) => setHomeVisitShift(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: "var(--cm-radius-sm)",
                  border: "1px solid var(--cm-line-strong)",
                  fontSize: "var(--cm-text-xs)",
                  background: "var(--cm-surface)",
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
                style={{ fontWeight: 700 }}
              >
                {homeVisitOnDuty ? "Go Off-Duty" : "Go On-Duty"}
              </button>
            </div>
          </div>

          {/* Normal vs. Urgent Home Visit Custom Tariff Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cm-4)", marginBottom: "var(--cm-5)" }}>
            {/* Normal Scheduled Home Visit Tier */}
            <div
              className="cm-card"
              style={{
                padding: "20px",
                border: "1px solid var(--cm-line)",
                borderRadius: "var(--cm-radius)",
                background: "var(--cm-surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span className="cm-pill cm-pill--active" style={{ textTransform: "uppercase", fontSize: "10px" }}>
                  Scheduled Bedside Care
                </span>
                <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 700 }}>
                  Doctor Net: ₹{Math.round(Number(normalVisitFee) * 0.8)} (80%)
                </span>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Normal Home Visit
              </h3>
              <p style={{ margin: "0 0 14px 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", lineHeight: 1.4 }}>
                Pre-scheduled bedside clinical examination, chronic follow-ups, and elder care checks within 12–24h slot.
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
                      borderRadius: "var(--cm-radius-sm)",
                      border: "1px solid var(--cm-line-strong)",
                      fontSize: "var(--cm-text-sm)",
                      fontWeight: 800,
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
                  style={{ fontWeight: 700 }}
                >
                  Save Fee
                </button>
              </div>
            </div>

            {/* Urgent Priority Home Visit Tier */}
            <div
              className="cm-card"
              style={{
                padding: "20px",
                border: "1px solid rgba(225, 29, 72, 0.3)",
                borderRadius: "var(--cm-radius)",
                background: "linear-gradient(135deg, rgba(225, 29, 72, 0.03) 0%, rgba(254, 242, 242, 0.5) 100%)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span className="cm-pill cm-pill--urgent" style={{ textTransform: "uppercase", fontSize: "10px" }}>
                  Urgent Priority Dispatch
                </span>
                <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 700 }}>
                  Doctor Net: ₹{Math.round(Number(urgentVisitFee) * 0.8)} (80%)
                </span>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Urgent Home Visit
              </h3>
              <p style={{ margin: "0 0 14px 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", lineHeight: 1.4 }}>
                Acute symptom response, prompt dispatch with live arrival ETA notification broadcasted directly to family.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: 10, top: 8, fontSize: "14px", fontWeight: 700, color: "var(--cm-ink-3)" }}>₹</span>
                  <input
                    type="number"
                    min={600}
                    step={50}
                    value={urgentVisitFee}
                    onChange={(e) => setUrgentVisitFee(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 24px",
                      borderRadius: "var(--cm-radius-sm)",
                      border: "1px solid var(--cm-line-strong)",
                      fontSize: "var(--cm-text-sm)",
                      fontWeight: 800,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStatusMsg({ text: `✓ Urgent priority home visit fee set to ₹${urgentVisitFee}.`, type: "success" });
                  }}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{ fontWeight: 700 }}
                >
                  Save Fee
                </button>
              </div>
            </div>
          </div>

          {/* Optional Satellite GPS Map */}
          {showGpsMap && (
            <div style={{ marginBottom: "var(--cm-5)", borderRadius: "var(--cm-radius)", overflow: "hidden", border: "1px solid var(--cm-line)" }}>
              <ProviderDispatchTracker title="Live Satellite Bedside Navigation" providerType="doctor" />
            </div>
          )}

          {/* Active Home Visit Dispatch & ETA Broadcast Roster */}
          <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                  Bedside Patient Dispatches ({activeDispatches.length})
                </h3>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                  Active patient requests with ETA broadcast actions
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {activeDispatches.map((dispatch) => (
                <div
                  key={dispatch.id}
                  style={{
                    padding: "16px 18px",
                    borderRadius: "var(--cm-radius)",
                    border: dispatch.tier === "urgent" ? "1px solid rgba(225, 29, 72, 0.4)" : "1px solid var(--cm-line)",
                    background: dispatch.tier === "urgent" ? "rgba(254, 242, 242, 0.4)" : "var(--cm-surface-2)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: "var(--cm-text-base)", color: "var(--cm-ink)" }}>
                          {dispatch.patient_name}
                        </span>
                        <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                          ({dispatch.patient_gender})
                        </span>
                        <span className={`cm-pill ${dispatch.tier === "urgent" ? "cm-pill--urgent" : "cm-pill--active"}`} style={{ textTransform: "uppercase" }}>
                          {dispatch.tier === "urgent" ? "⚡ Urgent Visit" : "Normal Visit"}
                        </span>
                        <span className="cm-pill cm-pill--done" style={{ textTransform: "capitalize" }}>
                          {dispatch.status}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", marginTop: 4 }}>
                        <MapPin size={13} style={{ color: "var(--cm-active)", flexShrink: 0 }} />
                        <span>{dispatch.address}</span>
                      </div>

                      <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 4 }}>
                        Complaint: <strong style={{ color: "var(--cm-ink)" }}>{dispatch.chief_complaint}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "var(--cm-text-sm)", fontWeight: 800, color: "var(--cm-ink)" }}>
                        Current ETA: <span style={{ color: "var(--cm-active)" }}>{dispatch.eta_mins} mins</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--cm-ink-3)", marginTop: 2 }}>
                        Requested: {dispatch.requested_at}
                      </div>
                    </div>
                  </div>

                  {/* Dispatch Actions & Live ETA Broadcast */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed var(--cm-line)", paddingTop: 10, flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--cm-ink-3)", textTransform: "uppercase" }}>
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
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: dispatch.eta_mins === mins ? "1px solid var(--cm-active)" : "1px solid var(--cm-line)",
                            background: dispatch.eta_mins === mins ? "var(--cm-active)" : "var(--cm-surface)",
                            color: dispatch.eta_mins === mins ? "#fff" : "var(--cm-ink)",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
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
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--cm-done)",
                          background: "var(--cm-done-surface)",
                          color: "var(--cm-done)",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
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
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <Phone size={13} /> Call Patient
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 8: PROFILE TAB (WITH GLASSMORPHIC MOU & CREDENTIALS VIEWER)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <div>
          <SelfieVerificationCard />
          <DashboardProfile profile={profile} role="doctor" />
        </div>
      )}
    </DashboardShell>
  );
}
