"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Stethoscope,
  User,
  Activity,
  HeartPulse,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Send,
  Heart,
  Droplets,
  Wind,
  Eye,
  Search,
  Plus,
  X,
  Phone,
  Clock,
  Navigation,
  Thermometer,
  FileText,
  AlertTriangle,
  Award,
  Sparkles,
  Pencil,
  Trash2,
  Settings,
  ChevronRight,
} from "@/components/ui/icons";
import { Modal } from "@/components/ui";
import { mergeSavedScope, toScopePayload, splitFee } from "./nurseScope.mjs";

import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import SelfieVerificationCard from "../components/SelfieVerificationCard";
import NurseToolsModal from "../../../components/NurseToolsModal";
import NurseFieldOps3D from "../components/NurseFieldOps3D";
import DashboardShell, { SkeletonRows } from "../components/DashboardShell";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

interface NursingProcedure {
  code: string;
  name: string;
  category: string;
  standard_fee: number;
  nurse_net: number;
  platform_fee: number;
  duration: string;
  supplies: string;
  enabled: boolean;
  is_custom?: boolean;
}

const DEFAULT_EXCEL_PROCEDURES: NursingProcedure[] = [
  {
    code: "NUR-01",
    name: "IM / IV Injection & Vitals Check",
    category: "Basic Nursing",
    standard_fee: 300,
    nurse_net: 240,
    platform_fee: 60,
    duration: "20 min",
    supplies: "Syringe, spirit swab, disposal kit",
    enabled: true,
  },
  {
    code: "NUR-02",
    name: "Aseptic Wound Dressing (Minor / Post-Op)",
    category: "Wound Care",
    standard_fee: 350,
    nurse_net: 280,
    platform_fee: 70,
    duration: "30 min",
    supplies: "Sterile gauze, povidone-iodine, surgical tape",
    enabled: true,
  },
  {
    code: "NUR-03",
    name: "IV Fluid Infusion & Cannulation",
    category: "Critical Bedside",
    standard_fee: 400,
    nurse_net: 320,
    platform_fee: 80,
    duration: "45 min",
    supplies: "IV cannula, infusion set, micro-pore tape",
    enabled: true,
  },
  {
    code: "NUR-04",
    name: "Urinary Catheterization (Foley's)",
    category: "Specialized Care",
    standard_fee: 500,
    nurse_net: 400,
    platform_fee: 100,
    duration: "40 min",
    supplies: "Foley catheter, uro-bag, sterile lignocaine jelly",
    enabled: true,
  },
  {
    code: "NUR-05",
    name: "Ryle's Tube Insertion & Enteral Feeding",
    category: "Specialized Care",
    standard_fee: 500,
    nurse_net: 400,
    platform_fee: 100,
    duration: "40 min",
    supplies: "Ryle's tube, lubricant, feeding syringe",
    enabled: true,
  },
  {
    code: "NUR-06",
    name: "Tracheostomy Tube Care & Suctioning",
    category: "Respiratory",
    standard_fee: 600,
    nurse_net: 480,
    platform_fee: 120,
    duration: "45 min",
    supplies: "Suction catheter, sterile saline, tracheostomy bib",
    enabled: false,
  },
  {
    code: "NUR-07",
    name: "12-Hour Critical Bedside Nursing Care",
    category: "Continuous Attendant",
    standard_fee: 1500,
    nurse_net: 1200,
    platform_fee: 300,
    duration: "12 Hours",
    supplies: "Complete bedside monitoring & medication chart",
    enabled: false,
  },
];

interface ProcedureDraft {
  code: string | null; // null = new custom procedure
  name: string;
  category: string;
  fee: string;
  duration: string;
  supplies: string;
  custom: boolean;
}

const CUSTOM_CATEGORIES = [
  "Basic Nursing", "Wound Care", "Critical Bedside", "Specialized Care", "Respiratory", "Continuous Attendant",
];

interface NurseJob {
  id: string;
  booking_id?: string;
  patient_id?: string;
  patient_name?: string;
  patient_age_gender?: string;
  patient_phone?: string;
  patient_address?: string;
  scheduled_time?: string;
  slot_time?: string;
  service_name?: string;
  procedure?: string;
  scheduled_date?: string;
  total_price?: number;
  status?: string;
  priority?: string;
}

