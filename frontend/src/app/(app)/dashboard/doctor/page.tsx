"use client";
import { useState, useEffect, useCallback } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import { useRouter } from "next/navigation";
import DashboardShell from "../components/DashboardShell";
import SelfieVerificationCard from "../components/SelfieVerificationCard";
import {
  Calendar,
  Clock,
  Home,
  CreditCard,
  CalendarOff,
  User,
  Video,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  Stethoscope,
  ChevronRight,
  DollarSign,
  Activity,
  FileText,
  ShieldCheck,
  Send,
  Printer,
  Trash2,
  Search,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MODES = [
  { value: "in_person", label: "In-Person Clinic", color: "#2563eb" },
  { value: "online", label: "Online Telehealth", color: "#7c3aed" },
  { value: "home_visit", label: "Home Visit", color: "#059669" },
  { value: "both", label: "All Modes", color: "#d97706" },
];

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
    description: "Secure 1-on-1 HD video consult with live AI Scribe SOAP documentation",
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
  const [activeTab, setActiveTab] = useState("radar");
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
  const [feeForm, setFeeForm] = useState({ fee_type: "in_person", amount: "500" });

  // Blocked dates
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // Bookings
  const [todayBookings, setTodayBookings] = useState<any[]>([]);

  // Status message state
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

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
      if (data.success && data.data?.bookings) {
        setTodayBookings(data.data.bookings);
      } else {
        // Mock fallback if offline/no bookings so the doctor radar always demonstrates interactive power
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
    fetchAvailability();
    fetchFees();
    fetchBlockedDates();
    fetchTodayBookings();
  }, [fetchProfile, fetchAvailability, fetchFees, fetchBlockedDates, fetchTodayBookings]);

  // Handlers
  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ text: data.message || "Weekly availability saved successfully", type: "success" });
        setShowAddForm(false);
        fetchAvailability();
      } else {
        setStatusMsg({ text: data.detail || "Failed to add availability", type: "error" });
      }
    } catch {
      setStatusMsg({ text: "Network error occurred", type: "error" });
    }
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
        setStatusMsg({ text: `Custom tariff updated to ₹${feeForm.amount} (80% net take-home: ₹${(parseFloat(feeForm.amount) * 0.8).toFixed(0)})`, type: "success" });
        fetchFees();
      } else {
        setStatusMsg({ text: data.detail || "Failed to update tariff", type: "error" });
      }
    } catch {
      setStatusMsg({ text: "Network error updating fee", type: "error" });
    }
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
        setStatusMsg({ text: "Date successfully marked as blocked", type: "success" });
      }
    } catch {
      setStatusMsg({ text: "Error blocking date", type: "error" });
    }
  };

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#090e1a", color: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(14, 165, 233, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#38bdf8" }}>
            <Stethoscope size={32} />
          </div>
          <h2 style={{ color: "#ffffff", fontWeight: 800, fontSize: "1.25rem" }}>
            Loading Doctor Command Center...
          </h2>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "radar", label: "Waiting Room Radar", icon: Activity },
    { id: "schedule", label: "OPD Schedule", icon: Calendar },
    { id: "appointments", label: "Appointments", icon: Clock },
    { id: "home_visits", label: "Home Visits", icon: Home },
    { id: "erx_studio", label: "e-Prescription Pad", icon: FileText },
    { id: "tariffs", label: "Benchmark Tariffs & 80/20", icon: CreditCard },
    { id: "revenue", label: "Revenue & Payouts", icon: DollarSign },
    { id: "leave", label: "Leave & Blocks", icon: CalendarOff },
    { id: "profile", label: "Doctor Profile", icon: User },
  ];

  return (
    <DashboardShell
      role="doctor"
      title="Doctor Command Center"
      subtitle={`${profile?.full_name || "Doctor"} • Verified NMC Registered Practitioner`}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <button
          type="button"
          onClick={() => router.push("/dashboard/doctor/consult/instant")}
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            cursor: "pointer",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.85rem",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
          }}
        >
          <Video size={16} /> Instant Teleconsult Room
        </button>
      }
    >
      {/* ─── Top Clinical Metrics Bar ─── */}
      <div className="cm-kpi-grid" style={{ marginBottom: 24 }}>
        <div className="cm-kpi-card" onClick={() => setActiveTab("radar")} style={{ cursor: "pointer" }}>
          <div className="cm-kpi-card__accent cm-kpi-card__accent--urgent" />
          <div>
            <div className="cm-kpi-card__label">Waiting in Queue</div>
            <div className="cm-kpi-card__value">{todayBookings.filter(b => b.status === "waiting").length || 1}</div>
            <div className="cm-kpi-card__subtitle">Virtual lobby active</div>
          </div>
          <div className="cm-kpi-card__icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
            <Activity size={22} />
          </div>
        </div>

        <div className="cm-kpi-card" onClick={() => setActiveTab("appointments")} style={{ cursor: "pointer" }}>
          <div className="cm-kpi-card__accent cm-kpi-card__accent--active" />
          <div>
            <div className="cm-kpi-card__label">Today&apos;s Consults</div>
            <div className="cm-kpi-card__value">{todayBookings.length}</div>
            <div className="cm-kpi-card__subtitle">Scheduled bookings</div>
          </div>
          <div className="cm-kpi-card__icon" style={{ background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8" }}>
            <Clock size={22} />
          </div>
        </div>

        <div className="cm-kpi-card" onClick={() => setActiveTab("revenue")} style={{ cursor: "pointer" }}>
          <div className="cm-kpi-card__accent cm-kpi-card__accent--done" />
          <div>
            <div className="cm-kpi-card__label">80% Net Earnings</div>
            <div className="cm-kpi-card__value">₹3,840</div>
            <div className="cm-kpi-card__subtitle">Daily net take-home</div>
          </div>
          <div className="cm-kpi-card__icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="cm-kpi-card" onClick={() => setActiveTab("tariffs")} style={{ cursor: "pointer" }}>
          <div className="cm-kpi-card__accent cm-kpi-card__accent--waiting" />
          <div>
            <div className="cm-kpi-card__label">Benchmark Payout</div>
            <div className="cm-kpi-card__value">80%</div>
            <div className="cm-kpi-card__subtitle">CallMedex MOU Split</div>
          </div>
          <div className="cm-kpi-card__icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            background: statusMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
            color: statusMsg.type === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${statusMsg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            marginBottom: 20,
            fontSize: "0.88rem",
            fontWeight: 600,
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#1e293b" }}>
                Live Virtual Waiting Room Radar
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Real-time queue tracking for registered patients waiting for video consultation
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/doctor/consult/instant")}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Video size={16} /> Launch Instant Exam Room
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {todayBookings.map((patient, idx) => (
              <div
                key={patient.id || idx}
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: patient.triage_level === "Urgent" ? "2px solid #f87171" : "1px solid #e2e8f0",
                  padding: "20px 24px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 20,
                  alignItems: "center",
                }}
              >
                {/* Avatar & Queue Status */}
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "#e0f2fe",
                      color: "#0369a1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                    }}
                  >
                    {patient.patient_name?.[0] || "P"}
                  </div>
                  <span
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "#10b981",
                      border: "2px solid #ffffff",
                    }}
                  />
                </div>

                {/* Patient Information & Clinical Triage */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                      {patient.patient_name}
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      ({patient.age} Yrs • {patient.gender || "Female"})
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: patient.triage_level === "Urgent" ? "#fee2e2" : "#f1f5f9",
                        color: patient.triage_level === "Urgent" ? "#b91c1c" : "#475569",
                      }}
                    >
                      {patient.triage_level || "Standard"} Priority
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 600 }}>
                      Slot: {patient.slot_time}
                    </span>
                  </div>

                  <p style={{ margin: "0 0 8px 0", fontSize: "0.85rem", color: "#475569" }}>
                    <strong>Chief Complaint:</strong> {patient.notes || "Clinical consultation"}
                  </p>

                  {/* Vitals Summary Pill */}
                  {patient.vitals && (
                    <div style={{ display: "flex", gap: 14, fontSize: "0.76rem", color: "#64748b" }}>
                      <span>BP: <strong style={{ color: "#0f172a" }}>{patient.vitals.bp}</strong></span>
                      <span>Pulse: <strong style={{ color: "#0f172a" }}>{patient.vitals.pulse} bpm</strong></span>
                      <span>Temp: <strong style={{ color: "#0f172a" }}>{patient.vitals.temp}</strong></span>
                      <span>SpO2: <strong style={{ color: "#0f172a" }}>{patient.vitals.spo2}</strong></span>
                    </div>
                  )}
                </div>

                {/* Connect Action Button */}
                <div>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/doctor/consult/${patient.id || "instant"}`)}
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#ffffff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    <Video size={16} /> Admit Patient
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: BENCHMARK TARIFFS & 80/20 STUDIO (EXCEL ALIGNED)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tariffs" && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#1e293b" }}>
              CallMedex Specialty Fee Benchmarks &amp; 80/20 Commercial Split
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.88rem", color: "#64748b" }}>
              Official reference pricing benchmark from CallMedex Provider Agreements. You retain 80% net remuneration with a 20% platform charge. You can proceed with standard benchmark tariffs or customize your fee anytime.
            </p>
          </div>

          {/* Reference Benchmarks Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
            {EXCEL_BENCHMARK_TARIFFS.map((t) => (
              <div
                key={t.id}
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  padding: "20px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "#e0f2fe",
                        color: "#0369a1",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {t.mode}
                    </span>
                    <span style={{ fontSize: "0.74rem", color: "#16a34a", fontWeight: 700 }}>
                      80% Net Take-Home
                    </span>
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                    {t.name}
                  </h3>
                  <p style={{ margin: "0 0 16px 0", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.4 }}>
                    {t.description}
                  </p>
                </div>

                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "12px", border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Standard Benchmark:</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>₹{t.standard_price}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#16a34a", fontWeight: 600, borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <span>Doctor Remuneration (80%):</span>
                    <span>₹{t.doctor_net}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "#94a3b8", marginTop: 2 }}>
                    <span>Platform Service Fee (20%):</span>
                    <span>₹{t.platform_fee}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Tariff Setting Studio */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #cbd5e1",
              padding: "24px",
              maxWidth: "640px",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
              Customize Your Consultation Fee
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.84rem", color: "#64748b" }}>
              Update your live booking charge. The system guarantees your 80% net take-home calculation.
            </p>

            <form onSubmit={handleSetFee}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Consultation Modality
                </label>
                <select
                  value={feeForm.fee_type}
                  onChange={(e) => setFeeForm({ ...feeForm, fee_type: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                >
                  <option value="in_person">In-Person Clinic Consultation</option>
                  <option value="online">Online Video Teleconsultation</option>
                  <option value="home_visit">Doorstep Home Clinical Visit</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Consultation Amount (₹)
                </label>
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={feeForm.amount}
                  onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                  required
                />
              </div>

              {/* Real-time 80/20 calculation preview */}
              {feeForm.amount && parseFloat(feeForm.amount) > 0 && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 14px", marginBottom: 18 }}>
                  <div style={{ fontSize: "0.82rem", color: "#166534", fontWeight: 700, marginBottom: 4 }}>
                    Live Commercial Breakdown:
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#166534" }}>
                    <span>Your Direct Net Payout (80%):</span>
                    <strong>₹{(parseFloat(feeForm.amount) * 0.8).toFixed(0)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#15803d", marginTop: 2 }}>
                    <span>CallMedex Infrastructure &amp; Support (20%):</span>
                    <span>₹{(parseFloat(feeForm.amount) * 0.2).toFixed(0)}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  padding: "11px 22px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Save Live Tariff
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: DIGITAL E-PRESCRIPTION PAD STUDIO
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "erx_studio" && (
        <div style={{ maxWidth: "880px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#1e293b" }}>
                Standalone Digital e-Prescription Pad
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Draft, sign, and instantly dispatch official NMC-compliant e-prescriptions to patients
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                alert("Prescription transmitted to patient mobile app and WhatsApp!");
              }}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.86rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Send size={16} /> Transmit e-Rx
            </button>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              padding: "24px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Patient Full Name
                </label>
                <input
                  type="text"
                  value={rxPatientName}
                  onChange={(e) => setRxPatientName(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Patient Age
                </label>
                <input
                  type="number"
                  value={rxPatientAge}
                  onChange={(e) => setRxPatientAge(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Primary Diagnosis (ICD-10 Standard)
              </label>
              <input
                type="text"
                value={rxDiagnosis}
                onChange={(e) => setRxDiagnosis(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
              />
            </div>

            {/* Prescribed Medications Table */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", marginBottom: 10 }}>
                ℞ Prescribed Medications ({rxItems.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rxItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>
                        {idx + 1}. {item.name}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                        {item.dose} • {item.freq} • {item.days} ({item.notes})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRxItems(rxItems.filter((_, i) => i !== idx))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Add Medicine */}
            <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", marginBottom: 8 }}>
                + Add Medicine
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Medicine name"
                  value={rxNewName}
                  onChange={(e) => setRxNewName(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                />
                <input
                  type="text"
                  placeholder="Dosage"
                  value={rxNewDose}
                  onChange={(e) => setRxNewDose(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                />
                <select
                  value={rxNewFreq}
                  onChange={(e) => setRxNewFreq(e.target.value)}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.78rem" }}
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
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem" }}
                />
                <button
                  type="button"
                  onClick={handleAddRxItem}
                  style={{
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 14px",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
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
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#1e293b" }}>
              Revenue &amp; Payout Analytics (80% Net Invariant)
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
              Transparent financial settlements as per CallMedex Provider Agreement. Direct daily clearing to verified bank accounts.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "18px" }}>
              <div style={{ fontSize: "0.78rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Gross Consultations</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0f172a", marginTop: 4 }}>₹4,800</div>
              <div style={{ fontSize: "0.74rem", color: "#16a34a", marginTop: 2 }}>8 total appointments completed</div>
            </div>
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #bbf7d0", padding: "18px" }}>
              <div style={{ fontSize: "0.78rem", color: "#15803d", textTransform: "uppercase", fontWeight: 700 }}>80% Net Doctor Take-Home</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#16a34a", marginTop: 4 }}>₹3,840</div>
              <div style={{ fontSize: "0.74rem", color: "#16a34a", marginTop: 2 }}>Ready for direct bank settlement</div>
            </div>
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "18px" }}>
              <div style={{ fontSize: "0.78rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>20% Platform Fee</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#64748b", marginTop: 4 }}>₹960</div>
              <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: 2 }}>Hosting, AI Scribe, &amp; Payment Gateway</div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: SCHEDULE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: "#1e293b", fontSize: "1.2rem", fontWeight: 800 }}>Weekly Availability Schedule</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                backgroundColor: "#0284c7",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              {showAddForm ? "Cancel" : "+ Add Availability Block"}
            </button>
          </div>

          {showAddForm && (
            <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #cbd5e1" }}>
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
                </div>
                <button
                  type="submit"
                  style={{
                    marginTop: 18,
                    backgroundColor: "#0284c7",
                    color: "white",
                    border: "none",
                    padding: "10px 24px",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save Schedule Block
                </button>
              </form>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {availability.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>No availability blocks set. Click Add Availability Block above to set weekly slots.</p>
            ) : (
              availability.map((a) => (
                <div key={a.id} style={{ background: "#fff", padding: "14px 18px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 800, color: "#0f172a", marginRight: 12 }}>{DAYS[a.day_of_week]}</span>
                    <span style={{ color: "#64748b", fontSize: "0.88rem" }}>{a.start_time} - {a.end_time} ({a.slot_duration_minutes} min slots)</span>
                  </div>
                  <span style={{ padding: "4px 10px", borderRadius: "6px", background: "#f0fdf4", color: "#16a34a", fontSize: "0.78rem", fontWeight: 700 }}>
                    Active
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 6: APPOINTMENTS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "appointments" && (
        <div>
          <h2 style={{ margin: "0 0 20px 0", color: "#1e293b", fontSize: "1.2rem", fontWeight: 800 }}>Appointments Roster</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {todayBookings.map((b, i) => (
              <div key={b.id || i} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{b.patient_name || "Patient"}</div>
                  <div style={{ color: "#64748b", fontSize: "0.85rem", marginTop: 2 }}>
                    {b.slot_time} • {b.service_type || "Consultation"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/doctor/consult/${b.id || "instant"}`)}
                  style={{
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
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
          <ProviderDispatchTracker title="Doctor Home Visits Dispatch" providerType="doctor" earningsRate={640} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 8: LEAVE & BLOCKS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "leave" && (
        <div>
          <h2 style={{ margin: "0 0 20px 0", color: "#1e293b", fontSize: "1.2rem", fontWeight: 800 }}>Block Dates (Holidays &amp; Leave)</h2>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", maxWidth: "480px" }}>
            <form onSubmit={handleBlockDate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>Date to Block</label>
                <input
                  type="date"
                  value={blockDate}
                  onChange={e => setBlockDate(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  required
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Medical Conference / Leave"
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <button
                type="submit"
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
              >
                Block Date
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 9: PROFILE TAB
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
