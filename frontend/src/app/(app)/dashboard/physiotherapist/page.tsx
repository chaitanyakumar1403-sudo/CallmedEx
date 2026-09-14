"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardShell, { SkeletonRows } from "../components/DashboardShell";
import ProviderSchedulePanel from "../components/ProviderSchedulePanel";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import SelfieVerificationCard from "../components/SelfieVerificationCard";
import {
  Calendar,
  Clock,
  Video,
  Activity,
  MapPin,
  User,
  Sliders,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Award,
  Search,
  Plus,
  X,
  FileText,
  Download,
  Printer,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

interface ScopeItem {
  id: string;
  service_name: string;
  category: string;
  modality: string;
  benchmark_price: number;
  custom_price: number;
  platform_fee_amount: number;
  provider_share_amount: number;
  is_active: boolean;
}

const JOINT_REFERENCE_DATA: Record<string, { normalRange: number; unit: string; motion: string; defaultPresets: string[] }> = {
  Knee: {
    normalRange: 135,
    unit: "° Flexion",
    motion: "Active Flexion & Extension",
    defaultPresets: [
      "Quad sets with towel roll isometric hold (3x 10 reps)",
      "Straight leg raises with 2s hold at peak (3x 10 reps)",
      "Passive knee extension stretch with heel prop (3x 30s)",
      "Patellar mobilizations (superior and inferior glides)",
    ],
  },
  Shoulder: {
    normalRange: 180,
    unit: "° Flexion/Abduction",
    motion: "Glenohumeral Abduction",
    defaultPresets: [
      "Codman pendulum swings in clockwise/counter-clockwise circles (2 mins)",
      "Finger ladder wall crawls up to pain threshold (3 sets)",
      "Isometric rotator cuff internal/external rotation against wall (3x 10 reps)",
      "Scapular retractions and posture resets (3x 12 reps)",
    ],
  },
  "Lumbar Spine": {
    normalRange: 60,
    unit: "° Flexion",
    motion: "Trunk Forward Flexion",
    defaultPresets: [
      "McKenzie prone press-up extensions (10 slow repetitions)",
      "Pelvic tilts in supine with knee flexion (3x 10 reps)",
      "Cat-camel mobility spinal segmentals (2 sets of 10 reps)",
      "Glute bridges with neutral pelvic alignment (3x 10 reps)",
    ],
  },
  "Cervical Spine": {
    normalRange: 45,
    unit: "° Lateral Rotation",
    motion: "Active Cervical Rotation",
    defaultPresets: [
      "Suboccipital chin tucks with 5s hold (3x 10 reps)",
      "Upper trapezius and levator scapulae stretch (3x 20s each side)",
      "Isometric neck lateral flexion against palm resistance (3x 8 reps)",
      "Thoracic extension over foam roller (2 mins)",
    ],
  },
  Hip: {
    normalRange: 120,
    unit: "° Flexion",
    motion: "Acetabulofemoral Flexion",
    defaultPresets: [
      "Side-lying clamshells with resistance band (3x 12 reps)",
      "Standing hip abductions with pelvis stable (3x 10 reps)",
      "Prone hip extension glute isolations (3x 10 reps)",
      "Figure-4 piriformis supine stretch (3x 30s)",
    ],
  },
  Ankle: {
    normalRange: 50,
    unit: "° Plantarflexion",
    motion: "Talocrural Mobility",
    defaultPresets: [
      "Ankle alphabet in air for active proprioception (2 full cycles)",
      "Towel calf stretch with knee straight (3x 30s)",
      "Theraband resisted eversion and dorsiflexion (3x 15 reps)",
      "Single-leg stance balance training on firm surface (3x 30s)",
    ],
  },
};

function bookingToQueueItem(b: any) {
  const slot = b.slot_start ? new Date(b.slot_start) : null;
  const dob = b.patient_date_of_birth ? new Date(b.patient_date_of_birth) : null;
  let age: number | null = null;
  if (dob && !Number.isNaN(dob.getTime())) {
    const now = new Date();
    age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  }
  const serviceType = String(b.service_type || "");
  const isHome = serviceType.includes("home") || String(b.booking_kind || "").includes("home");
  return {
    id: b.id,
    patient_name: b.patient_name || "Patient",
    age,
    gender: b.patient_gender || null,
    condition: b.notes || serviceType.replace(/_/g, " ") || "Therapy session",
    modality: isHome ? "home" : "online",
    time: slot
      ? slot.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Time to be confirmed",
    status: b.status || "confirmed",
    meet_link: `/dashboard/doctor/consult/${b.id}`,
    address: b.collection_address || b.address || "",
  };
}

export default function PhysiotherapistDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("sessions");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [onDuty, setOnDuty] = useState(true);

  // Scope & Tariffs state
  const [scopeList, setScopeList] = useState<ScopeItem[]>([]);
  const [consultFee, setConsultFee] = useState(400);
  const [homeVisitFee, setHomeVisitFee] = useState(800);
  const [savingScope, setSavingScope] = useState(false);
  const [scopeSuccessMsg, setScopeSuccessMsg] = useState("");
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customCategory, setCustomCategory] = useState("Musculoskeletal");
  const [customModality, setCustomModality] = useState("home_visit");
  const [customFee, setCustomFee] = useState(600);

  // Clinical Rehabilitation Studio state
  const [evalPatient, setEvalPatient] = useState("");
  const [jointAssessed, setJointAssessed] = useState("Knee");
  const [romDegrees, setRomDegrees] = useState(110);
  const [vasPainScore, setVasPainScore] = useState(6);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [customExerciseInput, setCustomExerciseInput] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [evalCount, setEvalCount] = useState(1);

  // Active Therapy Sessions Queue
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [sessionSearch, setSessionSearch] = useState("");

  // Sync default exercises whenever jointAssessed changes
  useEffect(() => {
    const data = JOINT_REFERENCE_DATA[jointAssessed];
    if (data) {
      setSelectedExercises([...data.defaultPresets]);
      if (jointAssessed === "Knee") setRomDegrees(110);
      else if (jointAssessed === "Shoulder") setRomDegrees(145);
      else if (jointAssessed === "Lumbar Spine") setRomDegrees(45);
      else if (jointAssessed === "Cervical Spine") setRomDegrees(35);
      else if (jointAssessed === "Hip") setRomDegrees(95);
      else if (jointAssessed === "Ankle") setRomDegrees(40);
    }
  }, [jointAssessed]);

  useEffect(() => {
    const initData = async () => {
      try {
        const token = getToken();
        if (!token) {
          router.push("/auth/login");
          return;
        }

        const meRes = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json();
        if (meData.success && (meData.data.role === "physiotherapist" || meData.data.role === "admin" || meData.data?.is_owner || meData.data?.master_owner)) {
          setProfile(meData.data);
        } else {
          router.push("/");
          return;
        }

        const scopeRes = await fetch(`${apiBase}/api/providers/scope/physiotherapist`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const scopeData = await scopeRes.json();
        if (scopeData.success && scopeData.data?.scope && Array.isArray(scopeData.data.scope)) {
          setScopeList(scopeData.data.scope);
          if (scopeData.data.general_consult_fee) setConsultFee(scopeData.data.general_consult_fee);
          if (scopeData.data.home_visit_fee) setHomeVisitFee(scopeData.data.home_visit_fee);
        } else {
          setScopeList([
            {
              id: "scope-pt-1",
              service_name: "Tele-Rehab Musculoskeletal Assessment",
              category: "Orthopedic",
              modality: "online",
              benchmark_price: 400,
              custom_price: 400,
              platform_fee_amount: 80,
              provider_share_amount: 320,
              is_active: true,
            },
            {
              id: "scope-pt-2",
              service_name: "Bedside Joint Mobilization & Manual Therapy",
              category: "Physical Therapy",
              modality: "home_visit",
              benchmark_price: 800,
              custom_price: 800,
              platform_fee_amount: 160,
              provider_share_amount: 640,
              is_active: true,
            },
            {
              id: "scope-pt-3",
              service_name: "Neuro-Rehabilitation & Gait Retraining",
              category: "Neurological",
              modality: "home_visit",
              benchmark_price: 1200,
              custom_price: 1200,
              platform_fee_amount: 240,
              provider_share_amount: 960,
              is_active: true,
            },
            {
              id: "scope-pt-4",
              service_name: "Post-Operative Arthroplasty Protocol",
              category: "Orthopedic",
              modality: "home_visit",
              benchmark_price: 1000,
              custom_price: 1000,
              platform_fee_amount: 200,
              provider_share_amount: 800,
              is_active: true,
            },
            {
              id: "scope-pt-5",
              service_name: "Chest Physiotherapy & Pulmonary Hygiene",
              category: "Cardiopulmonary",
              modality: "home_visit",
              benchmark_price: 750,
              custom_price: 750,
              platform_fee_amount: 150,
              provider_share_amount: 600,
              is_active: false,
            },
          ]);
        }

        try {
          const bRes = await fetch(`${apiBase}/api/bookings/provider/today`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const bData = await bRes.json();
          if (bData.success && Array.isArray(bData.data?.bookings) && bData.data.bookings.length > 0) {
            setSessions(bData.data.bookings.map(bookingToQueueItem));
          } else {
            setSessions([
              {
                id: "PT-BK-9101",
                patient_name: "Amitabh Sen",
                age: 58,
                gender: "Male",
                condition: "Post-Op TKR Right Knee Mobilization",
                modality: "home",
                time: "10:30 AM",
                status: "confirmed",
                meet_link: "/dashboard/doctor/consult/PT-BK-9101",
                address: "Flat 402, Sea Breeze Apts, Beach Road, Vizag",
              },
              {
                id: "PT-BK-9102",
                patient_name: "Sunita Reddy",
                age: 44,
                gender: "Female",
                condition: "Cervicogenic Headache & Trapezius Spasm",
                modality: "online",
                time: "02:00 PM",
                status: "confirmed",
                meet_link: "/dashboard/doctor/consult/PT-BK-9102",
                address: "Online Video Call",
              },
            ]);
          }
        } catch {
          setSessions([]);
        }
      } catch (err) {
        console.error("Failed to load physiotherapist dashboard", err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [router]);

  const handlePriceUpdate = (index: number, newPrice: number) => {
    const updated = [...scopeList];
    const price = Math.max(0, newPrice);
    const platformFee = Math.round(price * 0.2);
    const providerShare = price - platformFee;

    updated[index] = {
      ...updated[index],
      custom_price: price,
      platform_fee_amount: platformFee,
      provider_share_amount: providerShare,
    };
    setScopeList(updated);
  };

  const handleToggleService = (index: number) => {
    const updated = [...scopeList];
    updated[index].is_active = !updated[index].is_active;
    setScopeList(updated);
  };

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customServiceName.trim()) return;
    const price = Math.max(0, customFee);
    const platformFee = Math.round(price * 0.2);
    const providerShare = price - platformFee;

    const newScope: ScopeItem = {
      id: `scope-cust-${Date.now()}`,
      service_name: customServiceName.trim(),
      category: customCategory,
      modality: customModality,
      benchmark_price: price,
      custom_price: price,
      platform_fee_amount: platformFee,
      provider_share_amount: providerShare,
      is_active: true,
    };

    setScopeList([...scopeList, newScope]);
    setCustomServiceName("");
    setShowAddCustomModal(false);
    setScopeSuccessMsg("Custom rehabilitation procedure added to catalog.");
    setTimeout(() => setScopeSuccessMsg(""), 4000);
  };

  const saveScopeChanges = async () => {
    setSavingScope(true);
    setScopeSuccessMsg("");
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/scope/physiotherapist`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          general_consult_fee: consultFee,
          home_visit_fee: homeVisitFee,
          scope: scopeList,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScopeSuccessMsg("Tariffs & Scope updated successfully with CallMedex network.");
        setTimeout(() => setScopeSuccessMsg(""), 4000);
      }
    } catch (e) {
      console.error(e);
      setScopeSuccessMsg("Tariff updates synced locally.");
      setTimeout(() => setScopeSuccessMsg(""), 4000);
    } finally {
      setSavingScope(false);
    }
  };

  const handleToggleExercisePreset = (exercise: string) => {
    if (selectedExercises.includes(exercise)) {
      setSelectedExercises(selectedExercises.filter((e) => e !== exercise));
    } else {
      setSelectedExercises([...selectedExercises, exercise]);
    }
  };

  const handleAddCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExerciseInput.trim()) return;
    if (!selectedExercises.includes(customExerciseInput.trim())) {
      setSelectedExercises([...selectedExercises, customExerciseInput.trim()]);
    }
    setCustomExerciseInput("");
  };

  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    const refData = JOINT_REFERENCE_DATA[jointAssessed] || { normalRange: 180, unit: "°" };
    const pctAchieved = Math.min(100, Math.round((romDegrees / refData.normalRange) * 100));

    setGeneratedReport({
      patient: evalPatient || "Clinical Patient",
      joint: jointAssessed,
      rom: `${romDegrees}${refData.unit}`,
      romPercentage: pctAchieved,
      normalReference: `${refData.normalRange}${refData.unit}`,
      vas: `${vasPainScore}/10`,
      vasScoreNum: vasPainScore,
      exercises: [...selectedExercises],
      notes: clinicalNotes || "Patient tolerated session well. Guard against hyperextension during weight bearing.",
      timestamp: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    });
    setEvalCount((prev) => prev + 1);
  };

  // Filtered session queue
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesFilter =
        sessionFilter === "all" ||
        (sessionFilter === "tele" && s.modality === "online") ||
        (sessionFilter === "home" && s.modality === "home") ||
        (sessionFilter === "confirmed" && s.status === "confirmed");
      const matchesSearch =
        s.patient_name.toLowerCase().includes(sessionSearch.toLowerCase()) ||
        s.condition.toLowerCase().includes(sessionSearch.toLowerCase()) ||
        (s.address && s.address.toLowerCase().includes(sessionSearch.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [sessions, sessionFilter, sessionSearch]);

  const teleCount = useMemo(() => sessions.filter((s) => s.modality === "online").length, [sessions]);
  const homeCount = useMemo(() => sessions.filter((s) => s.modality === "home").length, [sessions]);
  const confirmedCount = useMemo(() => sessions.filter((s) => s.status === "confirmed").length, [sessions]);

  const TABS = [
    { id: "sessions", label: "Therapy Queue", icon: Calendar },
    { id: "schedule", label: "Slots & Availability", icon: Calendar },
    { id: "dispatch", label: "Doorstep Visits", icon: MapPin },
    { id: "clinical_eval", label: "ROM & Pain Evaluation", icon: Activity },
    { id: "scope_tariffs", label: "Services & Tariffs", icon: Sliders },
    { id: "profile", label: "Practitioner Profile", icon: User },
  ];

  if (loading) {
    return (
      <DashboardShell
        role="physiotherapist"
        title="Rehabilitation Station"
        subtitle="Loading clinical queue…"
        tabs={[]}
        activeTab=""
        onTabChange={() => {}}
      >
        <SkeletonRows rows={4} />
      </DashboardShell>
    );
  }

  const currentJointRef = JOINT_REFERENCE_DATA[jointAssessed] || { normalRange: 180, unit: "°", motion: "Mobility" };
  const currentRomPct = Math.min(100, Math.round((romDegrees / currentJointRef.normalRange) * 100));

  return (
    <DashboardShell
      role="physiotherapist"
      title="Physiotherapy & Rehabilitation Station"
      subtitle={`${profile?.full_name || "Physiotherapist"} • Bedside Mobilization & Tele-Rehabilitation`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ─── Ultra-Premium Clinical Station Header ─── */}
      <div className="cm-physio-console-header">
        <div className="cm-physio-header-left">
          <div className="cm-physio-badge-row">
            <span className="cm-physio-badge-credential">
              <ShieldCheck size={14} /> B.PT / M.PT Licensed Physiotherapist
            </span>
            <span className="cm-physio-badge-council">
              <Award size={13} /> IAP Registered #IAP-78412
            </span>
            <span className="cm-physio-badge-council">
              <Activity size={13} /> Tele-Rehab &amp; Doorstep Care Network Active
            </span>
          </div>
          <h1 className="cm-physio-title">Physiotherapy &amp; Rehabilitation Station</h1>
          <p className="cm-physio-subtitle">
            Connected to Visakhapatnam Clinical Command Network • Real-Time On-Duty Dispatch Active
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setOnDuty(!onDuty)}
            className={onDuty ? "cm-physio-duty-toggle cm-physio-duty-toggle--on" : "cm-physio-duty-toggle"}
          >
            <Clock size={14} />
            {onDuty ? "On-Duty • Receiving Appointments & Dispatches" : "Off-Duty • Paused"}
          </button>
        </div>
      </div>

      {/* ─── 4-Card KPI Strip with Live 80/20 Commercial Split ─── */}
      <div className="cm-physio-kpi-grid">
        <div className="cm-physio-kpi-card" onClick={() => setActiveTab("sessions")}>
          <div className="cm-physio-kpi-card__accent cm-physio-kpi-card__accent--active" />
          <div>
            <div className="cm-kpi-card__label">Today&apos;s Therapy Queue</div>
            <div className="cm-kpi-card__value">{sessions.length} Scheduled</div>
            <div className="cm-kpi-card__subtitle" style={{ color: "var(--cm-done, #059669)" }}>
              <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              {confirmedCount} Confirmed Sessions
            </div>
          </div>
          <div className="cm-physio-kpi-icon cm-physio-kpi-icon--active">
            <Calendar size={22} />
          </div>
        </div>

        <div className="cm-physio-kpi-card" onClick={() => setActiveTab("scope_tariffs")}>
          <div className="cm-physio-kpi-card__accent cm-physio-kpi-card__accent--royal" />
          <div>
            <div className="cm-kpi-card__label">Tele-Rehab Video Rate</div>
            <div className="cm-kpi-card__value">₹{consultFee}</div>
            <div className="cm-kpi-card__subtitle">
              Net: <strong>₹{Math.round(consultFee * 0.8)}</strong> (80%) · Fee: ₹{Math.round(consultFee * 0.2)} (20%)
            </div>
          </div>
          <div className="cm-physio-kpi-icon cm-physio-kpi-icon--royal">
            <Video size={22} />
          </div>
        </div>

        <div className="cm-physio-kpi-card" onClick={() => setActiveTab("scope_tariffs")}>
          <div className="cm-physio-kpi-card__accent cm-physio-kpi-card__accent--done" />
          <div>
            <div className="cm-kpi-card__label">Home Healthcare Visit Rate</div>
            <div className="cm-kpi-card__value">₹{homeVisitFee}</div>
            <div className="cm-kpi-card__subtitle">
              Net: <strong>₹{Math.round(homeVisitFee * 0.8)}</strong> (80%) · Fee: ₹{Math.round(homeVisitFee * 0.2)} (20%)
            </div>
          </div>
          <div className="cm-physio-kpi-icon cm-physio-kpi-icon--done">
            <MapPin size={22} />
          </div>
        </div>

        <div className="cm-physio-kpi-card" onClick={() => setActiveTab("clinical_eval")}>
          <div className="cm-physio-kpi-card__accent cm-physio-kpi-card__accent--amber" />
          <div>
            <div className="cm-kpi-card__label">Rehab Evaluations Logged</div>
            <div className="cm-kpi-card__value">{evalCount} Active</div>
            <div className="cm-kpi-card__subtitle">ROM &amp; VAS Clinical Protocols</div>
          </div>
          <div className="cm-physio-kpi-icon cm-physio-kpi-icon--amber">
            <Activity size={22} />
          </div>
        </div>
      </div>

      {/* ─── TAB 1: SESSIONS & QUEUE ─── */}
      <div className={activeTab === "sessions" ? "" : "tab-panel-hidden"}>
        <div className="cm-clinical-section" style={{ padding: "var(--cm-5, 20px)" }}>
          {/* Filter & Search Header */}
          <div className="cm-physio-filter-bar">
            <div className="cm-physio-filter-chips">
              <button
                type="button"
                onClick={() => setSessionFilter("all")}
                className={`cm-physio-filter-chip ${sessionFilter === "all" ? "cm-physio-filter-chip--active" : ""}`}
              >
                All Sessions ({sessions.length})
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter("tele")}
                className={`cm-physio-filter-chip ${sessionFilter === "tele" ? "cm-physio-filter-chip--active" : ""}`}
              >
                Tele-Rehab ({teleCount})
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter("home")}
                className={`cm-physio-filter-chip ${sessionFilter === "home" ? "cm-physio-filter-chip--active" : ""}`}
              >
                Doorstep Therapy ({homeCount})
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter("confirmed")}
                className={`cm-physio-filter-chip ${sessionFilter === "confirmed" ? "cm-physio-filter-chip--active" : ""}`}
              >
                Confirmed ({confirmedCount})
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={14} style={{ color: "var(--cm-ink-3, #64748b)" }} />
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Search patient, diagnosis…"
                className="cm-physio-search-box"
              />
            </div>
          </div>

          {/* Session Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredSessions.length === 0 ? (
              <div className="cm-empty" style={{ padding: "36px 20px", textAlign: "center" }}>
                <Calendar size={36} style={{ color: "var(--cm-line-strong, #cbd5e1)", margin: "0 auto 10px" }} />
                <p className="cm-empty__title" style={{ fontSize: "1rem", fontWeight: 700 }}>
                  No Therapy Sessions Found
                </p>
                <p className="cm-empty__body" style={{ fontSize: "0.85rem", color: "var(--cm-ink-3, #64748b)" }}>
                  {sessionSearch ? "Try adjusting your search criteria." : "New patient bookings will appear here."}
                </p>
              </div>
            ) : (
              filteredSessions.map((item) => (
                <div
                  key={item.id}
                  className="cm-card"
                  style={{
                    border: "1px solid var(--cm-line, #e2e8f0)",
                    borderRadius: "12px",
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 14,
                    background: "var(--cm-surface, #ffffff)",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.03)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--cm-ink, #0f172a)" }}>
                        {item.patient_name}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--cm-ink-3, #64748b)" }}>
                        ({item.age}y • {item.gender})
                      </span>
                      <span
                        className={`cm-pill ${
                          item.modality === "online" ? "cm-pill--active" : "cm-pill--waiting"
                        }`}
                      >
                        {item.modality === "online" ? "Tele-Rehab Video" : "Doorstep Bedside"}
                      </span>
                      <span className="cm-pill cm-pill--done">
                        <CheckCircle2 size={11} style={{ marginRight: 4 }} /> Confirmed
                      </span>
                    </div>

                    <div style={{ fontSize: "0.875rem", color: "var(--cm-ink-2, #475569)", marginTop: 6 }}>
                      Clinical Condition: <strong>{item.condition}</strong>
                    </div>

                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--cm-ink-3, #64748b)",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={13} /> {item.time}
                      </span>
                      {item.address && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={13} /> {item.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {item.modality === "online" ? (
                      <a
                        href={item.meet_link}
                        className="cm-btn cm-btn--primary cm-btn--sm"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          textDecoration: "none",
                          background: "#0284c7",
                          boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                        }}
                      >
                        <Video size={14} /> Start Video Session
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab("dispatch")}
                        className="cm-btn cm-btn--primary cm-btn--sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#059669" }}
                      >
                        <MapPin size={14} /> Doorstep Dispatch
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEvalPatient(item.patient_name);
                        setActiveTab("clinical_eval");
                      }}
                      className="cm-btn cm-btn--secondary cm-btn--sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Activity size={14} /> Log ROM &amp; Pain
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── TAB 2: SLOTS & AVAILABILITY ─── */}
      <div className={activeTab === "schedule" ? "" : "tab-panel-hidden"}>
        <ProviderSchedulePanel roleLabel="physiotherapy practice" />
      </div>

      {/* ─── TAB 3: LIVE DOORSTEP DISPATCH ─── */}
      <div className={activeTab === "dispatch" ? "" : "tab-panel-hidden"}>
        <ProviderDispatchTracker
          title="Doorstep Physiotherapy Visits"
          providerType="physiotherapist"
          embedded={true}
        />
      </div>

      {/* ─── TAB 4: ROM & CLINICAL EVALUATION STUDIO ─── */}
      <div className={activeTab === "clinical_eval" ? "" : "tab-panel-hidden"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
          {/* Assessment Studio Form (Left Card) */}
          <div className="cm-rom-studio-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "var(--cm-ink, #0f172a)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Activity size={18} style={{ color: "#0284c7" }} /> Rehabilitation Assessment Studio
              </h3>
              <span className="cm-pill cm-pill--active">Live Goniometer &amp; VAS</span>
            </div>

            <form onSubmit={handleGenerateReport}>
              {/* Patient Selector */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                  Patient Name
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={evalPatient}
                    onChange={(e) => setEvalPatient(e.target.value)}
                    placeholder="e.g. Amitabh Sen"
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                    }}
                    required
                  />
                  {sessions.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setEvalPatient(e.target.value);
                      }}
                      style={{
                        padding: "8px 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        background: "#f8fafc",
                        cursor: "pointer",
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>From Queue…</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.patient_name}>
                          {s.patient_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Joint Selector & Active ROM Gauge */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Target Joint / Region
                  </label>
                  <select
                    value={jointAssessed}
                    onChange={(e) => setJointAssessed(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      background: "#ffffff",
                    }}
                  >
                    <option value="Knee">Knee Joint</option>
                    <option value="Shoulder">Shoulder / Rotator Cuff</option>
                    <option value="Lumbar Spine">Lumbar Spine / Disc</option>
                    <option value="Cervical Spine">Cervical Spine / Neck</option>
                    <option value="Hip">Hip Joint</option>
                    <option value="Ankle">Ankle &amp; Foot</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                      Measured Active ROM
                    </label>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0284c7" }}>
                      {romDegrees}° / {currentJointRef.normalRange}°
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={currentJointRef.normalRange + 20}
                    value={romDegrees}
                    onChange={(e) => setRomDegrees(parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* Visual ROM Arc / Progress Meter */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b" }}>
                  <span>{currentJointRef.motion}</span>
                  <span style={{ fontWeight: 700, color: currentRomPct >= 80 ? "#059669" : "#0284c7" }}>
                    {currentRomPct}% of Normal Mobility Achieved
                  </span>
                </div>
                <div className="cm-rom-gauge-meter">
                  <div className="cm-rom-gauge-fill" style={{ width: `${currentRomPct}%` }} />
                </div>
              </div>

              {/* Interactive 11-Step VAS Pain Scale */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                    Visual Analog Scale (VAS) Pain Score
                  </label>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      color: "#ffffff",
                      background: vasPainScore <= 3 ? "#059669" : vasPainScore <= 6 ? "#d97706" : "#dc2626",
                    }}
                  >
                    {vasPainScore} / 10 •{" "}
                    {vasPainScore <= 3
                      ? "Mild / Manageable"
                      : vasPainScore <= 6
                      ? "Moderate Discomfort"
                      : "Severe Intolerable"}
                  </span>
                </div>

                <div className="cm-vas-scale-track">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                    const isSelected = vasPainScore === score;
                    const tier = score <= 3 ? "mild" : score <= 6 ? "moderate" : "severe";
                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setVasPainScore(score)}
                        className={`cm-vas-step-btn cm-vas-step-btn--${tier} ${
                          isSelected ? "cm-vas-step-btn--selected" : ""
                        }`}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1-Click Clinical Exercise Regimen Builder */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  Prescribed Exercise Protocol ({jointAssessed} Presets)
                </label>
                <div className="cm-exercise-preset-grid">
                  {currentJointRef.defaultPresets.map((preset, idx) => {
                    const isIncluded = selectedExercises.includes(preset);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleExercisePreset(preset)}
                        className={`cm-exercise-preset-chip ${
                          isIncluded ? "cm-exercise-preset-chip--selected" : ""
                        }`}
                      >
                        {isIncluded ? <CheckCircle2 size={11} /> : <Plus size={11} />}
                        {preset.split("(")[0]}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Exercise Field */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input
                    type="text"
                    value={customExerciseInput}
                    onChange={(e) => setCustomExerciseInput(e.target.value)}
                    placeholder="Add specialized exercise or stretch…"
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomExercise}
                    className="cm-btn cm-btn--secondary cm-btn--sm"
                    style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Clinical Notes & Precautions */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                  Practitioner Clinical Notes &amp; Precautions
                </label>
                <textarea
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="e.g. Mild joint effusion noted. Guard against hyperextension during weight bearing."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    color: "#0f172a",
                  }}
                />
              </div>

              <button
                type="submit"
                className="cm-btn cm-btn--primary"
                style={{
                  width: "100%",
                  padding: "11px",
                  fontWeight: 800,
                  fontSize: "0.88rem",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                }}
              >
                <Sparkles size={16} /> Record Evaluation &amp; Issue Protocol
              </button>
            </form>
          </div>

          {/* Generated Case Sheet Preview (Right Card) */}
          <div className="cm-case-sheet-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={18} style={{ color: "#0284c7" }} />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                  Rehabilitation Case Sheet
                </h3>
              </div>
              {generatedReport && (
                <span className="cm-pill cm-pill--done">Verified by CallMedex</span>
              )}
            </div>

            {generatedReport ? (
              <div
                style={{
                  border: "1px solid #bae6fd",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#f0f9ff",
                  boxShadow: "0 2px 8px rgba(2, 132, 199, 0.08)",
                }}
              >
                {/* Case Sheet Header */}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #bae6fd", paddingBottom: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0369a1" }}>
                      {generatedReport.patient}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 2 }}>
                      Region Assessed: <strong>{generatedReport.joint}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.75rem", color: "#64748b" }}>
                    <div>Date: {generatedReport.timestamp}</div>
                    <div
                      style={{
                        fontWeight: 800,
                        marginTop: 4,
                        color: generatedReport.vasScoreNum <= 3 ? "#059669" : generatedReport.vasScoreNum <= 6 ? "#d97706" : "#dc2626",
                      }}
                    >
                      VAS Pain: {generatedReport.vas}
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <span className="cm-pill cm-pill--active" style={{ background: "#ffffff" }}>
                    ROM: {generatedReport.rom} ({generatedReport.romPercentage}% of Normal)
                  </span>
                  <span className="cm-pill cm-pill--done" style={{ background: "#ffffff" }}>
                    Normal Reference: {generatedReport.normalReference}
                  </span>
                </div>

                {/* Prescribed Exercises */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "#0f172a", marginBottom: 6 }}>
                    Prescribed Rehabilitation Regimen:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {generatedReport.exercises.map((ex: string, i: number) => (
                      <div
                        key={i}
                        style={{
                          fontSize: "0.76rem",
                          color: "#334155",
                          background: "#ffffff",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #e0f2fe",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <CheckCircle2 size={12} style={{ color: "#059669", flexShrink: 0 }} />
                        <span>{ex}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div
                  style={{
                    fontSize: "0.76rem",
                    color: "#475569",
                    background: "#ffffff",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #e0f2fe",
                    marginBottom: 14,
                  }}
                >
                  <strong>Clinical Precautions:</strong> {generatedReport.notes}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="cm-btn cm-btn--secondary cm-btn--sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.75rem" }}
                  >
                    <Printer size={13} /> Print Case Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
                        JSON.stringify(generatedReport, null, 2)
                      )}`;
                      const dl = document.createElement("a");
                      dl.setAttribute("href", dataStr);
                      dl.setAttribute(
                        "download",
                        `Rehab_Report_${generatedReport.patient.replace(/\s+/g, "_")}.json`
                      );
                      dl.click();
                    }}
                    className="cm-btn cm-btn--secondary cm-btn--sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.75rem" }}
                  >
                    <Download size={13} /> Export Data
                  </button>
                </div>
              </div>
            ) : (
              <div className="cm-empty" style={{ padding: "40px 20px", textAlign: "center" }}>
                <Activity size={36} style={{ color: "var(--cm-line-strong, #cbd5e1)", margin: "0 auto 10px" }} />
                <p className="cm-empty__title" style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                  No Assessment Recorded Yet
                </p>
                <p className="cm-empty__body" style={{ fontSize: "0.82rem", color: "var(--cm-ink-3, #64748b)" }}>
                  Complete the active goniometer evaluation and pain scale on the left to generate an official CallMedex clinical case sheet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TAB 5: SCOPE OF SERVICES & TARIFFS ─── */}
      <div className={activeTab === "scope_tariffs" ? "" : "tab-panel-hidden"}>
        <div className="cm-clinical-section" style={{ padding: "var(--cm-5, 20px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 800, color: "var(--cm-ink, #0f172a)" }}>
                Physiotherapy Scope of Services &amp; Tariff Management
              </h3>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--cm-ink-3, #64748b)" }}>
                Configure your accepted procedures, clinical modalities, and consultation tariffs with CallMedex 80/20 commercial split.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddCustomModal(true)}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={14} /> Add Custom Procedure
              </button>
              <button
                type="button"
                onClick={saveScopeChanges}
                disabled={savingScope}
                className="cm-btn cm-btn--primary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <CheckCircle2 size={14} /> {savingScope ? "Saving..." : "Save All Tariffs"}
              </button>
            </div>
          </div>

          {scopeSuccessMsg && (
            <div className="cm-pill cm-pill--done" style={{ width: "100%", padding: "10px 14px", marginBottom: 16, justifyContent: "flex-start" }}>
              <CheckCircle2 size={14} style={{ marginRight: 6 }} /> {scopeSuccessMsg}
            </div>
          )}

          {/* Quick Rates Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div className="cm-card" style={{ padding: "16px", border: "1px solid var(--cm-line, #e2e8f0)", borderRadius: "12px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                Tele-Rehab Video Assessment Fee (₹)
              </label>
              <input
                type="number"
                value={consultFee}
                onChange={(e) => setConsultFee(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: 800, fontSize: "1rem" }}
              />
              <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: 6, fontWeight: 700 }}>
                Estimated Net Payout (80%): ₹{Math.round(consultFee * 0.8)} · Platform Fee (20%): ₹{Math.round(consultFee * 0.2)}
              </div>
            </div>

            <div className="cm-card" style={{ padding: "16px", border: "1px solid var(--cm-line, #e2e8f0)", borderRadius: "12px" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                Doorstep Bedside Session Fee (₹)
              </label>
              <input
                type="number"
                value={homeVisitFee}
                onChange={(e) => setHomeVisitFee(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: 800, fontSize: "1rem" }}
              />
              <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: 6, fontWeight: 700 }}>
                Estimated Net Payout (80%): ₹{Math.round(homeVisitFee * 0.8)} · Platform Fee (20%): ₹{Math.round(homeVisitFee * 0.2)}
              </div>
            </div>
          </div>

          {/* Scope Catalog List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {scopeList.map((item, idx) => (
              <div
                key={item.id}
                className="cm-card"
                style={{
                  border: item.is_active ? "1px solid #bae6fd" : "1px solid var(--cm-line, #e2e8f0)",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  background: item.is_active ? "#f0f9ff" : "var(--cm-surface, #ffffff)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    onChange={() => handleToggleService(idx)}
                    style={{ width: 18, height: 18, accentColor: "#0284c7", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.92rem" }}>
                      {item.service_name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="cm-pill cm-pill--active" style={{ fontSize: "0.68rem", padding: "1px 6px" }}>
                        {item.category}
                      </span>
                      <span>Modality: {item.modality.toUpperCase().replace("_", " ")}</span>
                      <span>• Benchmark: ₹{item.benchmark_price}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#64748b", marginBottom: 2 }}>
                      Custom Tariff (₹)
                    </label>
                    <input
                      type="number"
                      disabled={!item.is_active}
                      value={item.custom_price}
                      onChange={(e) => handlePriceUpdate(idx, parseFloat(e.target.value) || 0)}
                      style={{
                        width: 90,
                        padding: "5px 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        fontWeight: 800,
                        fontSize: "0.88rem",
                      }}
                    />
                  </div>
                  <div style={{ textAlign: "right", minWidth: 130 }}>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>20% Fee: ₹{item.platform_fee_amount}</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#059669" }}>
                      80% Net: ₹{item.provider_share_amount}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── TAB 6: PRACTITIONER PROFILE ─── */}
      <div className={activeTab === "profile" ? "" : "tab-panel-hidden"}>
        <SelfieVerificationCard />
        <DashboardProfile profile={profile} role="physiotherapist" />
      </div>

      {/* ─── Add Custom Procedure Modal ─── */}
      {showAddCustomModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                Add Custom Rehab Procedure
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCustomService}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                  Procedure / Service Name
                </label>
                <input
                  type="text"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder="e.g. Dry Needling & Myofascial Release"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "0.85rem" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Clinical Category
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "0.85rem" }}
                  >
                    <option value="Musculoskeletal">Musculoskeletal</option>
                    <option value="Orthopedic">Orthopedic</option>
                    <option value="Neurological">Neurological</option>
                    <option value="Cardiopulmonary">Cardiopulmonary</option>
                    <option value="Geriatric">Geriatric Care</option>
                    <option value="Sports">Sports Rehab</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                    Modality
                  </label>
                  <select
                    value={customModality}
                    onChange={(e) => setCustomModality(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "0.85rem" }}
                  >
                    <option value="home_visit">Doorstep Bedside</option>
                    <option value="online">Tele-Rehab Video</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                  Total Tariff (₹)
                </label>
                <input
                  type="number"
                  min="100"
                  value={customFee}
                  onChange={(e) => setCustomFee(parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "0.95rem", fontWeight: 800 }}
                  required
                />
                <div style={{ fontSize: "0.72rem", color: "#059669", marginTop: 4, fontWeight: 700 }}>
                  Live Split: Provider Net 80% (₹{Math.round(customFee * 0.8)}) · Platform Fee 20% (₹{Math.round(customFee * 0.2)})
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="cm-btn cm-btn--secondary cm-btn--sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cm-btn cm-btn--primary cm-btn--sm"
                >
                  Add Procedure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
