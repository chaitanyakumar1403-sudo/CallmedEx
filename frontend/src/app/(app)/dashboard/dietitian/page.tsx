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
  FileText,
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
        if (meData.success && meData.data.role === "dietitian") {
          setProfile(meData.data);
        } else {
          router.push("/");
          return;
        }

        const scopeRes = await fetch(`${apiBase}/api/providers/scope/dietitian`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const scopeData = await scopeRes.json();
        if (scopeData.success && scopeData.data?.scope) {
          setScopeList(scopeData.data.scope);
        } else {
          setScopeList([
            {
              id: "scope-dt-1",
              service_name: "General Tele-Dietetics & Macro Assessment",
              category: "dietetics",
              modality: "online",
              benchmark_price: 400,
              custom_price: 400,
              platform_fee_amount: 80,
              provider_share_amount: 320,
              is_active: true,
            },
            {
              id: "scope-dt-2",
              service_name: "Doorstep Medical Nutrition Therapy (MNT)",
              category: "dietetics",
              modality: "home_visit",
              benchmark_price: 800,
              custom_price: 800,
              platform_fee_amount: 160,
              provider_share_amount: 640,
              is_active: true,
            },
            {
              id: "scope-dt-3",
              service_name: "Geriatric & Enteral Tube Feeding Guidance",
              category: "dietetics",
              modality: "home_visit",
              benchmark_price: 1000,
              custom_price: 1000,
              platform_fee_amount: 200,
              provider_share_amount: 800,
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
            setConsultations(bData.data.bookings.map(bookingToQueueItem));
          } else {
            setConsultations([]);
          }
        } catch {
          setConsultations([]);
        }
      } catch (err) {
        console.error("Failed to load dietitian dashboard data", err);
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
      const res = await fetch(`${apiBase}/api/providers/scope/dietitian`, {
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
        setScopeSuccessMsg("Tariffs & Scope updated successfully.");
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
        { meal: "Morning Hydration (7:00 AM)", item: "Warm water with chia seeds and methi infusion" },
        { meal: "Breakfast (8:30 AM)", item: "Sprouted moong chilla (2) + mint chutney + skimmed curd" },
        { meal: "Mid-Morning (11:00 AM)", item: "Tender coconut water / roasted chana" },
        { meal: "Lunch (1:30 PM)", item: "Multigrain roti (2) + Dal palak + Cucumber tomato salad + Curd" },
        { meal: "Evening Snack (4:30 PM)", item: "Green tea + boiled sprouts chaat" },
        { meal: "Dinner (7:30 PM)", item: "Quinoa vegetable khichdi / steamed paneer bowl + soup" },
      ],
      notes: dietNotes || "Maintain 2.5L daily hydration. Limit refined salt and sugar.",
      timestamp: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    });
  };

  const TABS = [
    { id: "consultations", label: "Patient Queue", icon: Calendar },
    { id: "schedule", label: "Slots & Availability", icon: Calendar },
    { id: "dispatch", label: "Doorstep Visits", icon: MapPin },
    { id: "meal_planner", label: "Diet Chart Studio", icon: Apple },
    { id: "scope_tariffs", label: "Services & Tariffs", icon: Sliders },
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
      title="Clinical Dietetics &amp; Nutrition Station"
      subtitle={`${profile?.full_name || "Dietitian"} · Tele-dietetics &amp; Doorstep MNT Visits`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* ─── TAB 1: CONSULTATIONS & QUEUE ─── */}
      <div className={activeTab === "consultations" ? "" : "tab-panel-hidden"}>
        <div className="cm-metric-strip">
          <div className="cm-metric-card">
            <div className="cm-metric-card__label">Scheduled Consultations</div>
            <div className="cm-metric-card__value">3 Today</div>
            <div className="cm-metric-card__meta" style={{ color: "var(--cm-done)" }}>
              <CheckCircle2 size={13} /> 2 Tele-health + 1 Doorstep Visit
            </div>
          </div>
          <div className="cm-metric-card">
            <div className="cm-metric-card__label">Tele-Dietetics Rate</div>
            <div className="cm-metric-card__value" style={{ color: "var(--cm-active)" }}>₹{consultFee}</div>
            <div className="cm-metric-card__meta">
              Estimated Net Payout: <strong>₹{Math.round(consultFee * 0.8)}</strong>
            </div>
          </div>
          <div className="cm-metric-card">
            <div className="cm-metric-card__label">Home Nutritional Audit Rate</div>
            <div className="cm-metric-card__value" style={{ color: "var(--cm-done)" }}>₹{homeVisitFee}</div>
            <div className="cm-metric-card__meta">
              Estimated Net Payout: <strong>₹{Math.round(homeVisitFee * 0.8)}</strong>
            </div>
          </div>
        </div>

        <div className="cm-clinical-section" style={{ padding: "var(--cm-5)" }}>
          <h3 style={{ margin: "0 0 var(--cm-4) 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
            Today&apos;s Dietetic Consultations Queue
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
            {consultations.length === 0 && (
              <div className="cm-empty" style={{ padding: "var(--cm-5)" }}>
                <p className="cm-empty__title">No Consultations Booked for Today</p>
                <p className="cm-empty__body">New patient bookings will appear here automatically.</p>
              </div>
            )}
            {consultations.map((item) => (
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
                      {item.modality === "online" ? "Tele-Dietetics" : "Home Visit"}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-2)", marginTop: 4 }}>
                    Clinical Indication: <strong>{item.condition}</strong>
                  </div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={13} /> Slot: {item.time}
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
                      <Video size={14} /> Join Tele-Consult
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("dispatch")}
                      className="cm-btn cm-btn--primary cm-btn--sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <MapPin size={14} /> View Dispatch
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPatientName(item.patient_name);
                      setActiveTab("meal_planner");
                    }}
                    className="cm-btn cm-btn--secondary cm-btn--sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <FileText size={14} /> Create Diet Chart
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
          title="Doorstep Nutritional &amp; MNT Visits"
          providerType="dietitian"
          embedded={true}
        />
      </div>

      {/* ─── TAB 3: CLINICAL DIET CHART STUDIO ─── */}
      <div className={activeTab === "meal_planner" ? "" : "tab-panel-hidden"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--cm-5)" }}>
          {/* Diet Form */}
          <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
            <h3 style={{ margin: "0 0 var(--cm-4) 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 8 }}>
              <Apple size={18} style={{ color: "var(--cm-done)" }} /> Clinical Diet Chart Generator
            </h3>
            <form onSubmit={handleGenerateDietPlan}>
              <div style={{ marginBottom: "var(--cm-3)" }}>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Patient Name
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Rahul Verma"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-sm)" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cm-3)", marginBottom: "var(--cm-3)" }}>
                <div>
                  <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                    Daily Target (kcal)
                  </label>
                  <input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-sm)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                    Clinical Protocol
                  </label>
                  <select
                    value={dietCategory}
                    onChange={(e) => setDietCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-sm)" }}
                  >
                    <option value="diabetic">Diabetic MNT (Low GI)</option>
                    <option value="renal">Renal Protective (Low Na/K)</option>
                    <option value="cardiac">DASH / Cardiac Friendly</option>
                    <option value="weight_loss">Calorie Deficit &amp; High Protein</option>
                    <option value="pcod">PCOD &amp; Insulin Balancing</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "var(--cm-4)" }}>
                <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-2)", marginBottom: 4 }}>
                  Practitioner Instructions &amp; Allergies
                </label>
                <textarea
                  rows={3}
                  value={dietNotes}
                  onChange={(e) => setDietNotes(e.target.value)}
                  placeholder="e.g. Strictly gluten-free, limit oil to 15ml/day, maintain hydration."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-sm)" }}
                />
              </div>

              <button
                type="submit"
                className="cm-btn cm-btn--primary"
                style={{ width: "100%", padding: "10px", fontWeight: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
              >
                <Sparkles size={16} /> Compile &amp; Issue Diet Chart
              </button>
            </form>
          </div>

          {/* Generated Diet Chart Preview */}
          <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
            <h3 style={{ margin: "0 0 var(--cm-4) 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
              Electronic Case Sheet &amp; Diet Prescription
            </h3>
            {generatedPlan ? (
              <div style={{ border: "1px solid var(--cm-done-line)", borderRadius: "var(--cm-radius)", padding: "var(--cm-4)", backgroundColor: "var(--cm-done-surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cm-done-line)", paddingBottom: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "var(--cm-text-base)", color: "var(--cm-done)" }}>{generatedPlan.patient}</div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)" }}>Protocol: {generatedPlan.category}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "var(--cm-text-xs)", color: "var(--cm-done)" }}>
                    <div>Issued: {generatedPlan.timestamp}</div>
                    <div style={{ fontWeight: 700 }}>{generatedPlan.calories} kcal / day</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <span className="cm-pill cm-pill--done" style={{ background: "var(--cm-surface)" }}>
                    Carbs: {generatedPlan.macros.carbs}
                  </span>
                  <span className="cm-pill cm-pill--done" style={{ background: "var(--cm-surface)" }}>
                    Protein: {generatedPlan.macros.protein}
                  </span>
                  <span className="cm-pill cm-pill--done" style={{ background: "var(--cm-surface)" }}>
                    Fats: {generatedPlan.macros.fats}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)" }}>
                  {generatedPlan.meals.map((m: any, i: number) => (
                    <div key={i} style={{ borderBottom: "1px dashed var(--cm-line)", paddingBottom: 4 }}>
                      <strong>{m.meal}:</strong> {m.item}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10, fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontStyle: "italic" }}>
                  <strong>Notes:</strong> {generatedPlan.notes}
                </div>
              </div>
            ) : (
              <div className="cm-empty" style={{ padding: "var(--cm-5)" }}>
                <Apple size={32} style={{ color: "var(--cm-line-strong)", margin: "0 auto 8px" }} />
                <p className="cm-empty__title" style={{ fontSize: "var(--cm-text-sm)" }}>No Diet Chart Generated</p>
                <p className="cm-empty__body" style={{ fontSize: "var(--cm-text-xs)" }}>
                  Fill the patient parameters on the left to compile and issue a verified digital diet chart.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TAB 4: SCOPE OF SERVICES & TARIFFS ─── */}
      <div className={activeTab === "scope_tariffs" ? "" : "tab-panel-hidden"}>
        <div className="cm-clinical-section" style={{ padding: "var(--cm-5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Scope of Services &amp; Tariff Management
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                Configure your accepted consultations, nutrition plans, and session tariffs.
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
                General Tele-Dietetics Fee (₹)
              </label>
              <input
                type="number"
                value={consultFee}
                onChange={(e) => setConsultFee(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontWeight: 700 }}
              />
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", marginTop: 4, fontWeight: 700 }}>
                Estimated Net Payout: ₹{Math.round(consultFee * 0.8)}
              </div>
            </div>

            <div className="cm-card" style={{ padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <label style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)", marginBottom: 4 }}>
                Doorstep Nutrition Audit Fee (₹)
              </label>
              <input
                type="number"
                value={homeVisitFee}
                onChange={(e) => setHomeVisitFee(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontWeight: 700 }}
              />
              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", marginTop: 4, fontWeight: 700 }}>
                Estimated Net Payout: ₹{Math.round(homeVisitFee * 0.8)}
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
                      Modality: {item.modality.toUpperCase()} · Benchmark: ₹{item.benchmark_price}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Custom Fee (₹)</label>
                    <input
                      type="number"
                      disabled={!item.is_active}
                      value={item.custom_price}
                      onChange={(e) => handlePriceUpdate(idx, parseFloat(e.target.value))}
                      style={{ width: 80, padding: "4px 8px", border: "1px solid var(--cm-line-strong)", borderRadius: "var(--cm-radius-sm)", fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Benchmark: ₹{item.benchmark_price}</div>
                    <div style={{ fontSize: "var(--cm-text-sm)", fontWeight: 800, color: "var(--cm-done)" }}>
                      Net Payout: ₹{item.provider_share_amount}
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
