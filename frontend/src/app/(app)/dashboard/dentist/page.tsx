"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardShell, { SkeletonRows, type DashTab } from "../components/DashboardShell";
import DashboardProfile from "../components/DashboardProfile";
import SelfieVerificationCard from "../components/SelfieVerificationCard";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Sliders,
  Sparkles,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Search,
  Check,
  X,
  AlertCircle,
  Building2,
  Stethoscope,
  ChevronRight,
  Activity,
  Layers,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

interface DentalScopeItem {
  id: string;
  service_name: string;
  category: string;
  modality: string;
  duration?: string;
  benchmark_price: number;
  custom_price: number;
  platform_fee_amount: number;
  provider_share_amount: number;
  is_active: boolean;
  description?: string;
}

const CANONICAL_19_DENTAL_PROCEDURES: DentalScopeItem[] = [
  {
    id: "dent_routine_cleanings",
    service_name: "Routine Cleanings (Prophylaxis)",
    category: "Diagnostic",
    modality: "clinic",
    duration: "45 Mins",
    benchmark_price: 800,
    custom_price: 800,
    platform_fee_amount: 160,
    provider_share_amount: 640,
    is_active: true,
    description: "Removal of plaque and tartar buildup to prevent periodontal disease.",
  },
  {
    id: "dent_comprehensive_exams",
    service_name: "Comprehensive Exams",
    category: "Diagnostic",
    modality: "clinic",
    duration: "30 Mins",
    benchmark_price: 400,
    custom_price: 400,
    platform_fee_amount: 80,
    provider_share_amount: 320,
    is_active: true,
    description: "Thorough physical evaluation of teeth, soft tissues, and oral cavity structure.",
  },
  {
    id: "dent_dental_xrays",
    service_name: "Dental X-Rays",
    category: "Diagnostic",
    modality: "clinic",
    duration: "15 Mins",
    benchmark_price: 350,
    custom_price: 350,
    platform_fee_amount: 70,
    provider_share_amount: 280,
    is_active: true,
    description: "Diagnostic imaging (bitewing/panoramic) to identify deep decay or bone loss.",
  },
  {
    id: "dent_fluoride_treatments",
    service_name: "Fluoride Treatments",
    category: "Preventive",
    modality: "clinic",
    duration: "15 Mins",
    benchmark_price: 600,
    custom_price: 600,
    platform_fee_amount: 120,
    provider_share_amount: 480,
    is_active: true,
    description: "Highly concentrated topical application to reinforce enamel against acid attack.",
  },
  {
    id: "dent_dental_sealants",
    service_name: "Dental Sealants",
    category: "Preventive",
    modality: "clinic",
    duration: "30 Mins",
    benchmark_price: 750,
    custom_price: 750,
    platform_fee_amount: 150,
    provider_share_amount: 600,
    is_active: true,
    description: "Protective thin composite barrier applied to deep pits/fissures of molars.",
  },
  {
    id: "dent_dental_fillings",
    service_name: "Dental Fillings",
    category: "Restorative",
    modality: "clinic",
    duration: "45 Mins",
    benchmark_price: 1200,
    custom_price: 1200,
    platform_fee_amount: 240,
    provider_share_amount: 960,
    is_active: true,
    description: "Excavation of decay followed by restoration using tooth-colored composite resin.",
  },
  {
    id: "dent_root_canal_therapy",
    service_name: "Root Canal Therapy",
    category: "Endodontic",
    modality: "clinic",
    duration: "90 Mins",
    benchmark_price: 3500,
    custom_price: 3500,
    platform_fee_amount: 700,
    provider_share_amount: 2800,
    is_active: true,
    description: "Extirpation of infected or necrotic pulp tissue from root canals to salvage tooth.",
  },
  {
    id: "dent_crowns_caps",
    service_name: "Dental Crowns (Caps)",
    category: "Prosthodontic",
    modality: "clinic",
    duration: "60 Mins",
    benchmark_price: 4500,
    custom_price: 4500,
    platform_fee_amount: 900,
    provider_share_amount: 3600,
    is_active: true,
    description: "Full-coverage custom-fabricated ceramic or porcelain prosthesis to protect weak teeth.",
  },
  {
    id: "dent_bridges",
    service_name: "Bridges",
    category: "Prosthodontic",
    modality: "clinic",
    duration: "90 Mins",
    benchmark_price: 8000,
    custom_price: 8000,
    platform_fee_amount: 1600,
    provider_share_amount: 6400,
    is_active: true,
    description: "Fixed multi-unit prosthetic appliance replacing missing teeth anchored to adjacent abutments.",
  },
  {
    id: "dent_dentures",
    service_name: "Dentures",
    category: "Prosthodontic",
    modality: "clinic",
    duration: "60 Mins",
    benchmark_price: 12000,
    custom_price: 12000,
    platform_fee_amount: 2400,
    provider_share_amount: 9600,
    is_active: true,
    description: "Removable tissue-supported complete or partial appliance to replace missing arches.",
  },
  {
    id: "dent_dental_implants",
    service_name: "Dental Implants",
    category: "Surgical-Restorative",
    modality: "clinic",
    duration: "120 Mins",
    benchmark_price: 25000,
    custom_price: 25000,
    platform_fee_amount: 5000,
    provider_share_amount: 20000,
    is_active: true,
    description: "Surgical placement of titanium endosteal fixture serving as an artificial tooth root.",
  },
  {
    id: "dent_teeth_whitening",
    service_name: "Teeth Whitening",
    category: "Cosmetic",
    modality: "clinic",
    duration: "60 Mins",
    benchmark_price: 5000,
    custom_price: 5000,
    platform_fee_amount: 1000,
    provider_share_amount: 4000,
    is_active: true,
    description: "In-office chemically activated or light-assisted bleaching process to lift internal stains.",
  },
  {
    id: "dent_dental_veneers",
    service_name: "Dental Veneers",
    category: "Cosmetic",
    modality: "clinic",
    duration: "90 Mins",
    benchmark_price: 7500,
    custom_price: 7500,
    platform_fee_amount: 1500,
    provider_share_amount: 6000,
    is_active: true,
    description: "Ultra-thin custom porcelain facings bonded permanently to anterior teeth surfaces.",
  },
  {
    id: "dent_cosmetic_bonding",
    service_name: "Cosmetic Bonding",
    category: "Cosmetic",
    modality: "clinic",
    duration: "45 Mins",
    benchmark_price: 2000,
    custom_price: 2000,
    platform_fee_amount: 400,
    provider_share_amount: 1600,
    is_active: true,
    description: "Direct application of composite materials to repair minor micro-fractures or structural diastemas.",
  },
  {
    id: "dent_scaling_root_planing",
    service_name: "Scaling and Root Planing",
    category: "Periodontal",
    modality: "clinic",
    duration: "75 Mins",
    benchmark_price: 1800,
    custom_price: 1800,
    platform_fee_amount: 360,
    provider_share_amount: 1440,
    is_active: true,
    description: "Therapeutic deep instrumentation below the gumline to clear calculus and smooth roots.",
  },
  {
    id: "dent_gum_grafting",
    service_name: "Gum Grafting",
    category: "Periodontal-Surgical",
    modality: "clinic",
    duration: "90 Mins",
    benchmark_price: 9000,
    custom_price: 9000,
    platform_fee_amount: 1800,
    provider_share_amount: 7200,
    is_active: true,
    description: "Surgical tissue transplantation to restore severe areas of gingival recession.",
  },
  {
    id: "dent_tooth_extractions",
    service_name: "Tooth Extractions",
    category: "Oral Surgery",
    modality: "clinic",
    duration: "45 Mins",
    benchmark_price: 1000,
    custom_price: 1000,
    platform_fee_amount: 200,
    provider_share_amount: 800,
    is_active: true,
    description: "Surgical or non-surgical removal of non-restorable or heavily fractured teeth.",
  },
  {
    id: "dent_wisdom_teeth_removal",
    service_name: "Wisdom Teeth Removal",
    category: "Oral Surgery",
    modality: "clinic",
    duration: "90 Mins",
    benchmark_price: 4000,
    custom_price: 4000,
    platform_fee_amount: 800,
    provider_share_amount: 3200,
    is_active: true,
    description: "Surgical extraction of impacted, malposed, or symptomatic third molars.",
  },
  {
    id: "dent_emergency_dental_care",
    service_name: "Emergency Dental Care",
    category: "Emergency",
    modality: "clinic",
    duration: "45 Mins",
    benchmark_price: 1500,
    custom_price: 1500,
    platform_fee_amount: 300,
    provider_share_amount: 1200,
    is_active: true,
    description: "Immediate triage and palliative or corrective treatment for acute abscesses or trauma.",
  },
];

