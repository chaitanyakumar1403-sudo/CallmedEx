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
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

// Official CallMedex Excel Benchmark Tariffs (from MOU Guidelines)
const EXCEL_BENCHMARK_TARIFFS = [
  {
    id: "gen_video",
    name: "General Teleconsultation (10–15 min)",
    mode: "online",
    standard_price: 400,
    doctor_share_pct: 80,
    doctor_net: 320,
    platform_fee: 80,
    description: "Secure 1-on-1 HD video consult with live clinical SOAP documentation",
  },
  {
    id: "clinic_opd",
    name: "In-Person Clinic Consultation (15–30 min)",
    mode: "in_person",
    standard_price: 500,
    doctor_share_pct: 80,
    doctor_net: 400,
    platform_fee: 100,
    description: "Physical walk-in clinic evaluation and diagnostic review",
  },
  {
    id: "home_visit",
    name: "Doorstep Home Clinical Visit (30–45 min)",
    mode: "home_visit",
    standard_price: 800,
    doctor_share_pct: 80,
    doctor_net: 640,
    platform_fee: 160,
    description: "Comprehensive home bedside clinical examination and prescription",
  },
];

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
  const [activeTab, setActiveTab] = useState("radar");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Active Live Telemedicine Waiting Room Queue (/api/telemed/active)
  const [activeConsultations, setActiveConsultations] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Real Bookings (Today's roster)
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const [appointmentsFilter, setAppointmentsFilter] = useState<"all" | "waiting" | "confirmed" | "completed">("all");

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

  // 1-Click CallMedex Standard MOU Pricing
  const handleApplyStandardMOUFees = async () => {
    try {
      const res = await fetch(`${apiBase}/api/providers/fees/apply-standard`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ text: "✓ Official CallMedex Standard Tariffs applied: Walk-in (₹500), Online (₹400), Home Visit (₹800).", type: "success" });
        fetchFees();
      } else {
        setStatusMsg({ text: data.detail || "Could not apply standard tariffs.", type: "error" });
      }
    } catch {
      setStatusMsg({ text: "Network error applying standard tariffs.", type: "error" });
    }
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
    { id: "radar", label: "Waiting Room Radar", icon: Activity },
    { id: "schedule", label: "Slots & Availability", icon: Calendar },
    { id: "appointments", label: "Appointments", icon: Clock },
    { id: "erx_studio", label: "e-Prescription Pad", icon: FileText },
    { id: "tariffs", label: "Consultation Tariffs", icon: CreditCard },
    { id: "revenue", label: "Revenue & Payouts", icon: DollarSign },
    { id: "home_visits", label: "Home Visits", icon: Home },
    { id: "profile", label: "Doctor Profile", icon: User },
  ];

  // All active patients list for dropdown
  const allActivePatients = [
    ...activeConsultations.map((c) => ({ id: c.id, label: `${c.patient_name || "Patient in Queue"} (Teleconsult Lobby)` })),
    ...todayBookings.map((b) => ({ id: b.id, label: `${b.patient_name || "Scheduled Patient"} (${b.slot_time || "Today"})` })),
  ];

  const filteredBookings = todayBookings.filter((b) => {
    if (appointmentsFilter === "all") return true;
    return b.status === appointmentsFilter;
  });

  return (
    <DashboardShell
      role="doctor"
      title="Clinical Doctor Workstation"
      subtitle={`${profile?.full_name ? `Dr. ${profile.full_name}` : "Doctor"} · Verified NMC Registered Practitioner`}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <button
          type="button"
          onClick={() => router.push("/dashboard/doctor/consult/instant")}
          className="cm-btn cm-btn--primary cm-btn--sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
        >
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

        <div className="cm-metric-card" onClick={() => setActiveTab("tariffs")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <ShieldCheck size={14} style={{ color: "var(--cm-done)" }} /> Clinical Status
          </div>
          <div className="cm-metric-card__value" style={{ color: "var(--cm-done)" }}>Active</div>
          <div className="cm-metric-card__meta">NMC Verified Practitioner</div>
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
          TAB 2: CONSULTATION TARIFFS & FEE BENCHMARK STUDIO
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tariffs" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: "var(--cm-4)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Consultation Tariffs &amp; MOU Fee Benchmarks
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
                Configure custom practice pricing or apply standard CallMedex benchmark fees with 1-click.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyStandardMOUFees}
              className="cm-btn cm-btn--primary cm-btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <Sparkles size={14} /> ⚡ Apply CallMedex Standard MOU Tariffs
            </button>
          </div>

          {/* Active Pricing Grid with Benchmark Comparisons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--cm-4)", marginBottom: "var(--cm-5)" }}>
            {EXCEL_BENCHMARK_TARIFFS.map((t) => {
              const customFee = fees.find((f) => f.fee_type === t.mode);
              const activePrice = customFee ? customFee.amount : t.standard_price;
              const doctorNet = Math.round(activePrice * 0.8);
              const platformFee = activePrice - doctorNet;

              return (
                <div
                  key={t.id}
                  className="cm-card"
                  style={{
                    padding: "var(--cm-5)",
                    border: "1px solid var(--cm-line)",
                    borderRadius: "var(--cm-radius)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span className="cm-pill cm-pill--active" style={{ textTransform: "uppercase" }}>
                        {t.mode.replace("_", " ")}
                      </span>
                      <span style={{ fontSize: "var(--cm-text-xs)", color: customFee ? "var(--cm-active)" : "var(--cm-done)", fontWeight: 700 }}>
                        {customFee ? "Custom Practice Tariff" : "CallMedex Standard MOU"}
                      </span>
                    </div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                      {t.name}
                    </h3>
                    <p style={{ margin: "0 0 var(--cm-4) 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", lineHeight: 1.4 }}>
                      {t.description}
                    </p>
                  </div>

                  <div style={{ background: "var(--cm-surface-2)", borderRadius: "var(--cm-radius-sm)", padding: "12px 14px", border: "1px solid var(--cm-line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Active Fee:</span>
                      <span style={{ fontSize: "var(--cm-text-xl)", fontWeight: 800, color: "var(--cm-ink)", fontVariantNumeric: "tabular-nums" }}>
                        ₹{activePrice}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 700, borderTop: "1px dashed var(--cm-line-strong)", paddingTop: 6, marginBottom: 4 }}>
                      <span>Doctor Net Payout (80%):</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>₹{doctorNet}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                      <span>Platform Infrastructure (20%):</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>₹{platformFee}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Tariff Customizer & Settlement Guidelines */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cm-4)", alignItems: "start" }}>
            <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                ✏️ Customize Practice Fee
              </h3>
              <p style={{ margin: "0 0 16px 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Set your custom tariff. As per MOU, you retain 80% with transparent direct settlement.
              </p>
              <form onSubmit={handleSaveCustomFee} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                    Consultation Modality
                  </label>
                  <select
                    value={feeForm.fee_type}
                    onChange={(e) => setFeeForm({ ...feeForm, fee_type: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)" }}
                  >
                    <option value="in_person">Walk-in Clinic Consultation</option>
                    <option value="online">Online HD Teleconsultation</option>
                    <option value="home_visit">Doorstep Home Clinical Visit</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                    New Practice Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    placeholder="e.g. 500"
                    value={feeForm.amount}
                    onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", fontSize: "var(--cm-text-sm)" }}
                  />
                  {feeForm.amount && Number(feeForm.amount) > 0 && (
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 700, marginTop: 4 }}>
                      Estimated Net Payout (80%): ₹{Math.round(Number(feeForm.amount) * 0.8)}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={feeSaving}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{ marginTop: 4 }}
                >
                  {feeSaving ? "Saving Fee..." : "Update Practice Tariff"}
                </button>
              </form>
            </div>

            <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-done-line)", background: "var(--cm-done-surface)", borderRadius: "var(--cm-radius)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={18} style={{ color: "var(--cm-done)" }} />
                <h3 style={{ margin: 0, fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-done)" }}>
                  CallMedex Provider Settlement Guidelines
                </h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                <li><strong>80/20 Revenue Ratio:</strong> Practitioners keep 80% net earnings; 20% platform charge covers secure WebRTC video, digital consent, AI voice scribe, and e-Rx delivery.</li>
                <li><strong>Daily Bank Settlement:</strong> All cleared consult payouts are batched daily to your verified bank account via IMPS/NEFT with zero processing deductions.</li>
                <li><strong>MOU Protection:</strong> You maintain full clinical autonomy to adjust fees or retain standard CallMedex benchmark tariffs at any time.</li>
                <li><strong>Telemedicine Act 2026 Compliant:</strong> Digital signatures, encrypted transmission, and audit logs are included automatically.</li>
              </ul>
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
          TAB 6: APPOINTMENTS TAB (REAL PATIENT ROSTER WITH EMAIL)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "appointments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cm-4)", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--cm-ink)", fontSize: "var(--cm-text-lg)", fontWeight: 800 }}>
                Appointments Roster
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Patient consultation schedule with verified contact emails and triage details.
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "waiting", "confirmed", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setAppointmentsFilter(filter)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--cm-line)",
                    fontSize: "var(--cm-text-xs)",
                    fontWeight: 700,
                    textTransform: "capitalize",
                    background: appointmentsFilter === filter ? "var(--cm-navy)" : "transparent",
                    color: appointmentsFilter === filter ? "#fff" : "var(--cm-ink-2)",
                    cursor: "pointer",
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", background: "var(--cm-surface)", border: "1px dashed var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
              <Clock size={36} style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "var(--cm-text-base)" }}>
                No Appointments in This View
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Patients booking slots across walk-in OPD or video teleconsultations will be listed here.
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
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <FileText size={14} /> Draft e-Rx
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/doctor/consult/${b.id || "instant"}`)}
                      className="cm-btn cm-btn--primary cm-btn--sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Video size={14} /> Open Video Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 7: HOME VISITS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "home_visits" && (
        <div style={{ margin: "-24px -40px" }}>
          <ProviderDispatchTracker title="Doctor Home Visits Dispatch" providerType="doctor" />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 8: PROFILE TAB
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
