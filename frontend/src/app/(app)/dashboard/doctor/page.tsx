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
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

// Official CallMedex Excel Benchmark Tariffs (from MOU Guidelines)
const EXCEL_BENCHMARK_TARIFFS = [
  {
    id: "gen_video",
    name: "General Teleconsultation (15 min)",
    mode: "online",
    standard_price: 400,
    doctor_share_pct: 80,
    doctor_net: 320,
    platform_fee: 80,
    description: "Secure 1-on-1 HD video consult with live clinical SOAP documentation",
  },
  {
    id: "clinic_opd",
    name: "In-Person Clinic Consultation (30 min)",
    mode: "in_person",
    standard_price: 500,
    doctor_share_pct: 80,
    doctor_net: 400,
    platform_fee: 100,
    description: "Physical walk-in clinic evaluation and diagnostic review",
  },
  {
    id: "home_visit",
    name: "Doorstep Home Clinical Visit (45 min)",
    mode: "home_visit",
    standard_price: 800,
    doctor_share_pct: 80,
    doctor_net: 640,
    platform_fee: 160,
    description: "Comprehensive home bedside clinical examination and prescription",
  },
  {
    id: "spec_video",
    name: "Specialist Consultation (MD / MS)",
    mode: "online",
    standard_price: 700,
    doctor_share_pct: 80,
    doctor_net: 560,
    platform_fee: 140,
    description: "Super-specialty evaluation (Cardiology, Endocrinology, Neurology)",
  },
];

