"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import StateDistrictPicker from "@/components/StateDistrictPicker";
import FIXED_PRICES from "@/data/lab-test-prices.json";
import {
  DIAGNOSTIC_CENTER_SCOPE_ITEMS,
  DIAGNOSTIC_SCOPE_CATEGORIES,
  DiagnosticScopeItem,
} from "@/data/diagnosticCenterScope";
import {
  TestTube2,
  Camera,
  Home,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  MapPin,
  Calendar,
  ShieldCheck,
  Filter,
  X,
  Stethoscope,
  Activity,
  HeartPulse,
  Sun,
  Award,
  Star,
  Info,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DiagnosticCenter {
  id: string;
  user_id: string;
  name: string;
  city: string;
  state: string;
  district?: string;
  address?: string;
  rating?: number;
  phone?: string;
  timing?: string;
  facilities?: string[];
  min_price?: number;
}

const FALLBACK_CENTERS: DiagnosticCenter[] = [
  {
    id: "5e501ddb-c21d-4e87-97af-30f5f6f6348b",
    user_id: "5e501ddb-c21d-4e87-97af-30f5f6f6348b",
    name: "ACCUMAX DIAGNOSTICS & IMAGING",
    city: "Visakhapatnam",
    state: "Andhra Pradesh",
    district: "Visakhapatnam",
    address: "Dwaraka Nagar, 3rd Lane, Visakhapatnam",
    rating: 4.9,
    timing: "06:30 AM – 09:30 PM",
    facilities: ["1.5T MRI", "Multi-Slice CT", "4D Ultrasound", "Digital X-Ray", "Color Doppler", "Fully Automated Lab"],
    min_price: 150,
  },
  {
    id: "visakha-city-scans",
    user_id: "visakha-city-scans",
    name: "VISAKHA ADVANCED SCAN & DIAGNOSTIC CENTRE",
    city: "Visakhapatnam",
    state: "Andhra Pradesh",
    district: "Visakhapatnam",
    address: "Maharanipeta, Near KGH, Visakhapatnam",
    rating: 4.8,
    timing: "07:00 AM – 09:00 PM",
    facilities: ["32-Slice CT", "Digital X-Ray", "Fetal Ultrasound", "2D Echo / ECG", "Cardiac Markers"],
    min_price: 180,
  },
];

const SUB_CATEGORIES = [
  { id: "all", label: "All Tests" },
  { id: "cbc", label: "Complete Blood Count", keywords: ["cbc", "blood", "haemoglobin", "platelet"] },
  { id: "diabetes", label: "Diabetes & Sugar", keywords: ["diabetes", "hba1c", "glucose", "sugar"] },
  { id: "thyroid", label: "Thyroid Panel", keywords: ["thyroid", "t3", "t4", "tsh"] },
  { id: "lipid", label: "Lipid & Heart", keywords: ["lipid", "cholesterol", "triglycerides", "hdl"] },
  { id: "liver", label: "Liver Function", keywords: ["liver", "lft", "bilirubin", "sgot", "sgpt"] },
  { id: "kidney", label: "Kidney Function", keywords: ["kidney", "kft", "creatinine", "urea", "uric"] },
  { id: "vitamins", label: "Vitamins & Minerals", keywords: ["vitamin", "vitamin d", "vitamin b12", "iron", "calcium"] },
  { id: "infections", label: "Infection Markers", keywords: ["crp", "esr", "dengue", "malaria", "typhoid", "widal"] },
];

function inferCategoryKey(
  name: string,
  category?: string,
  serviceType?: string
): { category: string; category_key: "mri" | "ct_scans" | "xrays" | "scans" | "dopplers" | "cardiology" | "blood_tests" } {
  const n = (name + " " + (category || "")).toLowerCase();
  if (n.includes("mri") || n.includes("magnetic resonance")) {
    return { category: "MRI Scans", category_key: "mri" };
  }
  if (
    n.includes("ct ") ||
    n.includes("computed tomography") ||
    n.includes("hrct") ||
    n.includes("city scan") ||
    n.includes("cect") ||
    n.includes("ct-") ||
    n.endsWith(" ct")
  ) {
    return { category: "CT Scans", category_key: "ct_scans" };
  }
  if (n.includes("ultrasound") || n.includes("usg") || n.includes("sonography") || n.includes("anomaly scan")) {
    return { category: "Ultrasound Scans", category_key: "scans" };
  }
  if (n.includes("doppler") || n.includes("arterial") || n.includes("venous")) {
    return { category: "Doppler Studies", category_key: "dopplers" };
  }
  if (n.includes("x-ray") || n.includes("xray") || n.includes("radiography") || n.includes("pa view") || n.includes("ap view")) {
    return { category: "Digital X-Rays", category_key: "xrays" };
  }
  if (n.includes("ecg") || n.includes("echo") || n.includes("tmt") || n.includes("holter") || n.includes("cardiac")) {
    return { category: "Cardiology", category_key: "cardiology" };
  }
  return { category: "Blood & Lab Tests", category_key: "blood_tests" };
}

function DiagnosticsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "walkin" ? "walkin" : "home";

  const [primaryTab, setPrimaryTab] = useState<"home" | "walkin">(initialTab);

  // Home Collection State
  const [labSearchQuery, setLabSearchQuery] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("all");

  // Walk-in Center State
  const [loc, setLoc] = useState({ state: "Andhra Pradesh", district: "Visakhapatnam", detected: false });
  const [centers, setCenters] = useState<DiagnosticCenter[]>(FALLBACK_CENTERS);
  const [loadingCenters, setLoadingCenters] = useState(false);

  // Modal State for Selected Walk-in Center
  const [activeCenterModal, setActiveCenterModal] = useState<DiagnosticCenter | null>(null);
  const [modalCategory, setModalCategory] = useState<string>("blood_tests");
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [centerServices, setCenterServices] = useState<DiagnosticScopeItem[]>([]);
  const [loadingCenterServices, setLoadingCenterServices] = useState(false);

  // Sync tab with URL if changed
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "walkin" || tabParam === "home") {
      setPrimaryTab(tabParam);
    }
  }, [searchParams]);

  // Fetch Diagnostic Centers for selected location
  useEffect(() => {
    async function loadCenters() {
      setLoadingCenters(true);
      try {
        const cityParam = loc.district || loc.state;
        const res = await fetch(`${API}/api/providers/search?type=diagnostic_center&city=${encodeURIComponent(cityParam)}`);
        const data = await res.json();
        if (data?.providers && data.providers.length > 0) {
          const mapped = data.providers.map((p: any) => ({
            id: p.provider_user_id || p.id,
            user_id: p.provider_user_id || p.id,
            name: p.display_name || p.organization_name || "Accredited Diagnostic Centre",
            city: p.city || loc.district || "Visakhapatnam",
            state: p.state || loc.state || "Andhra Pradesh",
            district: p.district || loc.district,
            address: p.address || `${p.city || loc.district}, ${p.state || loc.state}`,
            rating: p.rating || 4.9,
            timing: p.timing || "06:30 AM – 09:30 PM",
            facilities: [
              "1.5T MRI",
              "Multi-Slice CT",
              "4D Ultrasound",
              "Digital X-Ray",
              "Color Doppler",
              "Fully Automated NABL Lab",
            ],
            min_price: p.min_price || 150,
          }));
          setCenters(mapped);
        } else {
          // If in Visakhapatnam, use curated verified centers
          if (loc.district.toLowerCase().includes("visakhapatnam") || loc.state.toLowerCase().includes("andhra")) {
            setCenters(FALLBACK_CENTERS);
          } else {
            setCenters([]);
          }
        }
      } catch (err) {
        setCenters(FALLBACK_CENTERS);
      } finally {
        setLoadingCenters(false);
      }
    }
    loadCenters();
  }, [loc.state, loc.district]);

  // Fetch individual diagnostic center approved services dynamically when modal opens
  useEffect(() => {
    if (!activeCenterModal) {
      setCenterServices([]);
      return;
    }
    const centerId = activeCenterModal.id;
    const centerName = activeCenterModal.name;
    let isCancelled = false;
    async function loadCenterServices() {
      setLoadingCenterServices(true);
      try {
        const res = await fetch(`${API}/api/providers/org/${centerId}/services`);
        const data = await res.json();
        if (!isCancelled && data?.services && Array.isArray(data.services) && data.services.length > 0) {
          const mapped: DiagnosticScopeItem[] = data.services.map((svc: any) => {
            const { category, category_key } = inferCategoryKey(svc.name, svc.category, svc.service_type);
            return {
              id: svc.id || `svc-${svc.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
              name: svc.name,
              category,
              category_key,
              price: Number(svc.price) || 500,
              description: svc.description || `Accredited clinical diagnostic test performed at ${centerName}.`,
              type: svc.service_type === "lab_test" ? "lab_test" : "imaging",
            };
          });
          setCenterServices(mapped);
        } else if (!isCancelled) {
          setCenterServices(DIAGNOSTIC_CENTER_SCOPE_ITEMS);
        }
      } catch (err) {
        if (!isCancelled) {
          setCenterServices(DIAGNOSTIC_CENTER_SCOPE_ITEMS);
        }
      } finally {
        if (!isCancelled) {
          setLoadingCenterServices(false);
        }
      }
    }
    loadCenterServices();
    return () => {
      isCancelled = true;
    };
  }, [activeCenterModal]);

  // Filtered Lab Tests for Home Collection
  const filteredHomeTests = useMemo(() => {
    let list = FIXED_PRICES as Array<{ name: string; mrp: number; price: number }>;
    if (selectedSubCategory !== "all") {
      const activeCat = SUB_CATEGORIES.find((c) => c.id === selectedSubCategory);
      if (activeCat?.keywords) {
        list = list.filter((t) =>
          activeCat.keywords.some((kw) => t.name.toLowerCase().includes(kw.toLowerCase()))
        );
      }
    }
    if (labSearchQuery.trim()) {
      const q = labSearchQuery.toLowerCase().trim();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [selectedSubCategory, labSearchQuery]);

  // Active Test Pool for Modal Center (Center Approved Services or 134 CallMedex Pre-Approved Tests)
  const modalTestPool = useMemo(() => {
    return centerServices.length > 0 ? centerServices : DIAGNOSTIC_CENTER_SCOPE_ITEMS;
  }, [centerServices]);

  // Filtered Tests for Modal Center
  const filteredModalTests = useMemo(() => {
    let list = modalTestPool;
    if (modalCategory !== "all") {
      list = list.filter((item) => item.category_key === modalCategory);
    }
    if (modalSearchQuery.trim()) {
      const q = modalSearchQuery.toLowerCase().trim();
      list = list.filter((item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));
    }
    return list;
  }, [modalTestPool, modalCategory, modalSearchQuery]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef6fb 100%)", paddingBottom: 80 }}>
      {/* ── Top Hero Header ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #0369a1 60%, #0284c7 100%)",
          color: "#fff",
          padding: "48px 20px 56px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#bae6fd",
              marginBottom: 14,
            }}
          >
            <Sparkles size={15} style={{ color: "#38bdf8" }} />
            CALLMEDEX DIAGNOSTICS & IMAGING NETWORK
          </div>
          <h1 style={{ fontSize: "clamp(1.9rem, 3.8vw, 2.6rem)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
            Book Diagnostics, Scans & Lab Tests
          </h1>
          <p style={{ fontSize: "1.05rem", color: "#e0f2fe", maxWidth: 740, margin: "0 auto 28px", lineHeight: 1.5 }}>
            Choose convenient doorstep sample collection handled by the CallMedex Central Processing Lab, or book walk-in appointments at premier accredited diagnostic & imaging centers.
          </p>

          {/* Primary Bifurcation Tabs */}
          <div
            style={{
              display: "inline-flex",
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(14px)",
              padding: 6,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              maxWidth: "100%",
            }}
          >
            <button
              onClick={() => setPrimaryTab("home")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 24px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.95rem",
                transition: "all 0.25s ease",
                background: primaryTab === "home" ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "transparent",
                color: primaryTab === "home" ? "#ffffff" : "#cbd5e1",
                boxShadow: primaryTab === "home" ? "0 4px 16px rgba(2, 132, 199, 0.4)" : "none",
              }}
            >
              <Home size={18} />
              <span>Home Sample Collection</span>
              <span
                style={{
                  background: primaryTab === "home" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: "0.72rem",
                }}
              >
                5:30 – 11:00 AM
              </span>
            </button>

            <button
              onClick={() => setPrimaryTab("walkin")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 24px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.95rem",
                transition: "all 0.25s ease",
                background: primaryTab === "walkin" ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "transparent",
                color: primaryTab === "walkin" ? "#ffffff" : "#cbd5e1",
                boxShadow: primaryTab === "walkin" ? "0 4px 16px rgba(2, 132, 199, 0.4)" : "none",
              }}
            >
              <Building2 size={18} />
              <span>Walk-in Diagnostic Centres</span>
              <span
                style={{
                  background: primaryTab === "walkin" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: "0.72rem",
                }}
              >
                Scans & Labs
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Body Container ── */}
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 20px" }}>
        {/* ==================================================================== */}
        {/* TAB 1: HOME COLLECTION (CALLMEDEX PROCESSING CENTER)                */}
        {/* ==================================================================== */}
        {primaryTab === "home" && (
          <div>
            {/* CallMedex Processing Lab Showcase Card */}
            <div
              className="glass-card"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.9) 100%)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(2,132,199,0.25)",
                borderRadius: 20,
                padding: "28px 32px",
                boxShadow: "0 12px 32px rgba(2,132,199,0.08)",
                marginBottom: 36,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        background: "#0284c7",
                        color: "#fff",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                      }}
                    >
                      CENTRAL PROCESSING LAB
                    </span>
                    <span style={{ color: "#0369a1", fontSize: "0.85rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Award size={16} /> NABL Compliant Standards
                    </span>
                  </div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
                    Doorstep Blood Sample Collection
                  </h2>
                  <p style={{ color: "#475569", fontSize: "0.95rem", margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
                    Certified CallMedex phlebotomists arrive at your home with temperature-controlled cold storage kits. Fasting samples strictly collected between <strong>5:30 AM and 11:00 AM</strong> for maximum diagnostic precision.
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(2,132,199,0.08)",
                    border: "1px solid rgba(2,132,199,0.2)",
                    borderRadius: 14,
                    padding: "12px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Clock size={28} style={{ color: "#0284c7" }} />
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Home Slot Window</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0369a1" }}>05:30 AM – 11:00 AM</div>
                  </div>
                </div>
              </div>

              {/* 4 Feature Badges */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                  marginTop: 20,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(2,132,199,0.12)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#334155" }}>
                  <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                  <span>Individual Barcoded Vials</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#334155" }}>
                  <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                  <span>Insulated Cold-Chain Transit</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#334155" }}>
                  <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                  <span>Same-Day Digital Reports (6-12h)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#334155" }}>
                  <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                  <span>Automated Portal & WhatsApp Sync</span>
                </div>
              </div>
            </div>

            {/* Individual Lab Tests Directory */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    Lab & Blood Tests Directory ({filteredHomeTests.length})
                  </h3>
                  <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "2px 0 0" }}>
                    Doorstep blood sample collection with CallMedex fixed transparent tariffs
                  </p>
                </div>

                {/* Search Bar */}
                <div style={{ position: "relative", minWidth: 280, maxWidth: 360, width: "100%" }}>
                  <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    value={labSearchQuery}
                    onChange={(e) => setLabSearchQuery(e.target.value)}
                    placeholder="Search CBC, Lipid, Thyroid, Sugar..."
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 38px",
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.88rem",
                      background: "#fff",
                      outline: "none",
                    }}
                  />
                  {labSearchQuery && (
                    <button
                      onClick={() => setLabSearchQuery("")}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Category Chips */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 10,
                  marginBottom: 16,
                }}
              >
                {SUB_CATEGORIES.map((cat) => {
                  const active = selectedSubCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedSubCategory(cat.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: active ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                        background: active ? "#e0f2fe" : "#ffffff",
                        color: active ? "#0369a1" : "#475569",
                        fontWeight: active ? 700 : 500,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Grid of Lab Tests */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
                {filteredHomeTests.slice(0, 48).map((t, idx) => {
                  const savings = t.mrp - t.price;
                  const pct = t.mrp > 0 ? Math.round((savings / t.mrp) * 100) : 0;
                  return (
                    <div
                      key={idx}
                      className="card"
                      style={{
                        background: "#fff",
                        padding: "16px 18px",
                        borderRadius: 14,
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 12,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <TestTube2 size={16} style={{ color: "#0284c7", flexShrink: 0 }} />
                          <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#0f172a" }}>
                            {t.name}
                          </h4>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 600, marginTop: 4 }}>
                          • Fasting 8-10 hrs · Report in 6-12h
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                            <span style={{ color: "#94a3b8", textDecoration: "line-through", fontSize: "0.76rem" }}>
                              ₹{t.mrp.toLocaleString("en-IN")}
                            </span>
                            <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                              ₹{t.price.toLocaleString("en-IN")}
                            </span>
                          </div>
                          {pct > 0 && (
                            <span style={{ fontSize: "0.68rem", color: "#15803d", fontWeight: 700 }}>
                              Save {pct}%
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/booking?type=lab&name=${encodeURIComponent(t.name)}&price=${t.price}&mode=home`}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "#0284c7",
                            color: "#fff",
                            textDecoration: "none",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>Book</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredHomeTests.length > 48 && (
                <div style={{ textAlign: "center", marginTop: 24 }}>
                  <p style={{ color: "#64748b", fontSize: "0.88rem" }}>
                    Showing 48 of {filteredHomeTests.length} tests. Use search above to narrow down.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: WALK-IN DIAGNOSTIC CENTRES (LOCATION BASED WITH MODAL)        */}
        {/* ==================================================================== */}
        {primaryTab === "walkin" && (
          <div>
            {/* Location Picker Banner */}
            <div
              className="glass-card"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.9) 100%)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(2,132,199,0.2)",
                borderRadius: 20,
                padding: "24px 28px",
                marginBottom: 32,
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0284c7", fontWeight: 700, fontSize: "0.85rem", marginBottom: 4 }}>
                    <MapPin size={16} />
                    <span>SELECT YOUR CURRENT DISTRICT / CITY</span>
                  </div>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>
                    Find Verified Diagnostic & Imaging Centres Near You
                  </h2>
                  <p style={{ color: "#64748b", fontSize: "0.88rem", margin: 0 }}>
                    Showing accredited centres with high-field MRI, CT, digital ultrasound and pathology labs in your area.
                  </p>
                </div>

                <div style={{ minWidth: 280 }}>
                  <StateDistrictPicker
                    stateValue={loc.state}
                    districtValue={loc.district}
                    detected={loc.detected}
                    onChange={setLoc}
                  />
                </div>
              </div>
            </div>

            {/* List of Verified Diagnostic Centers */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Accredited Centres in {loc.district || loc.state} ({centers.length})
                </h3>
                <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={14} /> CallMedex Verified & Audited
                </span>
              </div>

              {loadingCenters ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}>
                  <Clock size={24} style={{ animation: "spin 1.5s linear infinite", marginBottom: 8 }} />
                  <div>Loading accredited diagnostic centres...</div>
                </div>
              ) : centers.length === 0 ? (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 16,
                    padding: "48px 24px",
                    textAlign: "center",
                    border: "1px dashed #cbd5e1",
                  }}
                >
                  <Building2 size={36} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
                  <h4 style={{ fontSize: "1.1rem", color: "#334155", margin: "0 0 6px" }}>
                    No verified partner centres found in {loc.district} yet.
                  </h4>
                  <p style={{ color: "#64748b", fontSize: "0.88rem", margin: "0 0 16px" }}>
                    Switch to <strong>Visakhapatnam</strong> to preview active partner centres, or choose Home Sample Collection.
                  </p>
                  <button
                    onClick={() => {
                      setLoc({ state: "Andhra Pradesh", district: "Visakhapatnam", detected: false });
                    }}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 10,
                      background: "#0284c7",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    View Visakhapatnam Centres
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
                  {centers.map((center) => (
                    <div
                      key={center.id}
                      className="glass-card"
                      style={{
                        background: "#ffffff",
                        borderRadius: 20,
                        border: "1px solid #e2e8f0",
                        padding: "24px 24px",
                        boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        transition: "all 0.25s ease",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <span
                              style={{
                                background: "#e0f2fe",
                                color: "#0369a1",
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                marginBottom: 6,
                              }}
                            >
                              <ShieldCheck size={12} /> VERIFIED CENTRE
                            </span>
                            <h4 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                              {center.name}
                            </h4>
                          </div>
                          {center.rating && (
                            <div
                              style={{
                                background: "#fef3c7",
                                color: "#92400e",
                                padding: "4px 8px",
                                borderRadius: 8,
                                fontSize: "0.82rem",
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Star size={14} fill="#f59e0b" style={{ color: "#f59e0b" }} />
                              <span>{center.rating}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.84rem", color: "#64748b", marginBottom: 6 }}>
                          <MapPin size={14} style={{ color: "#0284c7" }} />
                          <span>{center.address || `${center.city}, ${center.state}`}</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#64748b", marginBottom: 14 }}>
                          <Clock size={14} style={{ color: "#0284c7" }} />
                          <span>Hours: {center.timing}</span>
                        </div>

                        {/* Available Facilities Badges */}
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>
                            Key Imaging & Scan Equipment
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(center.facilities || []).map((fac, i) => (
                              <span
                                key={i}
                                style={{
                                  background: "#f8fafc",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: 8,
                                  padding: "3px 8px",
                                  fontSize: "0.74rem",
                                  color: "#334155",
                                  fontWeight: 600,
                                }}
                              >
                                {fac}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action Button: Opens the Glassmorphic Center Modal */}
                      <div style={{ paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                        <button
                          onClick={() => {
                            setActiveCenterModal(center);
                            setModalCategory("blood_tests");
                            setModalSearchQuery("");
                          }}
                          style={{
                            width: "100%",
                            padding: "12px 18px",
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                            color: "#ffffff",
                            border: "none",
                            fontWeight: 700,
                            fontSize: "0.92rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <Camera size={16} />
                          <span>View Tests & Book Walk-in</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* ── VISUALLY STUNNING GLASSMORHIC CENTER MODAL WIDGET ──             */}
      {/* ==================================================================== */}
      {activeCenterModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveCenterModal(null);
            }
          }}
        >
          <div
            className="glass-card"
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.25)",
              borderRadius: 24,
              width: "100%",
              maxWidth: 960,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "24px 28px",
                borderBottom: "1px solid #e2e8f0",
                background: "linear-gradient(135deg, #0f172a 0%, #0369a1 100%)",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}
                  >
                    ACCREDITED WALK-IN PARTNER
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#bae6fd" }}>• {activeCenterModal.timing}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#ffffff" }}>
                  {activeCenterModal.name}
                </h3>
                <div style={{ fontSize: "0.82rem", color: "#e0f2fe", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={13} />
                  <span>{activeCenterModal.address || `${activeCenterModal.city}, ${activeCenterModal.state}`}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "rgba(56, 189, 248, 0.2)",
                      color: "#7dd3fc",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Sparkles size={12} />
                    {centerServices.length > 0
                      ? `${centerServices.length} Center Approved Services Reflecting Live`
                      : `134 CallMedex Pre-Approved Diagnostic Tests`}
                  </span>
                  {loadingCenterServices && (
                    <span style={{ fontSize: "0.74rem", color: "#bae6fd", fontStyle: "italic" }}>
                      Refreshing center tariffs...
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setActiveCenterModal(null)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Category Tabs & Search Bar */}
            <div
              style={{
                padding: "16px 28px 12px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {/* Category Pills */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 10,
                  marginBottom: 12,
                }}
              >
                {DIAGNOSTIC_SCOPE_CATEGORIES.map((cat) => {
                  const active = modalCategory === cat.key;
                  const catCount = modalTestPool.filter(
                    (item) => cat.key === "all" || item.category_key === cat.key
                  ).length;
                  const baseLabel = cat.label.replace(/\s*\(\d+\)/, "");
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setModalCategory(cat.key)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 12,
                        border: active ? "2px solid #0284c7" : "1px solid #cbd5e1",
                        background: active ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "#ffffff",
                        color: active ? "#ffffff" : "#475569",
                        fontWeight: active ? 700 : 600,
                        fontSize: "0.84rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.2s ease",
                        boxShadow: active ? "0 4px 12px rgba(2, 132, 199, 0.3)" : "none",
                      }}
                    >
                      {baseLabel} ({catCount})
                    </button>
                  );
                })}
              </div>

              {/* Inline Search Bar inside Modal */}
              <div style={{ position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Filter tests by name (e.g. Brain, Chest, Knee, Thyroid, CBC)..."
                  style={{
                    width: "100%",
                    padding: "10px 16px 10px 42px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    outline: "none",
                    background: "#ffffff",
                  }}
                />
                {modalSearchQuery && (
                  <button
                    onClick={() => setModalSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body / Scrollable Test Items List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 28px",
                background: "#f1f5f9",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>
                  Showing {filteredModalTests.length} tests and imaging procedures
                </div>
                <div style={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 700 }}>
                  • CallMedex Partner Negotiated Tariffs
                </div>
              </div>

              {filteredModalTests.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                  <TestTube2 size={32} style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
                  <div>No matching tests found. Try clearing your search filter.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredModalTests.map((item: DiagnosticScopeItem) => {
                    const mrp = Math.round(item.price * 1.3);
                    return (
                      <div
                        key={item.id}
                        style={{
                          background: "#ffffff",
                          borderRadius: 14,
                          padding: "16px 20px",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 16,
                          flexWrap: "wrap",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span
                              style={{
                                background: "#f0f9ff",
                                color: "#0369a1",
                                border: "1px solid #bae6fd",
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: "0.7rem",
                                fontWeight: 700,
                              }}
                            >
                              {item.category}
                            </span>
                            <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "#0f172a" }}>
                              {item.name}
                            </h4>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", lineHeight: 1.4 }}>
                            {item.description}
                          </p>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: "#94a3b8", textDecoration: "line-through", fontSize: "0.78rem" }}>
                              ₹{mrp.toLocaleString("en-IN")}
                            </div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0f172a" }}>
                              ₹{item.price.toLocaleString("en-IN")}
                            </div>
                            <div style={{ color: "#16a34a", fontSize: "0.72rem", fontWeight: 700 }}>
                              Walk-in Tariff
                            </div>
                          </div>

                          <Link
                            href={`/booking?type=lab&org=${activeCenterModal.id}&service=${item.id}&name=${encodeURIComponent(item.name)}&price=${item.price}&mode=walkin`}
                            style={{
                              padding: "10px 20px",
                              borderRadius: 10,
                              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                              color: "#ffffff",
                              textDecoration: "none",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Book Walk-In Slot
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading Diagnostics Marketplace...</div>}>
      <DiagnosticsContent />
    </Suspense>
  );
}