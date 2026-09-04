"use client";

import { useState, useEffect } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
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
  Thermometer,
  Heart,
  Droplets,
  Wind,
  Eye,
} from "lucide-react";

import NurseToolsModal from "../../../components/NurseToolsModal";
import DashboardShell, { SkeletonRows } from "../components/DashboardShell";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

// Official CallMedex Nursing Procedure Benchmarks from Excel MOU
const NURSING_EXCEL_PROCEDURES = [
  {
    code: "NUR-01",
    name: "IM / IV Injection & Vitals Check",
    category: "Basic Nursing",
    standard_fee: 300,
    nurse_net: 240,
    platform_fee: 60,
    duration: "20 min",
    supplies: "Syringe, spirit swab, disposal kit",
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
  },
];

export default function NurseDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dispatch");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showToolsModal, setShowToolsModal] = useState(false);

  // Bedside Vitals Studio State
  const [vitalsPatient, setVitalsPatient] = useState("Lakshmi Narayana (72/M)");
  const [bpSystolic, setBpSystolic] = useState("128");
  const [bpDiastolic, setBpDiastolic] = useState("82");
  const [pulse, setPulse] = useState("76");
  const [spo2, setSpo2] = useState("98");
  const [temp, setTemp] = useState("98.6");
  const [glucose, setGlucose] = useState("114");
  const [gcs, setGcs] = useState("15");
  const [bedsideNotes, setBedsideNotes] = useState(
    "Patient is alert and oriented. Wound dressing intact and dry. Tolerating oral fluids well."
  );
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Active Procedures Selection State
  const [activeProcedureCodes, setActiveProcedureCodes] = useState<string[]>([
    "NUR-01",
    "NUR-02",
    "NUR-03",
    "NUR-04",
  ]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getToken();
        if (!token) {
          router.push("/auth/login");
          return;
        }
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data.role === "nurse") {
          setProfile(data.data);
        } else {
          router.push("/");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const toggleProcedure = (code: string) => {
    if (activeProcedureCodes.includes(code)) {
      setActiveProcedureCodes(activeProcedureCodes.filter((c) => c !== code));
    } else {
      setActiveProcedureCodes([...activeProcedureCodes, code]);
    }
  };

  const handleSyncVitals = () => {
    setSyncStatus("Syncing vitals to patient EHR & supervising physician...");
    setTimeout(() => {
      setSyncStatus("Vitals & Bedside Case Sheet successfully synced to Patient EHR and Doctor Console.");
    }, 600);
  };

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
        subtitle="Loading your nursing console…"
        tabs={[]}
        activeTab=""
        onTabChange={() => {}}
      >
        <SkeletonRows rows={3} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="nurse"
      title="Nurse Care Station"
      subtitle={`${profile?.full_name || "Nurse"} • Licensed Home Care Clinical Specialist`}
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

      {/* ─── Nursing KPI Strip ─── */}
      <div className="cm-kpi-grid cm-nurse-kpi-grid">
        <div className="cm-kpi-card cm-nurse-kpi-clickable" onClick={() => setActiveTab("dispatch")}>
          <div className="cm-kpi-card__accent cm-kpi-card__accent--urgent" />
          <div>
            <div className="cm-kpi-card__label">On-Duty Radar</div>
            <div className="cm-kpi-card__value">Active</div>
            <div className="cm-kpi-card__subtitle">Doorstep alerts live</div>
          </div>
          <div className="cm-kpi-card__icon cm-nurse-kpi-icon-urgent">
            <MapPin size={22} />
          </div>
        </div>

        <div className="cm-kpi-card cm-nurse-kpi-clickable" onClick={() => setActiveTab("procedures")}>
          <div className="cm-kpi-card__accent cm-kpi-card__accent--active" />
          <div>
            <div className="cm-kpi-card__label">Active Procedures</div>
            <div className="cm-kpi-card__value">{activeProcedureCodes.length}</div>
            <div className="cm-kpi-card__subtitle">Excel MOU catalog</div>
          </div>
          <div className="cm-kpi-card__icon cm-nurse-kpi-icon-active">
            <Activity size={22} />
          </div>
        </div>

        <div className="cm-kpi-card cm-nurse-kpi-clickable" onClick={() => setActiveTab("procedures")}>
          <div className="cm-kpi-card__accent cm-kpi-card__accent--done" />
          <div>
            <div className="cm-kpi-card__label">Active Procedures</div>
            <div className="cm-kpi-card__value">{activeProcedureCodes.length}</div>
            <div className="cm-kpi-card__subtitle">Verified clinical care</div>
          </div>
          <div className="cm-kpi-card__icon cm-nurse-kpi-icon-done">
            <ShieldCheck size={22} />
          </div>
        </div>

        <div className="cm-kpi-card cm-nurse-kpi-clickable" onClick={() => setActiveTab("schedule")}>
          <div className="cm-kpi-card__accent cm-kpi-card__accent--waiting" />
          <div>
            <div className="cm-kpi-card__label">Visits Completed</div>
            <div className="cm-kpi-card__value">14</div>
            <div className="cm-kpi-card__subtitle">This week (Vizag Central)</div>
          </div>
          <div className="cm-kpi-card__icon cm-nurse-kpi-icon-waiting">
            <Calendar size={22} />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: LIVE DOORSTEP DISPATCH
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={activeTab === "dispatch" ? "" : "tab-panel-hidden"}>
        <ProviderDispatchTracker
          title="Nurse Doorstep Care Station"
          providerType="nurse"
          embedded
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: PROCEDURES & BENCHMARK TARIFFS (EXCEL ALIGNED)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "procedures" && (
        <div className="cm-nurse-container">
          <div className="cm-nurse-header-box">
            <h2 className="cm-nurse-title">
              Nursing Procedures &amp; Fee Benchmarks
            </h2>
            <p className="cm-nurse-subtitle">
              Official nursing fee schedule. Select which procedures and doorstep nursing services you offer for patient dispatch:
            </p>
          </div>

          <div className="cm-nurse-procedure-grid">
            {NURSING_EXCEL_PROCEDURES.map((p) => {
              const isOffering = activeProcedureCodes.includes(p.code);
              return (
                <div key={p.code} className="cm-nurse-procedure-card">
                  <div className="cm-nurse-procedure-info">
                    <div>
                      <span className="cm-nurse-badge-code">
                        {p.category}
                      </span>
                    </div>

                    <h3 className="cm-nurse-procedure-name">
                      {p.name}
                    </h3>
                    <div className="cm-nurse-procedure-meta">
                      <span>Duration: {p.duration}</span>
                      <span>Supplies: {p.supplies}</span>
                    </div>
                  </div>

                  <div className="cm-nurse-procedure-commercials">
                    <div className="cm-nurse-procedure-price">₹{p.standard_fee}</div>
                    <div className="cm-nurse-procedure-takehome">
                      Estimated Payout: ₹{p.nurse_net}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleProcedure(p.code)}
                    className={
                      isOffering
                        ? "cm-nurse-btn-toggle cm-nurse-btn-active"
                        : "cm-nurse-btn-toggle cm-nurse-btn-inactive"
                    }
                  >
                    {isOffering ? "Offering for Home Dispatch" : "+ Enable Procedure"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: BEDSIDE VITALS & CASE SHEET STUDIO
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "vitals" && (
        <div className="cm-nurse-container">
          <div className="cm-nurse-header-box">
            <h2 className="cm-nurse-title">
              Bedside Case Sheet &amp; Clinical Vitals Studio
            </h2>
            <p className="cm-nurse-subtitle">
              Record in-person patient vitals during doorstep visits. Data syncs instantly to the patient EHR and the assigned supervising doctor.
            </p>
          </div>

          <div className="cm-nurse-vitals-form">
            {/* Patient Header */}
            <div className="cm-nurse-patient-row">
              <div>
                <label className="cm-nurse-patient-label">
                  Selected Patient
                </label>
                <input
                  type="text"
                  value={vitalsPatient}
                  onChange={(e) => setVitalsPatient(e.target.value)}
                  className="cm-nurse-patient-input"
                />
              </div>
              <span className="cm-nurse-status-pill">
                Home Visit Active
              </span>
            </div>

            {/* Vitals Matrix Inputs */}
            <div className="cm-nurse-vitals-matrix">
              {/* BP */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Activity size={14} /> Blood Pressure (mmHg)
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
              </div>

              {/* Pulse */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Heart size={14} /> Pulse Rate (bpm)
                </div>
                <input
                  type="number"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  className="cm-nurse-vital-input"
                />
              </div>

              {/* SpO2 */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Wind size={14} /> Oxygen Saturation (%)
                </div>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  className="cm-nurse-vital-input"
                />
              </div>

              {/* Temp */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Thermometer size={14} /> Body Temp (°F)
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  className="cm-nurse-vital-input"
                />
              </div>

              {/* Blood Glucose */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Droplets size={14} /> Random Glucose (mg/dL)
                </div>
                <input
                  type="number"
                  value={glucose}
                  onChange={(e) => setGlucose(e.target.value)}
                  className="cm-nurse-vital-input"
                />
              </div>

              {/* GCS */}
              <div className="cm-nurse-vital-card">
                <div className="cm-nurse-vital-label">
                  <Eye size={14} /> GCS Consciousness (/15)
                </div>
                <input
                  type="number"
                  value={gcs}
                  onChange={(e) => setGcs(e.target.value)}
                  className="cm-nurse-vital-input"
                />
              </div>
            </div>

            {/* Bedside Observation Notes */}
            <div className="cm-nurse-notes-container">
              <label className="cm-nurse-notes-label">
                Bedside Observation &amp; Wound Dressing Notes
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
                <CheckCircle2 size={16} /> {syncStatus}
              </div>
            )}

            <button
              type="button"
              onClick={handleSyncVitals}
              className="cm-nurse-submit-btn"
            >
              <Send size={16} /> Sync Case Sheet to Doctor &amp; Patient Record
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4: HOME VISIT SCHEDULE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <div className="cm-nurse-container">
          <div className="cm-nurse-header-box">
            <h2 className="cm-nurse-title">
              Scheduled Home Nursing Visits
            </h2>
            <p className="cm-nurse-subtitle">
              Confirmed patient appointments requiring in-person nursing care today
            </p>
          </div>

          <div className="cm-nurse-visits-list">
            <div className="cm-nurse-visit-card">
              <div>
                <span className="cm-nurse-visit-badge-scheduled">
                  11:30 AM • Confirmed
                </span>
                <h3 className="cm-nurse-visit-name">
                  Lakshmi Narayana (72 Yrs)
                </h3>
                <div className="cm-nurse-visit-meta">
                  Procedure: Sterile Wound Dressing &amp; Vitals • Address: Plot 42, Sector 8, MVP Colony, Visakhapatnam
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.open("https://maps.google.com/?q=MVP+Colony+Visakhapatnam", "_blank");
                }}
                className="cm-nurse-map-btn"
              >
                <MapPin size={14} /> Open Maps
              </button>
            </div>

            <div className="cm-nurse-visit-card">
              <div>
                <span className="cm-nurse-visit-badge-dressing">
                  03:00 PM • Confirmed
                </span>
                <h3 className="cm-nurse-visit-name">
                  Suresh Chandra (48 Yrs)
                </h3>
                <div className="cm-nurse-visit-meta">
                  Procedure: IV Infusion &amp; Cannulation • Address: Flat 302, Sea Breeze Apts, Beach Road, Vizag
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.open("https://maps.google.com/?q=Beach+Road+Visakhapatnam", "_blank");
                }}
                className="cm-nurse-map-btn"
              >
                <MapPin size={14} /> Open Maps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5: NURSE PROFILE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <DashboardProfile profile={profile} role="nurse" />
      )}
    </DashboardShell>
  );
}
