"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardShell, { SkeletonRows } from "../components/DashboardShell";
import ProviderSchedulePanel from "../components/ProviderSchedulePanel";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
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
    status: b.status,
    meet_link: `/dashboard/doctor/consult/${b.id}`,
    address: b.collection_address || b.address || "",
  };
}

export default function PhysiotherapistDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("sessions");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Scope & Tariffs state
  const [scopeList, setScopeList] = useState<ScopeItem[]>([]);
  const [consultFee, setConsultFee] = useState(400);
  const [homeVisitFee, setHomeVisitFee] = useState(800);
  const [savingScope, setSavingScope] = useState(false);
  const [scopeSuccessMsg, setScopeSuccessMsg] = useState("");

  // Clinical Rehabilitation Studio state
  const [evalPatient, setEvalPatient] = useState("");
  const [jointAssessed, setJointAssessed] = useState("Knee");
  const [romFlexion, setRomFlexion] = useState("110");
  const [vasPainScore, setVasPainScore] = useState(6);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  // Active Therapy Sessions Queue
  const [sessions, setSessions] = useState<any[]>([]);

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
        if (meData.success && meData.data.role === "physiotherapist") {
          setProfile(meData.data);
        } else {
          router.push("/");
          return;
        }

        const scopeRes = await fetch(`${apiBase}/api/providers/scope/physiotherapist`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const scopeData = await scopeRes.json();
        if (scopeData.success && scopeData.data?.scope) {
          setScopeList(scopeData.data.scope);
        } else {
          setScopeList([
            {
              id: "scope-pt-1",
              service_name: "Tele-Rehab Musculoskeletal Assessment",
              category: "physiotherapy",
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
              category: "physiotherapy",
              modality: "home_visit",
              benchmark_price: 800,
              custom_price: 800,
              platform_fee_amount: 160,
              provider_share_amount: 640,
              is_active: true,
            },
            {
              id: "scope-pt-3",
              service_name: "Neuro-Rehabilitation & Gait Training",
              category: "physiotherapy",
              modality: "home_visit",
              benchmark_price: 1200,
              custom_price: 1200,
              platform_fee_amount: 240,
              provider_share_amount: 960,
              is_active: true,
            },
          ]);
        }

        try {
          const bRes = await fetch(`${apiBase}/api/bookings/provider/today`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const bData = await bRes.json();
          if (bData.success && Array.isArray(bData.data?.bookings)) {
            setSessions(bData.data.bookings.map(bookingToQueueItem));
          } else {
            setSessions([]);
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
        setScopeSuccessMsg("Tariffs & Scope updated with guaranteed 80% net take-home calculation.");
        setTimeout(() => setScopeSuccessMsg(""), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingScope(false);
    }
  };

  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratedReport({
      patient: evalPatient || "Clinical Patient",
      joint: jointAssessed,
      rom: `${romFlexion}° Flexion`,
      vas: `${vasPainScore}/10`,
      exercises: [
        "Passive knee extension stretch with heel prop (3x 30s)",
        "Quad sets with towel roll isometric contraction (3 sets of 10 reps)",
        "Straight leg raises with 2s hold at peak (3 sets of 10 reps)",
        "Patellar mobilizations (superior and inferior glides)",
      ],
      notes: clinicalNotes || "Patient tolerated session well. Guard against hyperextension during weight bearing.",
      timestamp: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    });
  };

  const TABS = [
    { id: "sessions", label: "Therapy Queue", icon: Calendar },
    { id: "schedule", label: "Slots & Availability", icon: Calendar },
    { id: "dispatch", label: "Doorstep Visits", icon: MapPin },
    { id: "clinical_eval", label: "ROM & Pain Evaluation", icon: Activity },
    { id: "scope_tariffs", label: "Services & Tariffs (80/20)", icon: Sliders },
    { id: "profile", label: "Practitioner Profile", icon: User },
  ];

  if (loading) {
    return (
      <DashboardShell role="physiotherapist" title="Rehabilitation Station" subtitle="Loading clinical queue..." tabs={[]} activeTab="" onTabChange={() => {}}>
        <SkeletonRows rows={4} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="physiotherapist"
      title="Physiotherapy &amp; Rehabilitation Station"
      subtitle={`${profile?.full_name || "Physiotherapist"} · Bedside Mobilization, Tele-Rehab &amp; 80/20 Commercial Split`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ─── TAB 1: SESSIONS & QUEUE ─── */}
      <div className={activeTab === "sessions" ? "" : "tab-panel-hidden"}>
        <div className="cm-metric-strip">
          <div className="cm-metric-card">
            <div className="cm-metric-card__label">Today&apos;s Therapy Sessions</div>
            <div className="cm-metric-card__value">3 Active</div>
            <div className="cm-metric-card__meta" style={{ color: "var(--cm-done)" }}>
              <CheckCircle2 size={13} /> 2 Bedside Visits + 1 Tele-Rehab
            </div>
          </div>
          <div className="cm-metric-card">
            <div className="cm-metric-card__label">Tele-Rehab Rate</div>
            <div className="cm-metric-card__value" style={{ color: "var(--cm-active)" }}>₹{consultFee}</div>
            <div className="cm-metric-card__meta">
              Your Net Take-Home (80%): <strong>₹{Math.round(consultFee * 0.8)}</strong>
            </div>
          </div>
          <div className="cm-metric-card">
            <div className="cm-metric-card__label">Home Healthcare Visit Rate</div>
            <div className="cm-metric-card__value" style={{ color: "var(--cm-done)" }}>₹{homeVisitFee}</div>
            <div className="cm-metric-card__meta">
              Your Net Take-Home (80%): <strong>₹{Math.round(homeVisitFee * 0.8)}</strong>
            </div>
          </div>
        </div>

        <div className="cm-clinical-section" style={{ padding: "var(--cm-5)" }}>
          <h3 style={{ margin: "0 0 var(--cm-4) 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
            Today&apos;s Physiotherapy Sessions Queue
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
            {sessions.length === 0 && (
              <div className="cm-empty" style={{ padding: "var(--cm-5)" }}>
                <p className="cm-empty__title">No Therapy Sessions Booked for Today</p>
                <p className="cm-empty__body">Bookings will appear here when scheduled by patients.</p>
              </div>
            )}
            {sessions.map((item) => (
              <div
                key={item.id}
                className="cm-card"
                style={{
                  border: "1px solid var(--cm-line)",
                  borderRadius: "var(--cm-radius)",
                  padding: "var(--cm-4) var(--cm-5)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--cm-3)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: "var(--cm-text-base)", color: "var(--cm-ink)" }}>{item.patient_name}</span>
                    <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                      ({item.age}y · {item.gender})
                    </span>
                    <span className={`cm-pill ${item.modality === "online" ? "cm-pill--active" : "cm-pill--waiting"}`}>
                      {item.modality === "online" ? "Tele-Rehab" : "Doorstep Therapy"}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-2)", marginTop: 4 }}>
                    Diagnosis: <strong>{item.condition}</strong>
                  </div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={13} /> Scheduled: {item.time}
                    {item.address && <span>· {item.address}</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "var(--cm-2)", alignItems: "center" }}>
                  {item.modality === "online" ? (
                    <a
                      href={item.meet_link}
                      className="cm-btn cm-btn--primary cm-btn--sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                    >
                      <Video size={14} /> Start Video Session
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("dispatch")}
                      className="cm-btn cm-btn--primary cm-btn--sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
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
            ))}
          </div>
        </div>
      </div>

      {/* ─── TAB 2: LIVE DOORSTEP DISPATCH ─── */}
      <div className={activeTab === "dispatch" ? "" : "tab-panel-hidden"}>
        <ProviderDispatchTracker
          title="Doorstep Physiotherapy Visits"
          providerType="physiotherapist"
          earningsRate={640}
          embedded={true}
        />
      </div>

      {/* ─── TAB 3: ROM & CLINICAL EVALUATION STUDIO ─── */}
      <div className={activeTab === "clinical_eval" ? "" : "tab-panel-hidden"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--cm-5)" }}>
          {/* Eval Form */}
          <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
            <h3 style={{ margin: "0 0 var(--cm-4) 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={18} style={{ color: "var(--cm-active)" }} /> Rehabilitation Assessment Studio
            </h3>
            <form onSubmit={handleGenerateReport}>
              <div style={{ marginBottom: "var(--cm-3)" }}>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Patient Name
                </label>
                <input
                  type="text"
                  value={evalPatient}
                  onChange={(e) => setEvalPatient(e.target.value)}
                  placeholder="e.g. Amitabh Sen"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-sm)" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cm-3)", marginBottom: "var(--cm-3)" }}>
                <div>
                  <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                    Joint / Region
                  </label>
                  <select
                    value={jointAssessed}
                    onChange={(e) => setJointAssessed(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-sm)" }}
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
                  <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                    Active ROM (degrees)
                  </label>
                  <input
                    type="number"
                    value={romFlexion}
                    onChange={(e) => setRomFlexion(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-sm)" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "var(--cm-3)" }}>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Visual Analog Scale (VAS) Pain Score: <strong>{vasPainScore}/10</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={vasPainScore}
                  onChange={(e) => setVasPainScore(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: vasPainScore > 6 ? "var(--cm-urgent)" : "var(--cm-active)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                  <span>0 - No Pain</span>
                  <span>5 - Moderate</span>
                  <span>10 - Severe Intolerable</span>
                </div>
              </div>

              <div style={{ marginBottom: "var(--cm-4)" }}>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Practitioner Clinical Notes &amp; Precautions
                </label>
                <textarea
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="e.g. Mild effusion noted. Guard against hyperextension during weight bearing."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-sm)" }}
                />
              </div>

              <button
                type="submit"
                className="cm-btn cm-btn--primary"
                style={{ width: "100%", padding: "10px", fontWeight: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
              >
                <Sparkles size={16} /> Record Evaluation &amp; Issue Protocol
              </button>
            </form>
          </div>

          {/* Generated Report Preview */}
          <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
            <h3 style={{ margin: "0 0 var(--cm-4) 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
              Rehabilitation Case Sheet
            </h3>
            {generatedReport ? (
              <div style={{ border: "1px solid var(--cm-active-line)", borderRadius: "var(--cm-radius)", padding: "var(--cm-4)", backgroundColor: "var(--cm-active-surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cm-active-line)", paddingBottom: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "var(--cm-text-base)", color: "var(--cm-active)" }}>{generatedReport.patient}</div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)" }}>Region: {generatedReport.joint}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                    <div>Date: {generatedReport.timestamp}</div>
                    <div style={{ fontWeight: 700, color: "var(--cm-urgent)" }}>Pain: {generatedReport.vas}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <span className="cm-pill cm-pill--active" style={{ background: "var(--cm-surface)" }}>
                    ROM: {generatedReport.rom}
                  </span>
                  <span className="cm-pill cm-pill--active" style={{ background: "var(--cm-surface)" }}>
                    Protocol: Post-Op Rehab
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)" }}>
                  <div style={{ fontWeight: 700, color: "var(--cm-navy)" }}>Prescribed Exercise Routine:</div>
                  {generatedReport.exercises.map((ex: string, i: number) => (
                    <div key={i} style={{ borderBottom: "1px dashed var(--cm-line)", paddingBottom: 4 }}>
                      • {ex}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", fontStyle: "italic" }}>
                  <strong>Notes:</strong> {generatedReport.notes}
                </div>
              </div>
            ) : (
              <div className="cm-empty" style={{ padding: "var(--cm-5)" }}>
                <Activity size={32} style={{ color: "var(--cm-line-strong)", margin: "0 auto 8px" }} />
                <p className="cm-empty__title" style={{ fontSize: "var(--cm-text-sm)" }}>No Assessment Recorded</p>
                <p className="cm-empty__body" style={{ fontSize: "var(--cm-text-xs)" }}>
                  Fill the rehabilitation assessment form on the left to record active range of motion and prescribe an exercise regimen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TAB 4: SCOPE OF SERVICES & TARIFFS (80/20) ─── */}
      <div className={activeTab === "scope_tariffs" ? "" : "tab-panel-hidden"}>
        <div className="cm-clinical-section" style={{ padding: "var(--cm-5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Physiotherapy Scope of Services &amp; Tariff Management (80/20 Commercial Split)
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Autonomously configure your accepted procedures, modalities, and tariffs. CallMedex retains a flat 20% platform charge; 80% is credited directly to you.
              </p>
            </div>
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

          {scopeSuccessMsg && (
            <div className="cm-pill cm-pill--done" style={{ width: "100%", padding: "10px 14px", marginBottom: "var(--cm-4)", justifyContent: "flex-start" }}>
              {scopeSuccessMsg}
            </div>
          )}

          {/* Quick Rates Card */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cm-4)", marginBottom: "var(--cm-5)" }}>
            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)", marginBottom: 4 }}>
                Tele-Rehab Video Assessment Fee (₹)
              </label>
              <input
                type="number"
                value={consultFee}
                onChange={(e) => setConsultFee(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontWeight: 700 }}
              />
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", marginTop: 4, fontWeight: 700 }}>
                You Receive: ₹{Math.round(consultFee * 0.8)} · Platform Fee (20%): ₹{Math.round(consultFee * 0.2)}
              </div>
            </div>

            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)", marginBottom: 4 }}>
                Doorstep Bedside Session Fee (₹)
              </label>
              <input
                type="number"
                value={homeVisitFee}
                onChange={(e) => setHomeVisitFee(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontWeight: 700 }}
              />
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", marginTop: 4, fontWeight: 700 }}>
                You Receive: ₹{Math.round(homeVisitFee * 0.8)} · Platform Fee (20%): ₹{Math.round(homeVisitFee * 0.2)}
              </div>
            </div>
          </div>

          {/* Scope Catalog List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-2)" }}>
            {scopeList.map((item, idx) => (
              <div
                key={item.id}
                className="cm-card"
                style={{
                  border: item.is_active ? "1px solid var(--cm-active-line)" : "1px solid var(--cm-line)",
                  borderRadius: "var(--cm-radius)",
                  padding: "var(--cm-3) var(--cm-4)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--cm-3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    onChange={() => handleToggleService(idx)}
                    style={{ width: 18, height: 18, accentColor: "var(--cm-active)", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)" }}>{item.service_name}</div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                      Category: {item.category} · Modality: {item.modality.toUpperCase()} · Benchmark: ₹{item.benchmark_price}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Custom Tariff (₹)</label>
                    <input
                      type="number"
                      disabled={!item.is_active}
                      value={item.custom_price}
                      onChange={(e) => handlePriceUpdate(idx, parseFloat(e.target.value))}
                      style={{ width: 80, padding: "4px 8px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Platform (20%): ₹{item.platform_fee_amount}</div>
                    <div style={{ fontSize: "var(--cm-text-sm)", fontWeight: 800, color: "var(--cm-done)" }}>
                      You Get (80%): ₹{item.provider_share_amount}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── TAB 5: PROFILE ─── */}
      <div className={activeTab === "schedule" ? "" : "tab-panel-hidden"}>
        <ProviderSchedulePanel roleLabel="physiotherapy practice" />
      </div>

      <div className={activeTab === "profile" ? "" : "tab-panel-hidden"}>
        <DashboardProfile profile={profile} role="physiotherapist" />
      </div>
    </DashboardShell>
  );
}