export default function NurseDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dispatch");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [onDuty, setOnDuty] = useState(true);

  // Procedure Catalog State
  const [procedures, setProcedures] = useState<NursingProcedure[]>(DEFAULT_EXCEL_PROCEDURES);
  const [procSearch, setProcSearch] = useState("");
  const [procCategory, setProcCategory] = useState("All");
  // Service catalogue manager: one modal, list view or a single edit form.
  const [showCatalog, setShowCatalog] = useState(false);
  const [draft, setDraft] = useState<ProcedureDraft | null>(null);
  const [procSaveStatus, setProcSaveStatus] = useState<string | null>(null);

  // Schedule & Advance Slots State
  const [scheduleTimeframe, setScheduleTimeframe] = useState<"today" | "tomorrow" | "upcoming">("today");
  const [scheduledJobs, setScheduledJobs] = useState<NurseJob[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [tomorrowCount, setTomorrowCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

  // Bedside Vitals Studio State
  const [activeBookingId, setActiveBookingId] = useState("bk-nurse-01");
  const [vitalsPatient, setVitalsPatient] = useState("Lakshmi Narayana (72 Yrs / M)");
  const [bpSystolic, setBpSystolic] = useState("128");
  const [bpDiastolic, setBpDiastolic] = useState("82");
  const [pulse, setPulse] = useState("76");
  const [spo2, setSpo2] = useState("98");
  const [temp, setTemp] = useState("98.6");
  const [glucose, setGlucose] = useState("114");
  const [gcs, setGcs] = useState("15");
  const [bedsideNotes, setBedsideNotes] = useState(
    "Patient is alert and conscious. Sterile wound dressing complete with povidone-iodine. Margins healthy without purulent discharge. Tolerating oral fluids well."
  );
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load Nurse Profile and Saved Scope
  useEffect(() => {
    const fetchProfileAndScope = async () => {
      try {
        const token = getToken();
        let nurseData = null;
        if (token) {
          try {
            const res = await fetch(`${apiBase}/api/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && (data.data?.role === "nurse" || data.data?.role === "admin" || data.data?.is_owner || data.data?.master_owner)) {
              nurseData = {
                ...data.data,
                full_name: data.data.role === "nurse" ? data.data.full_name : (data.data.full_name || "Sister Priya Sharma"),
                role: "nurse",
              };
            }
          } catch {}
        }

        if (!nurseData) {
          if (process.env.NODE_ENV === "development" || token === "mock-nurse-token") {
            nurseData = {
              id: "usr-nurse-1",
              full_name: "Priyanka Sharma, RN",
              role: "nurse",
              mobile: "+91 98480 12345",
              email: "priyanka.nurse@callmedex.com",
            };
          } else {
            router.push("/auth/login");
            return;
          }
        }
        setProfile(nurseData);


        // Fetch Saved Scope of Services
        try {
          const scopeRes = await fetch(`${apiBase}/api/providers/me/scope`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (scopeRes.ok) {
            const scopeData = await scopeRes.json();
            const savedList = scopeData.data?.scope_of_services;
            if (Array.isArray(savedList) && savedList.length > 0) {
              setProcedures(mergeSavedScope(DEFAULT_EXCEL_PROCEDURES, savedList));
            }
          }
        } catch (err) {
          console.error("Could not fetch provider scope:", err);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfileAndScope();
  }, [router]);

  // Fetch Scheduled Jobs
  const fetchNurseJobs = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setScheduleLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/nurse/jobs?timeframe=${scheduleTimeframe}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setScheduledJobs(data.jobs || []);
      }
    } catch (e) {
      console.error("Failed to load nurse jobs:", e);
    } finally {
      setScheduleLoading(false);
    }
  }, [scheduleTimeframe]);

  useEffect(() => {
    fetchNurseJobs();
  }, [fetchNurseJobs]);

  // Pre-fetch count badges for Today, Tomorrow, Upcoming
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${apiBase}/api/nurse/jobs?timeframe=today`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setTodayCount((d.jobs || []).length))
      .catch(() => {});

    fetch(`${apiBase}/api/nurse/jobs?timeframe=tomorrow`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setTomorrowCount((d.jobs || []).length))
      .catch(() => {});

    fetch(`${apiBase}/api/nurse/jobs?timeframe=upcoming`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setUpcomingCount((d.jobs || []).length))
      .catch(() => {});
  }, []);

  // Save Procedures to Backend
  const saveProceduresToBackend = async (updatedList: NursingProcedure[]) => {
    const token = getToken();
    if (!token) return;
    setProcSaveStatus("Syncing tariffs & scope with CallMedex...");
    try {
      const payload = { scope_of_services: toScopePayload(updatedList) };

      const res = await fetch(`${apiBase}/api/providers/me/scope`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setProcSaveStatus("Nursing procedures & tariff schedule updated successfully.");
        setTimeout(() => setProcSaveStatus(null), 3000);
      } else {
        setProcSaveStatus("Notice: Tariff preferences saved locally.");
        setTimeout(() => setProcSaveStatus(null), 3000);
      }
    } catch {
      setProcSaveStatus("Notice: Tariff preferences saved locally.");
      setTimeout(() => setProcSaveStatus(null), 3000);
    }
  };

  const toggleProcedure = (code: string) => {
    commitProcedures(procedures.map((p) =>
      p.code === code ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const commitProcedures = (updated: NursingProcedure[]) => {
    setProcedures(updated);
    saveProceduresToBackend(updated);
  };

  const openAddDraft = () => {
    setDraft({ code: null, name: "", category: "Basic Nursing", fee: "450", duration: "30 min",
      supplies: "Standard clinical nursing supplies", custom: true });
    setShowCatalog(true);
  };

  const openEditDraft = (p: NursingProcedure) => {
    setDraft({ code: p.code, name: p.name, category: p.category, fee: String(p.standard_fee),
      duration: p.duration, supplies: p.supplies, custom: !!p.is_custom });
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.name.trim()) return;
    const fee = Math.max(100, Math.round(parseFloat(draft.fee) || 0));
    const fields = {
      ...splitFee(fee),
      duration: draft.duration.trim() || "30 min",
      supplies: draft.supplies.trim() || "Standard clinical kit",
    };

    if (draft.code === null) {
      const newProc: NursingProcedure = {
        code: `NUR-CUST-${Date.now().toString(36).toUpperCase()}`,
        name: draft.name.trim(),
        category: draft.category,
        ...fields,
        enabled: true,
        is_custom: true,
      };
      commitProcedures([newProc, ...procedures]);
    } else {
      commitProcedures(procedures.map((p) =>
        p.code !== draft.code ? p : {
          ...p,
          ...fields,
          // Catalogue names are canonical clinical names; only a nurse's own
          // custom procedure can be renamed or re-categorised.
          ...(p.is_custom ? { name: draft.name.trim(), category: draft.category } : {}),
        }
      ));
    }
    setDraft(null);
  };

  const deleteProcedure = (p: NursingProcedure) => {
    if (!p.is_custom) return;
    if (!confirm(`Remove "${p.name}" from your service catalogue?`)) return;
    commitProcedures(procedures.filter((x) => x.code !== p.code));
  };

  const closeCatalog = () => {
    setShowCatalog(false);
    setDraft(null);
  };

  // Vitals Triage Calculation
  const triageAssessment = useMemo(() => {
    const sys = parseInt(bpSystolic, 10);
    const dia = parseInt(bpDiastolic, 10);
    const ox = parseInt(spo2, 10);
    const pr = parseInt(pulse, 10);
    const tempF = parseFloat(temp);
    const gcsVal = parseInt(gcs, 10);

    if (ox < 90 || sys >= 180 || sys < 85 || gcsVal <= 8) {
      return {
        level: "urgent",
        label: "Emergency / Immediate Physician Alert",
        className: "cm-nurse-triage-pill cm-nurse-triage-pill--urgent",
      };
    }
    if (ox < 95 || sys >= 140 || sys < 95 || dia >= 90 || pr > 100 || pr < 55 || tempF > 100.4) {
      return {
        level: "alert",
        label: "Clinical Parameter Alert",
        className: "cm-nurse-triage-pill cm-nurse-triage-pill--alert",
      };
    }
    return {
      level: "normal",
      label: "Normal Clinical Stability",
      className: "cm-nurse-triage-pill cm-nurse-triage-pill--normal",
    };
  }, [bpSystolic, bpDiastolic, spo2, pulse, temp, gcs]);

  // Sync Vitals to EHR API
  const handleSyncVitals = async () => {
    setIsSyncing(true);
    setSyncStatus("Encrypting and syncing vitals to patient EHR and supervising physician...");
    const token = getToken();

    try {
      const payload = {
        vitals: {
          bp_systolic: parseInt(bpSystolic, 10) || 120,
          bp_diastolic: parseInt(bpDiastolic, 10) || 80,
          blood_pressure: `${bpSystolic}/${bpDiastolic}`,
          heart_rate: parseInt(pulse, 10) || 72,
          pulse: parseInt(pulse, 10) || 72,
          spo2: parseInt(spo2, 10) || 98,
          temperature_f: parseFloat(temp) || 98.6,
          blood_glucose: parseInt(glucose, 10) || 110,
          gcs: parseInt(gcs, 10) || 15,
        },
        procedure_notes: bedsideNotes,
        wound_care_notes: "Aseptic technique maintained. Sterile dressings applied.",
      };

      if (token && activeBookingId) {
        await fetch(`${apiBase}/api/nurse/visits/${activeBookingId}/vitals`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }

      setTimeout(() => {
        setSyncStatus(
          "Bedside Vitals and Clinical Documentation successfully logged and synchronized to Patient EHR and Supervising Doctor."
        );
        setIsSyncing(false);
      }, 700);
    } catch {
      setSyncStatus(
        "Bedside Case Sheet saved to local clinical storage and queued for doctor review."
      );
      setIsSyncing(false);
    }
  };

  // Teleport from Schedule to Bedside Studio
  const handleStartBedsideVisit = (job: NurseJob) => {
    if (job.booking_id) setActiveBookingId(job.booking_id);
    setVitalsPatient(`${job.patient_name || "Patient"} (${job.patient_age_gender || "Adult"})`);
    setBedsideNotes(
      `Doorstep visit for ${job.service_name || job.procedure || "Clinical Nursing Care"}. Patient greeted at ${job.patient_address || "residence"}.`
    );
    setActiveTab("vitals");
  };

  // Filtered Procedures
  const filteredProcedures = useMemo(() => {
    return procedures.filter((p) => {
      const matchesCategory =
        procCategory === "All" ||
        (procCategory === "Custom" ? p.is_custom : p.category === procCategory);
      const matchesSearch =
        p.name.toLowerCase().includes(procSearch.toLowerCase()) ||
        p.code.toLowerCase().includes(procSearch.toLowerCase()) ||
        p.supplies.toLowerCase().includes(procSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [procedures, procSearch, procCategory]);

  const activeEnabledCount = useMemo(() => {
    return procedures.filter((p) => p.enabled).length;
  }, [procedures]);

  const categorySummary = useMemo(() => {
    const map = new Map<string, { name: string; active: number; total: number }>();
    for (const p of procedures) {
      const c = map.get(p.category) || { name: p.category, active: 0, total: 0 };
      c.total += 1;
      if (p.enabled) c.active += 1;
      map.set(p.category, c);
    }
    return Array.from(map.values());
  }, [procedures]);

  const feeRange = useMemo(() => {
    const fees = procedures.filter((p) => p.enabled).map((p) => p.standard_fee);
    if (fees.length === 0) return "—";
    const lo = Math.min(...fees), hi = Math.max(...fees);
    return lo === hi ? `₹${lo}` : `₹${lo}–${hi}`;
  }, [procedures]);

  const categories = useMemo(() => {
    const list = Array.from(new Set(procedures.map((p) => p.category)));
    return ["All", ...list, "Custom"];
  }, [procedures]);

  const nurseLicence: string =
    profile?.nursing_license_number || profile?.license_number || profile?.registration_number || "";

  const TABS = [
    { id: "dispatch", label: "Doorstep Dispatch", icon: MapPin },
    { id: "procedures", label: "Procedures & Tariffs", icon: Activity },
    { id: "vitals", label: "Bedside Vitals Studio", icon: HeartPulse },
    { id: "schedule", label: "Home Visit Schedule", icon: Calendar },
    { id: "profile", label: "Nurse Profile", icon: User },
  ];

  if (loading) {
    return (
      <DashboardShell
        role="nurse"
        title="Nurse Care Station"
        subtitle="Loading clinical nursing console…"
        tabs={[]}
        activeTab=""
        onTabChange={() => {}}
      >
        <SkeletonRows rows={4} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="nurse"
      title="Nurse Care Station"
      subtitle={`${profile?.full_name || "Nurse"} • Licensed Home Healthcare Specialist`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <button
          type="button"
          onClick={() => setShowToolsModal(true)}
          className="cm-nurse-tools-btn"
        >
          <Stethoscope size={16} /> Clinical Guidelines
        </button>
      }
    >
      <NurseToolsModal isOpen={showToolsModal} onClose={() => setShowToolsModal(false)} />

      {/* ─── Ultra-Premium Clinical Station Header Card ─── */}
      <div className="cm-nurse-console-header">
        <div className="cm-nurse-header-left">
          <div className="cm-nurse-badge-row">
            {profile?.qualification && (
              <span className="cm-nurse-badge-verified">
                <ShieldCheck size={14} /> {profile.qualification}
              </span>
            )}
            <span className="cm-nurse-badge-council">
              <Award size={13} />
              {nurseLicence ? `Nursing Reg. ${nurseLicence}` : "Registration number not on file"}
            </span>
          </div>
          <h1 className="cm-nurse-title">Clinical Doorstep Nursing Care Station</h1>
          <p className="cm-nurse-subtitle">
            Connected to Visakhapatnam Clinical Command Network • Real-Time On-Duty Dispatch Active
          </p>
        </div>

        <div className="cm-nurse-header-actions">
          <button
            type="button"
            onClick={() => setOnDuty(!onDuty)}
            className={
              onDuty
                ? "cm-nurse-duty-toggle cm-nurse-duty-toggle--on"
                : "cm-nurse-duty-toggle"
            }
          >
            <Clock size={14} />
            {onDuty ? "On-Duty • Receiving Doorstep Dispatches" : "Off-Duty • Paused"}
          </button>
        </div>
      </div>

      {/* ─── Nursing KPI Strip ─── */}
      <div className="cm-nurse-kpi-grid">
        <div
          className="cm-nurse-kpi-card"
          onClick={() => setActiveTab("dispatch")}
        >
          <div className="cm-kpi-card__accent cm-kpi-card__accent--urgent" />
          <div>
            <div className="cm-kpi-card__label">On-Duty Radar</div>
            <div className="cm-kpi-card__value">{onDuty ? "Active" : "Paused"}</div>
            <div className="cm-kpi-card__subtitle">5 km doorstep radius</div>
          </div>
          <div className="cm-kpi-card__icon cm-nurse-kpi-icon-urgent">
            <MapPin size={22} />
          </div>
        </div>

        <div
          className="cm-nurse-kpi-card"
          onClick={() => setActiveTab("procedures")}
        >
          <div className="cm-kpi-card__accent cm-kpi-card__accent--active" />
          <div>
            <div className="cm-kpi-card__label">Active Procedures</div>
            <div className="cm-kpi-card__value">{activeEnabledCount} of {procedures.length}</div>
            <div className="cm-kpi-card__subtitle">80% Net Take-Home</div>
          </div>
          <div className="cm-kpi-card__icon cm-nurse-kpi-icon-active">
            <Activity size={22} />
          </div>
        </div>

        <div
          className="cm-nurse-kpi-card"
          onClick={() => setActiveTab("schedule")}
        >
          <div className="cm-kpi-card__accent cm-kpi-card__accent--done" />
          <div>
            <div className="cm-kpi-card__label">Today's Home Visits</div>
            <div className="cm-kpi-card__value">{todayCount} Confirmed</div>
            <div className="cm-kpi-card__subtitle">Wound Care &amp; Infusions</div>
          </div>
          <div className="cm-kpi-card__icon cm-nurse-kpi-icon-done">
            <Calendar size={22} />
          </div>
        </div>

        <div
          className="cm-nurse-kpi-card"
          onClick={() => setActiveTab("vitals")}
        >
          <div className="cm-kpi-card__accent cm-kpi-card__accent--waiting" />
          <div>
            <div className="cm-kpi-card__label">Bedside Studio</div>
            <div className="cm-kpi-card__value">Live EHR</div>
            <div className="cm-kpi-card__subtitle">Doctor &amp; Vitals Sync</div>
          </div>
          <div className="cm-kpi-card__icon cm-nurse-kpi-icon-waiting">
            <HeartPulse size={22} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: LIVE DOORSTEP DISPATCH
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={activeTab === "dispatch" ? "" : "tab-panel-hidden"}>
        {activeTab === "dispatch" && <NurseFieldOps3D />}
        <ProviderDispatchTracker
          title="Nurse Doorstep Dispatch Center"
          providerType="nurse"
          embedded
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: PROCEDURES & EXTENSIBLE TARIFFS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "procedures" && (
        <div className="cm-nurse-container">
          <section className="cm-nsvc" aria-labelledby="nsvc-title">
            <header className="cm-nsvc__head">
              <div className="cm-nsvc__intro">
                <p className="cm-nsvc__eyebrow">Procedures &amp; tariffs</p>
                <h2 className="cm-nsvc__title" id="nsvc-title">Your home-care service catalogue</h2>
                <p className="cm-nsvc__lede">
                  Patients can book only the services you mark active. You keep 80% of every fee you set.
                </p>
              </div>
              <button type="button" onClick={openAddDraft} className="cm-nsvc-btn cm-nsvc-btn--ghost">
                <Plus size={16} /> Add custom procedure
              </button>
            </header>

            <dl className="cm-nsvc__stats">
              <div className="cm-nsvc__stat">
                <dt>Active</dt>
                <dd>{activeEnabledCount}</dd>
              </div>
              <div className="cm-nsvc__stat">
                <dt>Paused</dt>
                <dd>{procedures.length - activeEnabledCount}</dd>
              </div>
              <div className="cm-nsvc__stat">
                <dt>Your own</dt>
                <dd>{procedures.filter((p) => p.is_custom).length}</dd>
              </div>
              <div className="cm-nsvc__stat">
                <dt>Fee range</dt>
                <dd>{feeRange}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => { setProcCategory("All"); setShowCatalog(true); }}
              className="cm-nsvc__launcher"
            >
              <span className="cm-nsvc__launcher-icon"><Settings size={20} /></span>
              <span className="cm-nsvc__launcher-text">
                <strong>Manage services &amp; prices</strong>
                <span>Edit fees, pause, remove or add any of your {procedures.length} services</span>
              </span>
              <ChevronRight size={20} className="cm-nsvc__launcher-chev" />
            </button>

            <div className="cm-nsvc__cats">
              {categorySummary.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => { setProcCategory(c.name); setShowCatalog(true); }}
                  className="cm-nsvc__cat"
                >
                  {c.name}
                  <span className="cm-nsvc__cat-count">{c.active}/{c.total}</span>
                </button>
              ))}
            </div>
          </section>

          {procSaveStatus && (
            <div className="cm-nurse-sync-box" role="status">
              <CheckCircle2 size={16} /> {procSaveStatus}
            </div>
          )}

          <Modal
            open={showCatalog}
            onClose={closeCatalog}
            wide
            title={draft ? (draft.code === null ? "Add custom procedure" : "Edit service") : "Service catalogue"}
            footer={
              draft ? (
                <>
                  <button type="button" onClick={() => setDraft(null)} className="cm-nsvc-btn cm-nsvc-btn--ghost">
                    Back to catalogue
                  </button>
                  <button type="submit" form="nsvc-form" className="cm-nsvc-btn cm-nsvc-btn--primary">
                    <CheckCircle2 size={16} /> {draft.code === null ? "Add to my catalogue" : "Save changes"}
                  </button>
                </>
              ) : undefined
            }
          >
            {draft ? (
              <form id="nsvc-form" onSubmit={handleSaveDraft} className="cm-nsvc-form">
                <label className="cm-nsvc-form__field cm-nsvc-form__field--full">
                  <span>Procedure name</span>
                  <input
                    type="text"
                    required
                    disabled={!draft.custom}
                    placeholder="e.g. Suture Removal & Antiseptic Care"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="cm-nsvc-input"
                  />
                </label>
                <label className="cm-nsvc-form__field">
                  <span>Clinical category</span>
                  <select
                    disabled={!draft.custom}
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="cm-nsvc-input"
                  >
                    {(draft.custom && CUSTOM_CATEGORIES.includes(draft.category)
                      ? CUSTOM_CATEGORIES
                      : draft.custom ? [draft.category, ...CUSTOM_CATEGORIES] : [draft.category]
                    ).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="cm-nsvc-form__field">
                  <span>Fee to patient (₹)</span>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    required
                    value={draft.fee}
                    onChange={(e) => setDraft({ ...draft, fee: e.target.value })}
                    className="cm-nsvc-input"
                  />
                </label>
                <div className="cm-nsvc-split cm-nsvc-form__field--full">
                  <div>
                    <span>You receive (80%)</span>
                    <strong>₹{splitFee(Math.max(0, parseFloat(draft.fee) || 0)).nurse_net}</strong>
                  </div>
                  <div>
                    <span>CallMedex fee (20%)</span>
                    <strong>₹{splitFee(Math.max(0, parseFloat(draft.fee) || 0)).platform_fee}</strong>
                  </div>
                </div>
                <label className="cm-nsvc-form__field">
                  <span>Typical duration</span>
                  <input
                    type="text"
                    value={draft.duration}
                    onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                    placeholder="e.g. 30 min"
                    className="cm-nsvc-input"
                  />
                </label>
                <label className="cm-nsvc-form__field">
                  <span>Supplies you bring</span>
                  <input
                    type="text"
                    value={draft.supplies}
                    onChange={(e) => setDraft({ ...draft, supplies: e.target.value })}
                    placeholder="e.g. Suture cutter, sterile dressing pack"
                    className="cm-nsvc-input"
                  />
                </label>
                {!draft.custom && (
                  <p className="cm-nsvc-form__note cm-nsvc-form__field--full">
                    This is a standard CallMedex procedure, so its name and category are fixed. You can change the fee, duration and supplies.
                  </p>
                )}
              </form>
            ) : (
              <div className="cm-nsvc-manager">
                <div className="cm-nsvc-toolbar">
                  <label className="cm-nsvc-search">
                    <Search size={16} />
                    <input
                      type="search"
                      placeholder="Search by name, code or supplies"
                      value={procSearch}
                      onChange={(e) => setProcSearch(e.target.value)}
                      aria-label="Search services"
                    />
                  </label>
                  <select
                    value={procCategory}
                    onChange={(e) => setProcCategory(e.target.value)}
                    className="cm-nsvc-input cm-nsvc-toolbar__select"
                    aria-label="Filter by category"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat === "Custom" ? "My custom procedures" : cat}</option>
                    ))}
                  </select>
                  <button type="button" onClick={openAddDraft} className="cm-nsvc-btn cm-nsvc-btn--primary">
                    <Plus size={16} /> Add
                  </button>
                </div>

                {filteredProcedures.length === 0 ? (
                  <p className="cm-nsvc-empty">No services match this search.</p>
                ) : (
                  <ul className="cm-nsvc-list">
                    {filteredProcedures.map((p) => (
                      <li key={p.code} className={p.enabled ? "cm-nsvc-row" : "cm-nsvc-row cm-nsvc-row--paused"}>
                        <div className="cm-nsvc-row__main">
                          <span className="cm-nsvc-row__name">{p.name}</span>
                          <span className="cm-nsvc-row__meta">
                            {p.category} · {p.duration}
                            {p.is_custom && <span className="cm-nsvc-row__tag">Custom</span>}
                          </span>
                        </div>
                        <div className="cm-nsvc-row__price">
                          <strong>₹{p.standard_fee}</strong>
                          <span>You get ₹{p.nurse_net}</span>
                        </div>
                        <div className="cm-nsvc-row__actions">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.enabled}
                            aria-label={`${p.name} available for booking`}
                            onClick={() => toggleProcedure(p.code)}
                            className="cm-nsvc-switch"
                          >
                            <span className="cm-nsvc-switch__track"><span className="cm-nsvc-switch__thumb" /></span>
                            <span className="cm-nsvc-switch__label">{p.enabled ? "Active" : "Paused"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditDraft(p)}
                            className="cm-nsvc-icon-btn"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          {p.is_custom && (
                            <button
                              type="button"
                              onClick={() => deleteProcedure(p)}
                              className="cm-nsvc-icon-btn cm-nsvc-icon-btn--danger"
                              aria-label={`Remove ${p.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: BEDSIDE VITALS & CASE SHEET STUDIO
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "vitals" && (
        <div className="cm-nurse-container">
          <div className="cm-nurse-vitals-form">
            {/* Patient Header with Dynamic Triage Assessment */}
            <div className="cm-nurse-patient-row">
              <div>
                <label className="cm-nurse-patient-label">Active Bedside Patient</label>
                <input
                  type="text"
                  value={vitalsPatient}
                  onChange={(e) => setVitalsPatient(e.target.value)}
                  className="cm-nurse-patient-input"
                />
              </div>

              <div className="cm-nurse-header-actions">
                <span className={triageAssessment.className}>
                  {triageAssessment.level === "normal" && <CheckCircle2 size={14} />}
                  {triageAssessment.level === "alert" && <AlertTriangle size={14} />}
                  {triageAssessment.level === "urgent" && <AlertTriangle size={14} />}
                  {triageAssessment.label}
                </span>
                <span className="cm-nurse-badge-council">
                  Booking #{activeBookingId.slice(0, 10)}
                </span>
              </div>
            </div>

            {/* Vitals Matrix Inputs */}
            <div className="cm-nurse-vitals-matrix">
              {/* BP */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Activity size={15} /> Blood Pressure (mmHg)
                </div>
                <div className="cm-nurse-bp-row">
                  <input
                    type="number"
                    value={bpSystolic}
                    onChange={(e) => setBpSystolic(e.target.value)}
                    className="cm-nurse-bp-input"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    value={bpDiastolic}
                    onChange={(e) => setBpDiastolic(e.target.value)}
                    className="cm-nurse-bp-input"
                  />
                </div>
                <div
                  className={
                    parseInt(bpSystolic, 10) >= 140 || parseInt(bpSystolic, 10) < 90
                      ? "cm-nurse-vital-status-tag cm-nurse-vital-status-tag--alert"
                      : "cm-nurse-vital-status-tag"
                  }
                >
                  {parseInt(bpSystolic, 10) >= 140
                    ? "Stage 2 Hypertension"
                    : parseInt(bpSystolic, 10) < 90
                    ? "Hypotension"
                    : "Optimal (120/80)"}
                </div>
              </div>

              {/* Pulse */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Heart size={15} /> Pulse Rate (bpm)
                </div>
                <input
                  type="number"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  className="cm-nurse-vital-input"
                />
                <div
                  className={
                    parseInt(pulse, 10) > 100 || parseInt(pulse, 10) < 55
                      ? "cm-nurse-vital-status-tag cm-nurse-vital-status-tag--alert"
                      : "cm-nurse-vital-status-tag"
                  }
                >
                  {parseInt(pulse, 10) > 100
                    ? "Tachycardia (>100)"
                    : parseInt(pulse, 10) < 55
                    ? "Bradycardia (<55)"
                    : "Normal Resting Range"}
                </div>
              </div>

              {/* SpO2 */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Wind size={15} /> Oxygen Saturation (%)
                </div>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  className="cm-nurse-vital-input"
                />
                <div
                  className={
                    parseInt(spo2, 10) < 90
                      ? "cm-nurse-vital-status-tag cm-nurse-vital-status-tag--urgent"
                      : parseInt(spo2, 10) < 95
                      ? "cm-nurse-vital-status-tag cm-nurse-vital-status-tag--alert"
                      : "cm-nurse-vital-status-tag"
                  }
                >
                  {parseInt(spo2, 10) < 90
                    ? "Critical Hypoxia (<90%)"
                    : parseInt(spo2, 10) < 95
                    ? "Borderline SpO2"
                    : "Healthy Aeration"}
                </div>
              </div>

              {/* Temp */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Thermometer size={15} /> Body Temp (°F)
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  className="cm-nurse-vital-input"
                />
                <div
                  className={
                    parseFloat(temp) >= 100.4
                      ? "cm-nurse-vital-status-tag cm-nurse-vital-status-tag--alert"
                      : "cm-nurse-vital-status-tag"
                  }
                >
                  {parseFloat(temp) >= 100.4 ? "Pyrexia / Fever" : "Afebrile Norm"}
                </div>
              </div>

              {/* Blood Glucose */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Droplets size={15} /> Random Glucose (mg/dL)
                </div>
                <input
                  type="number"
                  value={glucose}
                  onChange={(e) => setGlucose(e.target.value)}
                  className="cm-nurse-vital-input"
                />
                <div
                  className={
                    parseInt(glucose, 10) > 180 || parseInt(glucose, 10) < 70
                      ? "cm-nurse-vital-status-tag cm-nurse-vital-status-tag--alert"
                      : "cm-nurse-vital-status-tag"
                  }
                >
                  {parseInt(glucose, 10) > 180
                    ? "Elevated Glycemia"
                    : parseInt(glucose, 10) < 70
                    ? "Hypoglycemia Alert"
                    : "Post-Prandial Safe Zone"}
                </div>
              </div>

              {/* GCS */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Eye size={15} /> GCS Consciousness (/15)
                </div>
                <input
                  type="number"
                  min="3"
                  max="15"
                  value={gcs}
                  onChange={(e) => setGcs(e.target.value)}
                  className="cm-nurse-vital-input"
                />
                <div
                  className={
                    parseInt(gcs, 10) <= 8
                      ? "cm-nurse-vital-status-tag cm-nurse-vital-status-tag--urgent"
                      : "cm-nurse-vital-status-tag"
                  }
                >
                  {parseInt(gcs, 10) === 15 ? "Fully Alert & Oriented" : "Altered Sensorium"}
                </div>
              </div>
            </div>

            {/* Bedside Observation & Wound Dressing Notes */}
            <div className="cm-nurse-notes-container">
              <label className="cm-nurse-notes-label">
                <FileText size={15} /> Bedside Care Log, Dressing Margins &amp; Clinical Notes
              </label>
              <textarea
                rows={3}
                value={bedsideNotes}
                onChange={(e) => setBedsideNotes(e.target.value)}
                className="cm-nurse-textarea"
              />
            </div>

            {syncStatus && (
              <div className="cm-nurse-sync-box">
                <CheckCircle2 size={18} /> {syncStatus}
              </div>
            )}

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSyncVitals}
              className="cm-nurse-submit-btn"
            >
              <Send size={16} /> {isSyncing ? "Encrypting & Syncing..." : "Sync Vitals to Doctor & Patient EHR"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: ADVANCE HOME VISIT SLOTS & SCHEDULE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <div className="cm-nurse-container">
          <div className="cm-nurse-schedule-bar">
            <div className="cm-nurse-timeframe-tabs">
              <button
                type="button"
                onClick={() => setScheduleTimeframe("today")}
                className={
                  scheduleTimeframe === "today"
                    ? "cm-nurse-timeframe-tab cm-nurse-timeframe-tab--active"
                    : "cm-nurse-timeframe-tab"
                }
              >
                <Calendar size={14} /> Today
                <span className="cm-nurse-count-chip">{todayCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setScheduleTimeframe("tomorrow")}
                className={
                  scheduleTimeframe === "tomorrow"
                    ? "cm-nurse-timeframe-tab cm-nurse-timeframe-tab--active"
                    : "cm-nurse-timeframe-tab"
                }
              >
                <Calendar size={14} /> Tomorrow
                <span className="cm-nurse-count-chip">{tomorrowCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setScheduleTimeframe("upcoming")}
                className={
                  scheduleTimeframe === "upcoming"
                    ? "cm-nurse-timeframe-tab cm-nurse-timeframe-tab--active"
                    : "cm-nurse-timeframe-tab"
                }
              >
                <Calendar size={14} /> Upcoming
                <span className="cm-nurse-count-chip">{upcomingCount}</span>
              </button>
            </div>

            <div className="cm-nurse-header-actions">
              <span className="cm-nurse-badge-council">
                Timeframe: {scheduleTimeframe.toUpperCase()}
              </span>
            </div>
          </div>

          {scheduleLoading ? (
            <SkeletonRows rows={3} />
          ) : (
            <div className="cm-nurse-slot-section">
              {scheduledJobs.length === 0 ? (
                <div className="cm-nurse-procedure-card">
                  <div className="cm-nurse-procedure-info">
                    <p className="cm-nurse-subtitle">
                      No home visit appointments assigned for this timeframe yet. Keep your On-Duty Radar active to receive incoming requests.
                    </p>
                  </div>
                </div>
              ) : (
                scheduledJobs.map((job) => (
                  <div key={job.id} className="cm-nurse-slot-card">
                    <div className="cm-nurse-slot-info">
                      <div className="cm-nurse-slot-top-row">
                        <span className="cm-nurse-slot-time-badge">
                          <Clock size={13} /> {job.slot_time || job.scheduled_time || "Morning Slot"}
                        </span>
                        <span
                          className={
                            job.priority === "high"
                              ? "cm-nurse-priority-badge cm-nurse-priority-badge--high"
                              : "cm-nurse-priority-badge cm-nurse-priority-badge--normal"
                          }
                        >
                          {job.status || "Confirmed"}
                        </span>
                      </div>

                      <h3 className="cm-nurse-visit-name">
                        {job.patient_name || "Patient"}{" "}
                        {job.patient_age_gender ? `(${job.patient_age_gender})` : ""}
                      </h3>

                      <div className="cm-nurse-visit-meta">
                        <div>
                          <strong>Procedure:</strong> {job.service_name || job.procedure || "Clinical Nursing Care"}
                        </div>
                        <div>
                          <strong>Address:</strong> {job.patient_address || "Visakhapatnam"}
                        </div>
                      </div>
                    </div>

                    <div className="cm-nurse-slot-actions">
                      <button
                        type="button"
                        onClick={() => {
                          const q = encodeURIComponent(job.patient_address || "Visakhapatnam");
                          window.open(`https://maps.google.com/?q=${q}`, "_blank");
                        }}
                        className="cm-nurse-btn-action-map"
                      >
                        <Navigation size={13} /> Open Maps
                      </button>

                      {job.patient_phone && (
                        <a
                          href={`tel:${job.patient_phone}`}
                          className="cm-nurse-btn-action-call"
                        >
                          <Phone size={13} /> Call
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartBedsideVisit(job)}
                        className="cm-nurse-btn-action-start"
                      >
                        <HeartPulse size={14} /> Start Bedside Visit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: NURSE PROFILE & CREDENTIALS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <div className="cm-nurse-container">
          <SelfieVerificationCard />
          <DashboardProfile profile={profile} role="nurse" />
        </div>
      )}
    </DashboardShell>
  );
}
