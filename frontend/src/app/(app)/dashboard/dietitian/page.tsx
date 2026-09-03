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
  Apple,
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
  Activity,
  HeartPulse,
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
// This queue used to be a hardcoded array of invented patients ("Rahul Verma",
// "Meera Krishnan", ...) with meet links pointing at /telemed/room/<id>, a
// route that does not exist. A provider must only ever see their own real
// appointments.
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
    condition: b.notes || serviceType.replace(/_/g, " ") || "Consultation",
    modality: isHome ? "home" : "online",
    time: slot
      ? slot.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Time to be confirmed",
    status: b.status,
    meet_link: `/dashboard/doctor/consult/${b.id}`,
    address: b.collection_address || b.address || "",
  };
}

export default function DietitianDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("consultations");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Scope & Tariffs state
  const [scopeList, setScopeList] = useState<ScopeItem[]>([]);
  const [consultFee, setConsultFee] = useState(400);
  const [homeVisitFee, setHomeVisitFee] = useState(800);
  const [savingScope, setSavingScope] = useState(false);
  const [scopeSuccessMsg, setScopeSuccessMsg] = useState("");

  // Clinical Diet Chart Studio state
  const [patientName, setPatientName] = useState("");
  const [targetCalories, setTargetCalories] = useState("1800");
  const [dietCategory, setDietCategory] = useState("diabetic");
  const [dietNotes, setDietNotes] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);

  // Active Consultations Queue
  const [consultations, setConsultations] = useState<any[]>([]);

  useEffect(() => {
    const fetchDietitianData = async () => {
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
        if (data.success && (data.data.role === "dietitian" || data.data.role === "admin")) {
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
            setConsultations((apptData.data?.bookings || []).map(bookingToQueueItem));
          }
        }
      } catch (err) {
        console.error("Error fetching dietitian dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDietitianData();
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
        setScopeSuccessMsg("Scope of services and custom tariffs saved successfully!");
        setTimeout(() => setScopeSuccessMsg(""), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingScope(false);
    }
  };

  const handleGenerateDietPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const cals = parseInt(targetCalories) || 1800;
    const carbs = Math.round((cals * 0.5) / 4);
    const protein = Math.round((cals * 0.25) / 4);
    const fat = Math.round((cals * 0.25) / 9);

    setGeneratedPlan({
      patient: patientName || "Clinical Patient",
      category: dietCategory.toUpperCase(),
      calories: cals,
      macros: { carbs: `${carbs}g`, protein: `${protein}g`, fats: `${fat}g` },
      meals: [
        { meal: "Morning Detox (7:00 AM)", item: "Warm water with chia seeds and methi water" },
        { meal: "Breakfast (8:30 AM)", item: "Sprouted moong chilla (2) + mint chutney + skimmed curd" },
        { meal: "Mid-Morning (11:00 AM)", item: "Tender coconut water / roasted chana" },
        { meal: "Lunch (1:30 PM)", item: "Multigrain roti (2) + Dal palak + Cucumber tomato salad + Curd" },
        { meal: "Evening Snack (4:30 PM)", item: "Green tea + boiled sprouts chaat" },
        { meal: "Dinner (7:30 PM)", item: "Quinoa vegetable khichdi / steamed paneer bowl + soup" },
      ],
      notes: dietNotes || "Maintain 2.5L daily hydration. Limit refined salt & sugar.",
      timestamp: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    });
  };

  const TABS = [
    { id: "consultations", label: "Patient Queue", icon: Calendar },
    { id: "schedule", label: "Slots & Availability", icon: Calendar },
    { id: "dispatch", label: "Doorstep Visits", icon: MapPin },
    { id: "meal_planner", label: "Diet Chart Studio", icon: Apple },
    { id: "scope_tariffs", label: "Services & Tariffs (80/20)", icon: Sliders },
    { id: "profile", label: "Practitioner Profile", icon: User },
  ];

  if (loading) {
    return (
      <DashboardShell role="dietitian" title="Dietetic Station" subtitle="Loading clinical queue..." tabs={[]} activeTab="" onTabChange={() => {}}>
        <SkeletonRows rows={4} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="dietitian"
      title="Clinical Dietetics & Nutrition Station"
      subtitle={`${profile?.full_name || "Dietitian"} — Tele-dietetics, Doorstep MNT Visits & 80/20 Commercial Tariffs`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ─── TAB 1: CONSULTATIONS & QUEUE ─── */}
      <div className={activeTab === "consultations" ? "" : "tab-panel-hidden"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div style={{ backgroundColor: "white", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Scheduled Consultations</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginTop: 4 }}>3 Today</div>
            <div style={{ fontSize: "0.78rem", color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={14} /> 2 Tele-health + 1 Doorstep Visit
            </div>
          </div>
          <div style={{ backgroundColor: "white", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Tele-Dietetics Rate</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0284c7", marginTop: 4 }}>₹{consultFee}</div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
              Your Net Take-Home (80%): <strong>₹{Math.round(consultFee * 0.8)}</strong>
            </div>
          </div>
          <div style={{ backgroundColor: "white", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Home Nutritional Audit Rate</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#16a34a", marginTop: 4 }}>₹{homeVisitFee}</div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
              Your Net Take-Home (80%): <strong>₹{Math.round(homeVisitFee * 0.8)}</strong>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
            Today&apos;s Dietetic Consultations Queue
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {consultations.length === 0 && (
              <div style={{ padding: "28px 20px", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                No dietetic consultations booked for today.
              </div>
            )}
            {consultations.map((item) => (
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
                      {item.modality === "online" ? "Tele-Dietetics" : "Home Visit"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#334155", marginTop: 4 }}>
                    Clinical Indication: <strong>{item.condition}</strong>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={14} /> Slot: {item.time}
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
                      <Video size={16} /> Join Tele-Consult
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
                      <MapPin size={16} /> View Dispatch
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPatientName(item.patient_name);
                      setActiveTab("meal_planner");
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
                    <FileText size={15} /> Create Diet Chart
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
          title="Doorstep Nutritional & MNT Visits"
          providerType="dietitian"
          earningsRate={640}
          embedded={true}
        />
      </div>

      {/* ─── TAB 3: CLINICAL DIET CHART STUDIO ─── */}
      <div className={activeTab === "meal_planner" ? "" : "tab-panel-hidden"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {/* Diet Form */}
          <div style={{ backgroundColor: "white", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <Apple size={20} color="#16a34a" /> Clinical Diet Chart Generator
            </h3>
            <form onSubmit={handleGenerateDietPlan}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Patient Name
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Rahul Verma"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Daily Target (kcal)
                  </label>
                  <input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Clinical Protocol
                  </label>
                  <select
                    value={dietCategory}
                    onChange={(e) => setDietCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                  >
                    <option value="diabetic">Diabetic MNT (Low GI)</option>
                    <option value="renal">Renal Protective (Low Na/K)</option>
                    <option value="cardiac">DASH / Cardiac Friendly</option>
                    <option value="weight_loss">Calorie Deficit &amp; High Protein</option>
                    <option value="pcod">PCOD &amp; Insulin Balancing</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Practitioner Instructions / Allergies
                </label>
                <textarea
                  rows={3}
                  value={dietNotes}
                  onChange={(e) => setDietNotes(e.target.value)}
                  placeholder="e.g. Strictly gluten-free, limit oil to 15ml/day, take isabgol before bed."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#16a34a",
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
                <Sparkles size={18} /> Compile &amp; Issue Diet Chart
              </button>
            </form>
          </div>

          {/* Generated Diet Chart Preview */}
          <div style={{ backgroundColor: "white", padding: 24, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              Electronic Case Sheet &amp; Diet Prescription
            </h3>
            {generatedPlan ? (
              <div style={{ border: "1.5px solid #bbf7d0", borderRadius: 10, padding: 18, backgroundColor: "#f0fdf4" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #bbf7d0", paddingBottom: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#166534" }}>{generatedPlan.patient}</div>
                    <div style={{ fontSize: "0.8rem", color: "#15803d" }}>Protocol: {generatedPlan.category}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#15803d" }}>
                    <div>Issued: {generatedPlan.timestamp}</div>
                    <div style={{ fontWeight: 700 }}>{generatedPlan.calories} kcal / day</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: "0.8rem", backgroundColor: "white", padding: "4px 8px", borderRadius: 6, border: "1px solid #bbf7d0", color: "#166534" }}>
                    Carbs: {generatedPlan.macros.carbs}
                  </span>
                  <span style={{ fontSize: "0.8rem", backgroundColor: "white", padding: "4px 8px", borderRadius: 6, border: "1px solid #bbf7d0", color: "#166534" }}>
                    Protein: {generatedPlan.macros.protein}
                  </span>
                  <span style={{ fontSize: "0.8rem", backgroundColor: "white", padding: "4px 8px", borderRadius: 6, border: "1px solid #bbf7d0", color: "#166534" }}>
                    Fats: {generatedPlan.macros.fats}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.85rem", color: "#14532d" }}>
                  {generatedPlan.meals.map((m: any, i: number) => (
                    <div key={i} style={{ borderBottom: "1px dashed #dcfce7", paddingBottom: 4 }}>
                      <strong>{m.meal}:</strong> {m.item}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, fontSize: "0.8rem", color: "#166534", fontStyle: "italic" }}>
                  <strong>Notes:</strong> {generatedPlan.notes}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 10px", color: "#64748b" }}>
                <Apple size={36} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  Fill the patient parameters on the left to compile and issue a verified digital diet chart.
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
                Scope of Services &amp; Tariff Management (80/20 Commercial Split)
              </h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b" }}>
                You have full autonomy to accept CallMedex benchmarks or define custom tariffs. CallMedex retains 20%; 80% is your take-home.
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
                General Tele-Dietetics Fee (₹)
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
                Doorstep Nutrition Audit Fee (₹)
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
                      Modality: {item.modality.toUpperCase()} • CallMedex Benchmark: ₹{item.benchmark_price}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", color: "#64748b" }}>Custom Fee (₹)</label>
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
        <ProviderSchedulePanel roleLabel="dietetic practice" />
      </div>

      <div className={activeTab === "profile" ? "" : "tab-panel-hidden"}>
        <DashboardProfile profile={profile} role="dietitian" />
      </div>
    </DashboardShell>
  );
}