export default function DentistDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("procedures");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Procedures & Tariffs state
  const [scopeList, setScopeList] = useState<DentalScopeItem[]>(CANONICAL_19_DENTAL_PROCEDURES);
  const [consultFee, setConsultFee] = useState(400);
  const [savingScope, setSavingScope] = useState(false);
  const [scopeSuccessMsg, setScopeSuccessMsg] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Appointments / Walk-In Queue
  const [walkInQueue, setWalkInQueue] = useState<any[]>([]);

  // Odontogram state
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [toothFindings, setToothFindings] = useState<Record<number, { condition: string; procedureId: string }>>({});
  const [selectedFinding, setSelectedFinding] = useState("Caries / Cavity");
  const [selectedProcForTooth, setSelectedProcForTooth] = useState("dent_dental_fillings");

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
        if (meData.success && meData.data.role === "dentist") {
          setProfile(meData.data);
          if (meData.data.consultation_fee) {
            setConsultFee(meData.data.consultation_fee);
          }
        } else {
          // If not dentist, redirect
          router.push("/");
          return;
        }

        // Fetch dentist scope
        try {
          const scopeRes = await fetch(`${apiBase}/api/providers/me/scope`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const scopeData = await scopeRes.json();
          if (scopeData.success && Array.isArray(scopeData.data?.scope_of_services) && scopeData.data.scope_of_services.length > 0) {
            // Merge with canonical catalog to preserve full 19 list
            const serverScope = scopeData.data.scope_of_services;
            const merged = CANONICAL_19_DENTAL_PROCEDURES.map((canonical) => {
              const matched = serverScope.find((s: any) => s.id === canonical.id || s.procedure_id === canonical.id || s.service_name === canonical.service_name);
              if (matched) {
                const customPrice = Number(matched.custom_price || matched.agreed_price || canonical.benchmark_price);
                const platformFee = Math.round(customPrice * 0.2);
                return {
                  ...canonical,
                  custom_price: customPrice,
                  platform_fee_amount: platformFee,
                  provider_share_amount: customPrice - platformFee,
                  is_active: matched.is_active !== undefined ? matched.is_active : true,
                };
              }
              return canonical;
            });
            setScopeList(merged);
          }
        } catch {
          setScopeList(CANONICAL_19_DENTAL_PROCEDURES);
        }

        // Fetch bookings / walk-in queue
        try {
          const bRes = await fetch(`${apiBase}/api/bookings/provider/today`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const bData = await bRes.json();
          if (bData.success && Array.isArray(bData.data?.bookings)) {
            setWalkInQueue(bData.data.bookings);
          } else {
            setWalkInQueue([]);
          }
        } catch {
          setWalkInQueue([]);
        }
      } catch (err) {
        console.error("Failed to load dentist dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [router]);

  const handlePriceUpdate = (id: string, newPrice: number) => {
    const price = Math.max(0, newPrice);
    const platformFee = Math.round(price * 0.2);
    const providerShare = price - platformFee;

    setScopeList((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              custom_price: price,
              platform_fee_amount: platformFee,
              provider_share_amount: providerShare,
            }
          : item
      )
    );
  };

  const handleToggleProcedure = (id: string) => {
    setScopeList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_active: !item.is_active } : item
      )
    );
  };

  const saveScopeChanges = async () => {
    setSavingScope(true);
    setScopeSuccessMsg("");
    try {
      const token = getToken();
      const payload = {
        consultation_fee: consultFee,
        scope_of_services: scopeList.map((item) => ({
          procedure_id: item.id,
          id: item.id,
          service_name: item.service_name,
          category: item.category,
          modality: "clinic",
          duration: item.duration,
          benchmark_price: item.benchmark_price,
          agreed_price: item.custom_price,
          custom_price: item.custom_price,
          platform_fee_amount: item.platform_fee_amount,
          provider_share_amount: item.provider_share_amount,
          is_active: item.is_active,
        })),
      };

      const res = await fetch(`${apiBase}/api/providers/me/scope`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setScopeSuccessMsg("Dental tariffs & 19-procedure scope saved successfully.");
        setTimeout(() => setScopeSuccessMsg(""), 4500);
      }
    } catch (e) {
      console.error("Failed to save dental scope", e);
    } finally {
      setSavingScope(false);
    }
  };

  const handleApplyToothFinding = () => {
    if (selectedTooth === null) return;
    setToothFindings((prev) => ({
      ...prev,
      [selectedTooth]: {
        condition: selectedFinding,
        procedureId: selectedProcForTooth,
      },
    }));
  };

  const handleClearTooth = (toothNum: number) => {
    setToothFindings((prev) => {
      const next = { ...prev };
      delete next[toothNum];
      return next;
    });
  };

  const filteredScope = scopeList.filter((item) => {
    const matchesCat = categoryFilter === "all" || item.category.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchesSearch = searchQuery === "" || item.service_name.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const categories = ["all", "Diagnostic", "Preventive", "Restorative", "Endodontic", "Prosthodontic", "Cosmetic", "Periodontal", "Oral Surgery", "Emergency"];

  const TABS: DashTab[] = [
    { id: "procedures", label: "Master Procedures (19)", icon: Layers, count: scopeList.filter((s) => s.is_active).length },
    { id: "queue", label: "Walk-In Clinic Queue", icon: Calendar, count: walkInQueue.length },
    { id: "charting", label: "Clinical Odontogram", icon: Activity },
    { id: "mou", label: "CallMedex Dental MOU", icon: ShieldCheck },
    { id: "profile", label: "Dentist Profile", icon: User },
  ];

  if (loading) {
    return (
      <DashboardShell
        role="dentist"
        title="Dental Surgery & Practice Workstation"
        subtitle="Loading dental operatory records..."
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
      role="dentist"
      title="Dental Surgery &amp; Practice Workstation"
      subtitle={`${profile?.clinic_name || "Dental Practice"} · Dr. ${profile?.full_name || "Dentist Partner"} (${profile?.qualification || "BDS / MDS Surgery"}) · 100% In-Clinic Walk-In`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div style={{ padding: "0 0 32px 0", maxWidth: "1280px", margin: "0 auto" }}>
        {/* Dentist Practice Header Card */}
        <div
          style={{
            padding: "24px 28px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #0c4a6e 100%)",
            color: "#ffffff",
            marginBottom: "24px",
            boxShadow: "0 8px 24px rgba(2, 132, 199, 0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(255, 255, 255, 0.25)",
              }}
            >
              <Clinical3DIcon name="dental" size={42} glow />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>
                  {profile?.clinic_name || "CallMedex Dental Practice Workstation"}
                </h1>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "rgba(16, 185, 129, 0.25)",
                    border: "1px solid #10b981",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    color: "#a7f3d0",
                  }}
                >
                  100% In-Clinic Walk-In
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", opacity: 0.9 }}>
                Dr. {profile?.full_name || "Dentist Partner"} | {profile?.qualification || "BDS / MDS Surgery"} | Reg: {profile?.dental_license_number || "DCI Verified"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ textAlign: "right", background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: 12 }}>
              <div style={{ fontSize: "0.72rem", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.5px" }}>Commercial Split</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>80% Net / 20% CallMedex</div>
            </div>
            <div style={{ textAlign: "right", background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: 12 }}>
              <div style={{ fontSize: "0.72rem", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Procedures</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{scopeList.filter((s) => s.is_active).length} / 19 Live</div>
            </div>
          </div>
        </div>

        {/* TAB 1: MASTER PROCEDURES & TARIFFS */}
        {activeTab === "procedures" && (
          <div>
            {/* Tariff Control Bar */}
            <div
              style={{
                padding: "18px 22px",
                borderRadius: "14px",
                background: "var(--cm-surface, #ffffff)",
                border: "1px solid var(--cm-border, #e2e8f0)",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--cm-ink, #0f172a)" }}>
                  Base Walk-In OPD Exam Fee:
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#64748b" }}>₹</span>
                  <input
                    type="number"
                    value={consultFee}
                    onChange={(e) => setConsultFee(Number(e.target.value) || 0)}
                    style={{
                      width: "90px",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--cm-border, #cbd5e1)",
                      fontWeight: 700,
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 600 }}>
                  (Net ₹{Math.round(consultFee * 0.8)} / Fee ₹{Math.round(consultFee * 0.2)})
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {scopeSuccessMsg && (
                  <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={16} /> {scopeSuccessMsg}
                  </span>
                )}
                <button
                  onClick={saveScopeChanges}
                  disabled={savingScope}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 10,
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: savingScope ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {savingScope ? "Saving Changes..." : "Save Tariff Updates"}
                </button>
              </div>
            </div>

            {/* Filter and Search */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: categoryFilter === cat ? "1px solid #0284c7" : "1px solid var(--cm-border, #e2e8f0)",
                      background: categoryFilter === cat ? "#e0f2fe" : "var(--cm-surface, #ffffff)",
                      color: categoryFilter === cat ? "#0369a1" : "var(--cm-text-muted, #64748b)",
                      fontSize: "0.78rem",
                      fontWeight: categoryFilter === cat ? 700 : 500,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {cat === "all" ? "All (19)" : cat}
                  </button>
                ))}
              </div>

              <div style={{ position: "relative", minWidth: "240px" }}>
                <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 10, top: 10 }} />
                <input
                  type="text"
                  placeholder="Search procedures..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 34px",
                    borderRadius: 8,
                    border: "1px solid var(--cm-border, #cbd5e1)",
                    fontSize: "0.84rem",
                    background: "var(--cm-surface, #ffffff)",
                  }}
                />
              </div>
            </div>

            {/* Procedures Table */}
            <div
              style={{
                background: "var(--cm-surface, #ffffff)",
                borderRadius: "14px",
                border: "1px solid var(--cm-border, #e2e8f0)",
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr 1fr 90px",
                  padding: "14px 20px",
                  background: "#f8fafc",
                  borderBottom: "1px solid var(--cm-border, #e2e8f0)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                <div>Procedure &amp; Category</div>
                <div>Duration</div>
                <div>Benchmark MRP</div>
                <div>Your Tariff (₹)</div>
                <div>Net Dentist (80%)</div>
                <div>CallMedex (20%)</div>
                <div style={{ textAlign: "center" }}>Status</div>
              </div>

              <div>
                {filteredScope.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr 1fr 90px",
                      padding: "14px 20px",
                      alignItems: "center",
                      borderBottom: "1px solid #f1f5f9",
                      background: item.is_active ? "#ffffff" : "#fcfcfc",
                      opacity: item.is_active ? 1 : 0.65,
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>
                        {item.service_name}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "#e0f2fe",
                            color: "#0369a1",
                            fontWeight: 600,
                          }}
                        >
                          {item.category}
                        </span>
                        <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                          {item.description}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.82rem", color: "#475569", fontWeight: 500 }}>
                      {item.duration || "45 Mins"}
                    </div>

                    <div style={{ fontSize: "0.88rem", color: "#64748b", fontWeight: 600 }}>
                      ₹{item.benchmark_price}
                    </div>

                    <div>
                      <input
                        type="number"
                        value={item.custom_price}
                        onChange={(e) => handlePriceUpdate(item.id, Number(e.target.value) || 0)}
                        style={{
                          width: "90px",
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontWeight: 700,
                          color: "#0f172a",
                          fontSize: "0.9rem",
                        }}
                      />
                    </div>

                    <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#16a34a" }}>
                      ₹{item.provider_share_amount}
                    </div>

                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>
                      ₹{item.platform_fee_amount}
                    </div>

                    <div style={{ textAlign: "center" }}>
                      <button
                        onClick={() => handleToggleProcedure(item.id)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "none",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          background: item.is_active ? "#dcfce7" : "#f1f5f9",
                          color: item.is_active ? "#15803d" : "#64748b",
                        }}
                      >
                        {item.is_active ? "Active" : "Paused"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WALK-IN CLINIC QUEUE */}
        {activeTab === "queue" && (
          <div>
            <div
              style={{
                padding: "20px 24px",
                borderRadius: "14px",
                background: "var(--cm-surface, #ffffff)",
                border: "1px solid var(--cm-border, #e2e8f0)",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 6px 0", color: "#0f172a" }}>
                Today's Walk-In Operatory Queue
              </h2>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                Patients who booked In-Clinic appointments or arrived as verified walk-ins under CallMedex Dental Network.
              </p>
            </div>

            {walkInQueue.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  borderRadius: "14px",
                  background: "var(--cm-surface, #ffffff)",
                  border: "1px dashed var(--cm-border, #cbd5e1)",
                  textAlign: "center",
                }}
              >
                <Clinical3DIcon name="dental" size={54} />
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "14px 0 6px 0", color: "#0f172a" }}>
                  Operatory Queue Clear
                </h3>
                <p style={{ fontSize: "0.84rem", color: "#64748b", margin: 0, maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                  No active walk-in appointments currently pending. As patients book from the patient portal, their clinical charts will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {walkInQueue.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      padding: "16px 20px",
                      borderRadius: 12,
                      background: "var(--cm-surface, #ffffff)",
                      border: "1px solid var(--cm-border, #e2e8f0)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>
                        {item.patient_name || `Patient #${idx + 1}`}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                        Procedure: {item.service_name || "Dental Clinical Exam"} | Time: {item.slot_time || "Walk-In"}
                      </div>
                    </div>
                    <button
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "#0284c7",
                        color: "#fff",
                        border: "none",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      Open Dental Chart
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CLINICAL ODONTOGRAM */}
        {activeTab === "charting" && (
          <div
            style={{
              padding: "24px",
              borderRadius: "14px",
              background: "var(--cm-surface, #ffffff)",
              border: "1px solid var(--cm-border, #e2e8f0)",
            }}
          >
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 6px 0", color: "#0f172a" }}>
                Interactive Adult Odontogram (Universal 1–32)
              </h2>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                Click any tooth to annotate clinical diagnosis and bind one of the 19 canonical dental procedures.
              </p>
            </div>

            {/* Upper Arch (Maxilla: 1-16) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>
                Maxillary Arch (Upper Teeth 1 – 16)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(16, 1fr)", gap: 6 }}>
                {Array.from({ length: 16 }, (_, i) => i + 1).map((tooth) => {
                  const finding = toothFindings[tooth];
                  const isSelected = selectedTooth === tooth;
                  return (
                    <div
                      key={tooth}
                      onClick={() => setSelectedTooth(tooth)}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 8,
                        background: isSelected ? "#0284c7" : finding ? "#fef3c7" : "#f8fafc",
                        border: isSelected ? "2px solid #0369a1" : finding ? "1px solid #f59e0b" : "1px solid #cbd5e1",
                        color: isSelected ? "#ffffff" : "#0f172a",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: "0.7rem", fontWeight: 700 }}>#{tooth}</div>
                      <div style={{ fontSize: "0.95rem", margin: "4px 0" }}>🦷</div>
                      {finding && (
                        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: isSelected ? "#fff" : "#b45309", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {finding.condition.split(" ")[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lower Arch (Mandible: 17-32) */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>
                Mandibular Arch (Lower Teeth 17 – 32)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(16, 1fr)", gap: 6 }}>
                {Array.from({ length: 16 }, (_, i) => i + 17).map((tooth) => {
                  const finding = toothFindings[tooth];
                  const isSelected = selectedTooth === tooth;
                  return (
                    <div
                      key={tooth}
                      onClick={() => setSelectedTooth(tooth)}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 8,
                        background: isSelected ? "#0284c7" : finding ? "#fef3c7" : "#f8fafc",
                        border: isSelected ? "2px solid #0369a1" : finding ? "1px solid #f59e0b" : "1px solid #cbd5e1",
                        color: isSelected ? "#ffffff" : "#0f172a",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: "0.7rem", fontWeight: 700 }}>#{tooth}</div>
                      <div style={{ fontSize: "0.95rem", margin: "4px 0" }}>🦷</div>
                      {finding && (
                        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: isSelected ? "#fff" : "#b45309", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {finding.condition.split(" ")[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tooth Annotation Panel */}
            {selectedTooth !== null && (
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontWeight: 800, color: "#0369a1" }}>Tooth #{selectedTooth} Selected:</span>
                  <select
                    value={selectedFinding}
                    onChange={(e) => setSelectedFinding(e.target.value)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  >
                    <option value="Caries / Cavity">Caries / Cavity</option>
                    <option value="Irreversible Pulpitis">Irreversible Pulpitis (RCT needed)</option>
                    <option value="Fractured Tooth">Fractured Tooth / Crown loss</option>
                    <option value="Periodontal Pocket">Periodontal Pocket / Mobility</option>
                    <option value="Impacted 3rd Molar">Impacted 3rd Molar</option>
                    <option value="Missing Tooth">Missing Tooth (Needs Implant / Bridge)</option>
                  </select>

                  <select
                    value={selectedProcForTooth}
                    onChange={(e) => setSelectedProcForTooth(e.target.value)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  >
                    {CANONICAL_19_DENTAL_PROCEDURES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.service_name} (₹{p.benchmark_price})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleApplyToothFinding}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "#0284c7",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    Apply Clinical Finding
                  </button>
                  {toothFindings[selectedTooth] && (
                    <button
                      onClick={() => handleClearTooth(selectedTooth)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "#fee2e2",
                        color: "#b91c1c",
                        border: "1px solid #fca5a5",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      Clear Tooth
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CALLMEDEX DENTAL MOU */}
        {activeTab === "mou" && (
          <div
            style={{
              padding: "24px 28px",
              borderRadius: "14px",
              background: "var(--cm-surface, #ffffff)",
              border: "1px solid var(--cm-border, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 4px 0", color: "#0f172a" }}>
                  CallMedex Dental Partner Agreement &amp; MOU
                </h2>
                <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                  Executed Memorandum of Understanding between CallMedex Technologies Pvt. Ltd. and {profile?.clinic_name || "Partner Dental Practice"}.
                </p>
              </div>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  color: "#15803d",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ShieldCheck size={16} /> Digitally Executed &amp; Verified
              </span>
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "0.84rem",
                color: "#334155",
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: "0.95rem" }}>
                1. SCOPE OF SERVICES &amp; MODALITY GOVERNANCE
              </h4>
              <p>
                The Dental Partner agrees to deliver dental consultations and clinical procedures strictly as <strong>100% In-Clinic Walk-In Services</strong> at the registered clinic operatory. Due to statutory infection control requirements, aerosol management, and autoclave sterilization standards, teleconsultations and home visit modalities are strictly excluded from dental procedure offerings.
              </p>

              <h4 style={{ margin: "16px 0 10px 0", color: "#0f172a", fontSize: "0.95rem" }}>
                2. COMMERCIAL SPLIT &amp; PAYMENT SETTLEMENT
              </h4>
              <p>
                Commercial remuneration is governed by CallMedex Healthcare Commercial Guidelines:
                <br />
                • <strong>80% Net Provider Remuneration:</strong> Payable to the Dentist on a verified weekly disbursement cycle.
                <br />
                • <strong>20% CallMedex Platform &amp; Technology Fee:</strong> Covering patient booking automation, digital records, and SMS/Email transaction receipts.
              </p>

              <h4 style={{ margin: "16px 0 10px 0", color: "#0f172a", fontSize: "0.95rem" }}>
                3. CLINICAL STERILIZATION &amp; STATUTORY COMPLIANCE
              </h4>
              <p>
                The Dental Partner certifies compliance with State Dental Council / Dental Council of India (DCI) protocols, including valid autoclaving monitoring (Class B autoclave verification), biomedical waste management, and patient informed consent for all invasive surgical procedures.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => window.print()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <FileText size={16} /> Print / Save MOU Copy
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 5: DENTIST PRACTICE PROFILE & VERIFICATION ─── */}
        {activeTab === "profile" && (
          <div>
            <SelfieVerificationCard />
            <DashboardProfile profile={profile} role="dentist" />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
