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
  AlertCircle,
  FileText,
  DollarSign,
  Percent,
  Plus,
  ArrowRight,
  ShieldCheck,
  HeartPulse,
  RotateCw,
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


// Map a real booking row into the queue item this panel renders.
// This queue used to be a hardcoded array of invented patients ("Amitabh Sen",
// "Kavitha R.", ...) with a meet link pointing at /telemed/room/<id>, a route
// that does not exist. A provider must only ever see their own real sessions.
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
  const [treatmentProtocol, setTreatmentProtocol] = useState("orthopedic");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  // Active Therapy Sessions Queue
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const fetchPhysioData = async () => {
      try {
        const token = getToken();
        if (!token) {
          router.push("/auth/login");
          return;
        }

        // Fetch profile
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && (data.data.role === "physiotherapist" || data.data.role === "admin")) {
          setProfile(data.data);
        } else {
          router.push("/");
          return;
        }

        // Fetch Scope & Tariffs
        const scopeRes = await fetch(`${apiBase}/api/providers/me/scope`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const scopeData = await scopeRes.json();
        if (scopeData.success && scopeData.data) {
          setScopeList(scopeData.data.scope_of_services || []);
          setConsultFee(scopeData.data.consultation_fee || 400);
          setHomeVisitFee(scopeData.data.home_visit_fee || 800);
        }

        // Today's real appointments for this provider.
        const apptRes = await fetch(`${apiBase}/api/bookings/provider/today`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (apptRes.ok) {
          const apptData = await apptRes.json();
          if (apptData.success) {
            setSessions((apptData.data?.bookings || []).map(bookingToQueueItem));
          }
        }
      } catch (err) {
        console.error("Error fetching physiotherapist dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPhysioData();
  }, [router]);

  const handlePriceUpdate = (index: number, newPrice: number) => {
    const valid = Math.max(0, isNaN(newPrice) ? 0 : newPrice);
    setScopeList((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        custom_price: valid,
        platform_fee_amount: Math.round(valid * 0.2),
        provider_share_amount: Math.round(valid * 0.8),
      };
      return copy;
    });
  };

  const handleToggleService = (index: number) => {
    setScopeList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], is_active: !copy[index].is_active };
      return copy;
    });
  };

  const saveScopeChanges = async () => {
    setSavingScope(true);
    setScopeSuccessMsg("");
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/me/scope`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope_of_services: scopeList,
          consultation_fee: consultFee,
          home_visit_fee: homeVisitFee,
          available_for_online: true,
          available_for_home_visit: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScopeSuccessMsg("Physiotherapy scope of services and tariffs saved successfully!");
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
      patient: evalPatient || "Rehabilitation Patient",
      joint: jointAssessed,
      rom: `${romFlexion}° Flexion`,
      vas: `${vasPainScore}/10 (Visual Analog Scale)`,
      protocol: treatmentProtocol.toUpperCase(),
      exercises: [
        "Passive / Active-Assisted Range of Motion (3 sets of 10 reps)",
        "Isometric quadriceps and hamstring sets with 5-second holds",
        "Proprioceptive balance board training (10 minutes)",
        "Cryotherapy / Icing for 15 minutes post session",
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
      title="Physiotherapy & Rehabilitation Station"
      subtitle={`${profile?.full_name || "Physiotherapist"} — Bedside Mobilization, Tele-Rehab & 80/20 Commercial Split`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ─── TAB 1: SESSIONS & QUEUE ─── */}
      <div className={activeTab === "sessions" ? "" : "tab-panel-hidden"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div style={{ backgroundColor: "white", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Today&apos;s Therapy Sessions</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginTop: 4 }}>3 Active</div>
            <div style={{ fontSize: "0.78rem", color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={14} /> 2 Bedside Visits + 1 Tele-Rehab
            </div>
          </div>
          <div style={{ backgroundColor: "white", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Tele-Rehab Rate</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0284c7", marginTop: 4 }}>₹{consultFee}</div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
              Your Net Take-Home (80%): <strong>₹{Math.round(consultFee * 0.8)}</strong>
            </div>
          </div>
          <div style={{ backgroundColor: "white", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Home Healthcare Visit Rate</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#16a34a", marginTop: 4 }}>₹{homeVisitFee}</div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
              Your Net Take-Home (80%): <strong>₹{Math.round(homeVisitFee * 0.8)}</strong>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
            Today&apos;s Physiotherapy Sessions Queue
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sessions.length === 0 && (
              <div style={{ padding: "28px 20px", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                No therapy sessions booked for today.
              </div>
            )}
            {sessions.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                  backgroundColor: "#ffffff",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>{item.patient_name}</span>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      ({item.age}y • {item.gender})
                    </span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: 999,
                        backgroundColor: item.modality === "online" ? "#eff6ff" : "#fef3c7",
                        color: item.modality === "online" ? "#1d4ed8" : "#92400e",
                      }}
                    >
                      {item.modality === "online" ? "Tele-Rehab" : "Doorstep Therapy"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#334155", marginTop: 4 }}>
                    Diagnosis: <strong>{item.condition}</strong>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={14} /> Scheduled: {item.time}
                    {item.address && <span>• {item.address}</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {item.modality === "online" ? (
                    <a
                      href={item.meet_link}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 16px",
                        backgroundColor: "#0284c7",
                        color: "white",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        textDecoration: "none",
                      }}
                    >
                      <Video size={16} /> Start Video Session
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("dispatch")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 16px",
                        backgroundColor: "#16a34a",
                        color: "white",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: "0.88rem",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <MapPin size={16} /> Doorstep Dispatch
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEvalPatient(item.patient_name);
                      setActiveTab("clinical_eval");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      backgroundColor: "#f1f5f9",
                      color: "#334155",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      border: "1px solid #cbd5e1",
                      cursor: "pointer",
                    }}
                  >
                    <Activity size={15} /> Log ROM &amp; Pain
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {/* Eval Form */}
          <div style={{ backgroundColor: "white", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={20} color="#0284c7" /> Rehabilitation Assessment Studio
            </h3>
            <form onSubmit={handleGenerateReport}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Patient Name
                </label>
                <input
                  type="text"
                  value={evalPatient}
                  onChange={(e) => setEvalPatient(e.target.value)}
                  placeholder="e.g. Amitabh Sen"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Joint / Region
                  </label>
                  <select
                    value={jointAssessed}
                    onChange={(e) => setJointAssessed(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
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
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Active ROM (degrees)
                  </label>
                  <input
                    type="number"
                    value={romFlexion}
                    onChange={(e) => setRomFlexion(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Visual Analog Scale (VAS) Pain Score: <strong>{vasPainScore}/10</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={vasPainScore}
                  onChange={(e) => setVasPainScore(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: vasPainScore > 6 ? "#dc2626" : "#0284c7" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b" }}>
                  <span>0 - No Pain</span>
                  <span>5 - Moderate</span>
                  <span>10 - Severe Intolerable</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Practitioner Clinical Notes &amp; Precautions
                </label>
                <textarea
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="e.g. Mild effusion noted. Instructed on non-weight bearing crutch walking."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#0284c7",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Sparkles size={18} /> Record Evaluation &amp; Issue Protocol
              </button>
            </form>
          </div>

          {/* Generated Report Preview */}
          <div style={{ backgroundColor: "white", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              Rehabilitation Case Sheet
            </h3>
            {generatedReport ? (
              <div style={{ border: "1.5px solid #bae6fd", borderRadius: 10, padding: 18, backgroundColor: "#f0f9ff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #bae6fd", paddingBottom: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0369a1" }}>{generatedReport.patient}</div>
                    <div style={{ fontSize: "0.8rem", color: "#0284c7" }}>Region: {generatedReport.joint}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#0284c7" }}>
                    <div>Date: {generatedReport.timestamp}</div>
                    <div style={{ fontWeight: 700, color: "#dc2626" }}>Pain: {generatedReport.vas}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: "0.8rem", backgroundColor: "white", padding: "4px 8px", borderRadius: 6, border: "1px solid #bae6fd", color: "#0369a1" }}>
                    ROM: {generatedReport.rom}
                  </span>
                  <span style={{ fontSize: "0.8rem", backgroundColor: "white", padding: "4px 8px", borderRadius: 6, border: "1px solid #bae6fd", color: "#0369a1" }}>
                    Protocol: Post-Op Rehab
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.85rem", color: "#0c4a6e" }}>
                  <div style={{ fontWeight: 700 }}>Prescribed Exercise Routine:</div>
                  {generatedReport.exercises.map((ex: string, i: number) => (
                    <div key={i} style={{ borderBottom: "1px dashed #e0f2fe", paddingBottom: 4 }}>
                      • {ex}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, fontSize: "0.8rem", color: "#0369a1", fontStyle: "italic" }}>
                  <strong>Notes:</strong> {generatedReport.notes}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 10px", color: "#64748b" }}>
                <Activity size={36} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  Fill the rehabilitation assessment form on the left to record active range of motion and prescribe an exercise regimen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TAB 4: SCOPE OF SERVICES & TARIFFS (80/20) ─── */}
      <div className={activeTab === "scope_tariffs" ? "" : "tab-panel-hidden"}>
        <div style={{ backgroundColor: "white", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                Physiotherapy Scope of Services &amp; Tariff Management (80/20 Commercial Split)
              </h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b" }}>
                Autonomously configure your accepted procedures, modalities, and tariffs. CallMedex retains a flat 20% platform charge; 80% is credited directly to you.
              </p>
            </div>
            <button
              type="button"
              onClick={saveScopeChanges}
              disabled={savingScope}
              style={{
                padding: "10px 22px",
                backgroundColor: "#0284c7",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                cursor: savingScope ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} /> {savingScope ? "Saving..." : "Save All Tariffs"}
            </button>
          </div>

          {scopeSuccessMsg && (
            <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px", color: "#166534", marginBottom: 20, fontSize: "0.9rem" }}>
              {scopeSuccessMsg}
            </div>
          )}

          {/* Quick Rates Card */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, backgroundColor: "#f8fafc" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Tele-Rehab Video Assessment Fee (₹)
              </label>
              <input
                type="number"
                value={consultFee}
                onChange={(e) => setConsultFee(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 700 }}
              />
              <div style={{ fontSize: "0.78rem", color: "#16a34a", marginTop: 4, fontWeight: 600 }}>
                You Receive: ₹{Math.round(consultFee * 0.8)} • Platform Fee (20%): ₹{Math.round(consultFee * 0.2)}
              </div>
            </div>

            <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, backgroundColor: "#f8fafc" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Doorstep Bedside Session Fee (₹)
              </label>
              <input
                type="number"
                value={homeVisitFee}
                onChange={(e) => setHomeVisitFee(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 700 }}
              />
              <div style={{ fontSize: "0.78rem", color: "#16a34a", marginTop: 4, fontWeight: 600 }}>
                You Receive: ₹{Math.round(homeVisitFee * 0.8)} • Platform Fee (20%): ₹{Math.round(homeVisitFee * 0.2)}
              </div>
            </div>
          </div>

          {/* Scope Catalog List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scopeList.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  border: item.is_active ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "16px",
                  backgroundColor: item.is_active ? "white" : "#f8fafc",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
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
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>{item.service_name}</div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Category: {item.category} • Modality: {item.modality.toUpperCase()} • CallMedex Reference: ₹{item.benchmark_price}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", color: "#64748b" }}>Custom Tariff (₹)</label>
                    <input
                      type="number"
                      disabled={!item.is_active}
                      value={item.custom_price}
                      onChange={(e) => handlePriceUpdate(idx, parseFloat(e.target.value))}
                      style={{ width: 80, padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Platform (20%): ₹{item.platform_fee_amount}</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#16a34a" }}>
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