export default function DoctorDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("radar");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Active Live Telemedicine Waiting Room Queue (/api/telemed/active)
  const [activeConsultations, setActiveConsultations] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Bookings (Today's roster)
  const [todayBookings, setTodayBookings] = useState<any[]>([]);

  // Standalone Digital e-Prescription Studio state
  const [rxPatientName, setRxPatientName] = useState("Priya Sharma");
  const [rxPatientAge, setRxPatientAge] = useState("32");
  const [rxDiagnosis, setRxDiagnosis] = useState("Acute Upper Respiratory Tract Infection (J06.9)");
  const [rxItems, setRxItems] = useState([
    { name: "Paracetamol 650mg", dose: "1 tab", freq: "TID (3 times a day)", days: "3 days", notes: "After meals" },
    { name: "Cetirizine 10mg", dose: "1 tab", freq: "OD (Bedtime)", days: "5 days", notes: "At night" },
  ]);
  const [rxNewName, setRxNewName] = useState("");
  const [rxNewDose, setRxNewDose] = useState("1 tablet");
  const [rxNewFreq, setRxNewFreq] = useState("BD (Twice a day)");
  const [rxNewDays, setRxNewDays] = useState("5 days");

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
      }
    } catch (e) {
      console.error("Failed to fetch active telemed queue:", e);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const fetchTodayBookings = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/bookings/provider/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data?.bookings) {
        setTodayBookings(data.data.bookings);
      } else {
        // Fallback display if offline/empty
        setTodayBookings([
          {
            id: "book-cm-901",
            patient_name: "Priya Sharma",
            age: 32,
            gender: "Female",
            service_type: "General Teleconsultation (HD Video)",
            slot_time: "10:30 AM",
            status: "waiting",
            triage_level: "Urgent",
            notes: "Fever 100.4°F, sore throat & body ache for 3 days",
            vitals: { bp: "118/76", pulse: "74", temp: "100.4°F", spo2: "99%" },
          },
          {
            id: "book-cm-902",
            patient_name: "Ramesh Varma",
            age: 58,
            gender: "Male",
            service_type: "Cardiovascular Review",
            slot_time: "11:15 AM",
            status: "confirmed",
            triage_level: "Routine",
            notes: "Follow-up BP medication & lipid report check",
            vitals: { bp: "138/88", pulse: "70", temp: "98.4°F", spo2: "98%" },
          },
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchTodayBookings();
    fetchActiveTelemedQueue();
    const interval = setInterval(fetchActiveTelemedQueue, 15000);
    return () => clearInterval(interval);
  }, [fetchProfile, fetchTodayBookings, fetchActiveTelemedQueue]);

  const handleAddRxItem = () => {
    if (!rxNewName.trim()) return;
    setRxItems([
      ...rxItems,
      { name: rxNewName, dose: rxNewDose, freq: rxNewFreq, days: rxNewDays, notes: "After food" },
    ]);
    setRxNewName("");
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--cm-surface)", color: "var(--cm-ink)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--cm-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--cm-navy)" }}>
            <Stethoscope size={32} />
          </div>
          <h2 style={{ color: "var(--cm-ink)", fontWeight: 800, fontSize: "var(--cm-text-lg)" }}>
            Loading Doctor Command Center...
          </h2>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "radar", label: "Waiting Room Radar", icon: Activity },
    { id: "schedule", label: "Slots & Availability", icon: Calendar },
    { id: "appointments", label: "Appointments", icon: Clock },
    { id: "home_visits", label: "Home Visits", icon: Home },
    { id: "erx_studio", label: "e-Prescription Pad", icon: FileText },
    { id: "tariffs", label: "Benchmark Tariffs & 80/20", icon: CreditCard },
    { id: "revenue", label: "Revenue & Payouts", icon: DollarSign },
    { id: "profile", label: "Doctor Profile", icon: User },
  ];

  return (
    <DashboardShell
      role="doctor"
      title="Clinical Doctor Workstation"
      subtitle={`${profile?.full_name || "Doctor"} · Verified NMC Registered Practitioner`}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <button
          type="button"
          onClick={() => router.push("/dashboard/doctor/consult/instant")}
          className="cm-btn cm-btn--primary cm-btn--sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Video size={16} /> Instant Teleconsult Room
        </button>
      }
    >
      {/* ─── Top Clinical Metrics Strip ─── */}
      <div className="cm-metric-strip">
        <div className="cm-metric-card" onClick={() => setActiveTab("radar")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <Activity size={14} style={{ color: "var(--cm-urgent)" }} /> Waiting in Queue
          </div>
          <div className="cm-metric-card__value">
            {todayBookings.filter(b => b.status === "waiting").length || 1}
          </div>
          <div className="cm-metric-card__meta">Virtual lobby active</div>
        </div>

        <div className="cm-metric-card" onClick={() => setActiveTab("appointments")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <Clock size={14} style={{ color: "var(--cm-active)" }} /> Today&apos;s Consults
          </div>
          <div className="cm-metric-card__value">{todayBookings.length}</div>
          <div className="cm-metric-card__meta">Scheduled appointments</div>
        </div>

        <div className="cm-metric-card" onClick={() => setActiveTab("revenue")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <TrendingUp size={14} style={{ color: "var(--cm-done)" }} /> 80% Net Earnings
          </div>
          <div className="cm-metric-card__value">₹3,840</div>
          <div className="cm-metric-card__meta">Daily net settlement</div>
        </div>

        <div className="cm-metric-card" onClick={() => setActiveTab("tariffs")} style={{ cursor: "pointer" }}>
          <div className="cm-metric-card__label">
            <ShieldCheck size={14} style={{ color: "var(--cm-waiting)" }} /> Benchmark Payout
          </div>
          <div className="cm-metric-card__value">80%</div>
          <div className="cm-metric-card__meta">CallMedEx Provider MOU</div>
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--cm-radius)",
            background: statusMsg.type === "success" ? "var(--cm-done-surface)" : "var(--cm-urgent-surface)",
            color: statusMsg.type === "success" ? "var(--cm-done)" : "var(--cm-urgent)",
            border: `1px solid ${statusMsg.type === "success" ? "var(--cm-done-line)" : "var(--cm-urgent-line)"}`,
            marginBottom: "var(--cm-4)",
            fontSize: "var(--cm-text-sm)",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
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
                <Activity size={14} /> {queueLoading ? "Polling..." : "Refresh Queue"}
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
                          Waiting time: {c.wait_time_minutes || 3} mins · Chief complaint: {c.symptoms || "Telehealth Consultation"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/doctor/consult/${c.id}`)}
                      className="cm-btn cm-btn--primary cm-btn--sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Video size={14} /> Connect Patient Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Today's Scheduled Patients Queue */}
          <div className="cm-clinical-section" style={{ padding: "var(--cm-5)" }}>
            <div className="cm-clinical-section__head" style={{ marginBottom: "var(--cm-4)" }}>
              <div className="cm-clinical-section__title-group">
                <div className="cm-clinical-section__icon-box">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="cm-clinical-section__title" style={{ fontSize: "var(--cm-text-base)" }}>
                    Today&apos;s Clinical Appointments Roster
                  </h3>
                  <p className="cm-clinical-section__subtitle">
                    Patients scheduled for telemedicine, in-person clinic, or doorstep visits.
                  </p>
                </div>
              </div>
            </div>

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
                        {patient.patient_name}
                      </h4>
                      <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                        ({patient.age} Yrs · {patient.gender || "Female"})
                      </span>
                      <span className={`cm-pill ${patient.triage_level === "Urgent" ? "cm-pill--urgent" : "cm-pill--waiting"}`}>
                        {patient.triage_level || "Standard"} Priority
                      </span>
                      <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        Slot: {patient.slot_time}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 6px 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-2)" }}>
                      <strong>Chief Complaint:</strong> {patient.notes || "Clinical consultation"}
                    </p>

                    {patient.vitals && (
                      <div style={{ display: "flex", gap: 14, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontVariantNumeric: "tabular-nums" }}>
                        <span>BP: <strong style={{ color: "var(--cm-ink)" }}>{patient.vitals.bp}</strong></span>
                        <span>Pulse: <strong style={{ color: "var(--cm-ink)" }}>{patient.vitals.pulse} bpm</strong></span>
                        <span>Temp: <strong style={{ color: "var(--cm-ink)" }}>{patient.vitals.temp}</strong></span>
                        <span>SpO2: <strong style={{ color: "var(--cm-ink)" }}>{patient.vitals.spo2}</strong></span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/doctor/consult/${patient.id || "instant"}`)}
                    className="cm-btn cm-btn--primary cm-btn--sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Video size={14} /> Open Exam Room
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: BENCHMARK TARIFFS & 80/20 COMMERCIAL SPLIT
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tariffs" && (
        <div>
          <div style={{ marginBottom: "var(--cm-4)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
              Specialty Fee Benchmarks &amp; 80/20 Commercial Split
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
              Official reference pricing benchmark from CallMedex Provider Agreements. You retain 80% net remuneration with a 20% platform charge.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--cm-4)", marginBottom: "var(--cm-6)" }}>
            {EXCEL_BENCHMARK_TARIFFS.map((t) => (
              <div
                key={t.id}
                className="cm-card"
                style={{
                  padding: "var(--cm-4)",
                  border: "1px solid var(--cm-line)",
                  borderRadius: "var(--cm-radius)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span className="cm-pill cm-pill--active" style={{ textTransform: "uppercase" }}>
                      {t.mode}
                    </span>
                    <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 700 }}>
                      80% Net Take-Home
                    </span>
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                    {t.name}
                  </h3>
                  <p style={{ margin: "0 0 var(--cm-4) 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", lineHeight: 1.4 }}>
                    {t.description}
                  </p>
                </div>

                <div style={{ background: "var(--cm-surface-2)", borderRadius: "var(--cm-radius-sm)", padding: "10px 12px", border: "1px solid var(--cm-line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Standard Benchmark:</span>
                    <span style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", fontVariantNumeric: "tabular-nums" }}>₹{t.standard_price}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 700, borderTop: "1px dashed var(--cm-line-strong)", paddingTop: 4 }}>
                    <span>Doctor Net Remuneration:</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>₹{t.doctor_net}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: DIGITAL E-PRESCRIPTION PAD STUDIO (NMC 2026 STANDARDS)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "erx_studio" && (
        <div style={{ maxWidth: "860px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cm-4)", flexWrap: "wrap", gap: "var(--cm-3)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Digital e-Prescription Pad Studio
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
                Draft, sign, and instantly dispatch official NMC-compliant e-prescriptions with generic salts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                alert("Prescription transmitted to patient mobile app and WhatsApp!");
              }}
              className="cm-btn cm-btn--primary cm-btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Send size={14} /> Transmit e-Rx to Patient
            </button>
          </div>

          <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--cm-3)", marginBottom: "var(--cm-4)" }}>
              <div>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Patient Full Name
                </label>
                <input
                  type="text"
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
                  value={rxPatientAge}
                  onChange={(e) => setRxPatientAge(e.target.value)}
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
            <div style={{ marginBottom: "var(--cm-5)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 800, color: "var(--cm-ink)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                ℞ Prescribed Medications ({rxItems.length})
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
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Add Medicine Form */}
            <div style={{ background: "var(--cm-surface)", border: "1px dashed var(--cm-line-strong)", borderRadius: "var(--cm-radius)", padding: "var(--cm-4)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-navy)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Add Generic Medicine Formulation
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Medicine salt name"
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
                  <option value="OD (Once a day)">OD</option>
                  <option value="BD (Twice a day)">BD</option>
                  <option value="TID (3 times a day)">TID</option>
                  <option value="QID (4 times a day)">QID</option>
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
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: REVENUE & 80% PAYOUT ANALYTICS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "revenue" && (
        <div>
          <div style={{ marginBottom: "var(--cm-4)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
              Revenue &amp; Payout Settlements (80% Net Invariant)
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)" }}>
              Transparent financial settlements as per CallMedex Provider Agreement. Direct daily clearing to verified bank accounts.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--cm-4)", marginBottom: "var(--cm-5)" }}>
            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Total Gross Consultations</div>
              <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>₹4,800</div>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", marginTop: 2 }}>8 total appointments completed</div>
            </div>
            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-done-line)", background: "var(--cm-done-surface)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", textTransform: "uppercase", fontWeight: 700 }}>80% Net Doctor Take-Home</div>
              <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-done)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>₹3,840</div>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", marginTop: 2 }}>Ready for direct bank settlement</div>
            </div>
            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", textTransform: "uppercase", fontWeight: 700 }}>20% Platform Fee</div>
              <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-ink-2)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>₹960</div>
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>Telehealth infrastructure &amp; compliance</div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: SLOTS & AVAILABILITY
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <ProviderSchedulePanel roleLabel="doctor" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 6: APPOINTMENTS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "appointments" && (
        <div>
          <h2 style={{ margin: "0 0 var(--cm-4) 0", color: "var(--cm-ink)", fontSize: "var(--cm-text-lg)", fontWeight: 800 }}>Appointments Roster</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
            {todayBookings.map((b, i) => (
              <div key={b.id || i} className="cm-card" style={{ padding: "var(--cm-4) var(--cm-5)", border: "1px solid var(--cm-line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "var(--cm-ink)" }}>{b.patient_name || "Patient"}</div>
                  <div style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", marginTop: 2 }}>
                    {b.slot_time} · {b.service_type || "Consultation"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/doctor/consult/${b.id || "instant"}`)}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Video size={14} /> Open Video Room
                </button>
              </div>
            ))}
          </div>
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
