"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue, Suspense } from "react";
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
  Star,
  Info,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
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

function requiresFasting(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("fasting") ||
    n.includes("fbs") ||
    n.includes("lipid") ||
    n.includes("cholesterol") ||
    n.includes("triglyceride") ||
    n.includes("glucose, fasting") ||
    n.includes("insulin fasting") ||
    n.includes("iron") ||
    n.includes("metabolic")
  );
}

function DiagnosticsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "walkin" ? "walkin" : "home";

  const [primaryTab, setPrimaryTab] = useState<"home" | "walkin">(initialTab);

  // Home Collection State
  const [labSearchQuery, setLabSearchQuery] = useState("");
  const deferredLabSearchQuery = useDeferredValue(labSearchQuery);
  const [selectedSubCategory, setSelectedSubCategory] = useState("all");

  // Advanced Filter & Sort State
  const [sortBy, setSortBy] = useState<"recommended" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | "discount_desc">("recommended");
  const [priceFilter, setPriceFilter] = useState<"all" | "under_300" | "300_500" | "500_1000" | "above_1000">("all");
  const [fastingFilter, setFastingFilter] = useState<"all" | "fasting" | "non_fasting">("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  // Close filter popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFilterOpen]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setVisibleCount(48);
  }, [deferredLabSearchQuery, selectedSubCategory, sortBy, priceFilter, fastingFilter]);

  // Walk-in Center State
  const [loc, setLoc] = useState({ state: "Andhra Pradesh", district: "Visakhapatnam", detected: false });
  const [centers, setCenters] = useState<DiagnosticCenter[]>([]);
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
            // Only what the centre actually registered — no invented
            // rating, hours or equipment list.
            rating: typeof p.rating === "number" && p.rating > 0 ? p.rating : undefined,
            timing: p.timing || p.operating_hours || "",
            facilities: Array.isArray(p.facilities) ? p.facilities : [],
            min_price: typeof p.min_price === "number" && p.min_price > 0 ? p.min_price : undefined,
          }));
          setCenters(mapped);
        } else {
          setCenters([]);
        }
      } catch (err) {
        setCenters([]);
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

  // Filtered & Sorted Lab Tests for Home Collection
  const filteredHomeTests = useMemo(() => {
    let list = FIXED_PRICES as Array<{ name: string; mrp: number; price: number }>;

    // 1. Sub-Category Filter
    if (selectedSubCategory !== "all") {
      const activeCat = SUB_CATEGORIES.find((c) => c.id === selectedSubCategory);
      if (activeCat?.keywords) {
        list = list.filter((t) =>
          activeCat.keywords.some((kw) => t.name.toLowerCase().includes(kw.toLowerCase()))
        );
      }
    }

    // 2. Search Query (deferred for zero keystroke lag)
    if (deferredLabSearchQuery.trim()) {
      const q = deferredLabSearchQuery.toLowerCase().trim();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }

    // 3. Price Bracket Filter
    if (priceFilter !== "all") {
      if (priceFilter === "under_300") {
        list = list.filter((t) => t.price <= 300);
      } else if (priceFilter === "300_500") {
        list = list.filter((t) => t.price > 300 && t.price <= 500);
      } else if (priceFilter === "500_1000") {
        list = list.filter((t) => t.price > 500 && t.price <= 1000);
      } else if (priceFilter === "above_1000") {
        list = list.filter((t) => t.price > 1000);
      }
    }

    // 4. Fasting Requirement Filter
    if (fastingFilter !== "all") {
      if (fastingFilter === "fasting") {
        list = list.filter((t) => requiresFasting(t.name));
      } else if (fastingFilter === "non_fasting") {
        list = list.filter((t) => !requiresFasting(t.name));
      }
    }

    // 5. Sorting
    if (sortBy === "price_asc") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === "name_asc") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name_desc") {
      list = [...list].sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "discount_desc") {
      list = [...list].sort((a, b) => {
        const discA = a.mrp > a.price ? (a.mrp - a.price) / a.mrp : 0;
        const discB = b.mrp > b.price ? (b.mrp - b.price) / b.mrp : 0;
        return discB - discA;
      });
    }

    return list;
  }, [selectedSubCategory, deferredLabSearchQuery, priceFilter, fastingFilter, sortBy]);

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
      {/* ── Top Hero Header with Signature CallMedex Royal Blue Gradient ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #0284c7 100%)",
          color: "#fff",
          padding: "56px 20px 64px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient background glows */}
        <div
          style={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 350,
            height: 350,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(255,255,255,0) 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -50,
            left: -50,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(2,132,199,0.2) 0%, rgba(255,255,255,0) 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#38bdf8",
              marginBottom: 18,
              boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
            }}
          >
            <Sparkles size={16} style={{ color: "#38bdf8" }} />
            CALLMEDEX DIAGNOSTICS &amp; IMAGING NETWORK
          </div>

          <h1
            style={{
              fontSize: "clamp(2.1rem, 4.2vw, 3.1rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.16,
              margin: "0 0 16px",
              color: "#ffffff",
              textShadow: "0 2px 20px rgba(0,0,0,0.35)",
            }}
          >
            Book Diagnostics,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #38bdf8 0%, #e0f2fe 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: "inline-block",
              }}
            >
              Scans &amp; Lab Tests
            </span>
          </h1>

          <p
            style={{
              fontSize: "1.125rem",
              fontWeight: 450,
              color: "rgba(240, 249, 255, 0.95)",
              maxWidth: 780,
              margin: "0 auto 30px",
              lineHeight: 1.65,
              textShadow: "0 1px 4px rgba(0,0,0,0.2)",
            }}
          >
            Choose convenient doorstep sample collection at home, or book walk-in appointments at accredited diagnostic &amp; imaging centres.
          </p>

          {/* Primary Bifurcation Tabs */}
          <div
            style={{
              display: "inline-flex",
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(16px)",
              padding: 6,
              borderRadius: 16,
              border: "1px solid rgba(56, 189, 248, 0.3)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
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
                6:00 – 11:00 AM
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
                    Doorstep Blood Sample Collection
                  </h2>
                  <p style={{ color: "#475569", fontSize: "0.95rem", margin: 0, maxWidth: 680, lineHeight: 1.5 }}>
                    Certified CallMedex phlebotomists arrive at your home with temperature-controlled cold storage kits. Fasting samples collected between <strong>6:00 AM and 11:00 AM</strong> for accurate results.
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
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0369a1" }}>06:00 AM – 11:00 AM</div>
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
              {/* Header with Title and Search/Filter Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
                    Lab &amp; Blood Tests Directory ({filteredHomeTests.length})
                  </h3>
                  <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "2px 0 0" }}>
                    Doorstep blood sample collection with CallMedex fixed transparent tariffs
                  </p>
                </div>

                {/* Search Bar + Glass Filter & Sort Button */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 460, minWidth: 280 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type="text"
                      value={labSearchQuery}
                      onChange={(e) => setLabSearchQuery(e.target.value)}
                      placeholder="Search CBC, Lipid, Thyroid, Sugar..."
                      style={{
                        width: "100%",
                        padding: "10px 36px 10px 38px",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.88rem",
                        background: "#fff",
                        outline: "none",
                        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
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
                        aria-label="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Filter & Sort Popover Trigger */}
                  <div style={{ position: "relative" }} ref={filterPopoverRef}>
                    {(() => {
                      const activeFilterCount =
                        (sortBy !== "recommended" ? 1 : 0) +
                        (priceFilter !== "all" ? 1 : 0) +
                        (fastingFilter !== "all" ? 1 : 0);
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="btn-press"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "10px 14px",
                              borderRadius: 12,
                              border: isFilterOpen || activeFilterCount > 0 ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                              background: isFilterOpen || activeFilterCount > 0 ? "#e0f2fe" : "#ffffff",
                              color: isFilterOpen || activeFilterCount > 0 ? "#0369a1" : "#334155",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              cursor: "pointer",
                              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                              whiteSpace: "nowrap",
                              boxShadow: activeFilterCount > 0 ? "0 2px 8px rgba(2, 132, 199, 0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
                            }}
                            aria-label="Filter and Sort tests"
                          >
                            <SlidersHorizontal size={16} />
                            <span>Filter &amp; Sort</span>
                            {activeFilterCount > 0 && (
                              <span
                                style={{
                                  background: "#0284c7",
                                  color: "#ffffff",
                                  borderRadius: 999,
                                  padding: "1px 6px",
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                }}
                              >
                                {activeFilterCount}
                              </span>
                            )}
                          </button>

                          {/* Filter Popover */}
                          {isFilterOpen && (
                            <div
                              className="glass-filter-popover"
                              style={{
                                position: "absolute",
                                top: "calc(100% + 8px)",
                                right: 0,
                                zIndex: 100,
                                width: "min(330px, calc(100vw - 32px))",
                                background: "#ffffff",
                                borderRadius: 16,
                                boxShadow: "0 20px 38px -8px rgba(15, 23, 42, 0.18), 0 4px 14px rgba(0, 0, 0, 0.06)",
                                border: "1px solid rgba(2, 132, 199, 0.2)",
                                padding: "16px 18px",
                              }}
                            >
                              {/* Popover Header */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #f1f5f9" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: "0.92rem", color: "#0f172a" }}>
                                  <SlidersHorizontal size={16} style={{ color: "#0284c7" }} />
                                  <span>Filter &amp; Sort Tests</span>
                                </div>
                                {activeFilterCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSortBy("recommended");
                                      setPriceFilter("all");
                                      setFastingFilter("all");
                                    }}
                                    className="btn-press"
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#0284c7",
                                      fontSize: "0.76rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      padding: 0,
                                    }}
                                  >
                                    <RotateCcw size={12} />
                                    <span>Reset</span>
                                  </button>
                                )}
                              </div>

                              {/* 1. Sort By */}
                              <div style={{ marginBottom: 14 }}>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                                  Sort Tests By
                                </label>
                                <div style={{ position: "relative" }}>
                                  <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    style={{
                                      width: "100%",
                                      padding: "8px 30px 8px 12px",
                                      borderRadius: 10,
                                      border: "1px solid #cbd5e1",
                                      background: "#f8fafc",
                                      color: "#0f172a",
                                      fontSize: "0.84rem",
                                      fontWeight: 600,
                                      outline: "none",
                                      cursor: "pointer",
                                      appearance: "none",
                                    }}
                                  >
                                    <option value="recommended">Recommended (Default)</option>
                                    <option value="price_asc">Price: Low to High</option>
                                    <option value="price_desc">Price: High to Low</option>
                                    <option value="name_asc">Name: A to Z</option>
                                    <option value="name_desc">Name: Z to A</option>
                                    <option value="discount_desc">Highest Discount %</option>
                                  </select>
                                  <ArrowUpDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748b" }} />
                                </div>
                              </div>

                              {/* 2. Price Bracket */}
                              <div style={{ marginBottom: 14 }}>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                                  Price Range
                                </label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {[
                                    { id: "all", label: "All Prices" },
                                    { id: "under_300", label: "Under ₹300" },
                                    { id: "300_500", label: "₹300 – ₹500" },
                                    { id: "500_1000", label: "₹500 – ₹1,000" },
                                    { id: "above_1000", label: "₹1,000+" },
                                  ].map((opt) => {
                                    const isSel = priceFilter === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setPriceFilter(opt.id as any)}
                                        className="btn-press"
                                        style={{
                                          padding: "5px 10px",
                                          borderRadius: 8,
                                          fontSize: "0.78rem",
                                          fontWeight: isSel ? 700 : 500,
                                          border: isSel ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                                          background: isSel ? "#e0f2fe" : "#ffffff",
                                          color: isSel ? "#0369a1" : "#475569",
                                          cursor: "pointer",
                                          transition: "all 0.15s ease",
                                        }}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 3. Fasting Requirement */}
                              <div style={{ marginBottom: 16 }}>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                                  Fasting Protocol
                                </label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {[
                                    { id: "all", label: "All Tests" },
                                    { id: "fasting", label: "Fasting Required" },
                                    { id: "non_fasting", label: "No Fasting" },
                                  ].map((opt) => {
                                    const isSel = fastingFilter === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setFastingFilter(opt.id as any)}
                                        className="btn-press"
                                        style={{
                                          padding: "5px 10px",
                                          borderRadius: 8,
                                          fontSize: "0.78rem",
                                          fontWeight: isSel ? 700 : 500,
                                          border: isSel ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                                          background: isSel ? "#e0f2fe" : "#ffffff",
                                          color: isSel ? "#0369a1" : "#475569",
                                          cursor: "pointer",
                                          transition: "all 0.15s ease",
                                        }}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Apply Button */}
                              <button
                                type="button"
                                onClick={() => setIsFilterOpen(false)}
                                className="btn-press"
                                style={{
                                  width: "100%",
                                  padding: "9px 14px",
                                  borderRadius: 10,
                                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                                  color: "#ffffff",
                                  border: "none",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  cursor: "pointer",
                                  boxShadow: "0 2px 10px rgba(2, 132, 199, 0.3)",
                                }}
                              >
                                Apply &amp; View Results ({filteredHomeTests.length})
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Sub-Category Chips */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 10,
                  marginBottom: 10,
                }}
              >
                {SUB_CATEGORIES.map((cat) => {
                  const active = selectedSubCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedSubCategory(cat.id)}
                      className="btn-press"
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

              {/* Active Filter Dismissal Chips Bar */}
              {(() => {
                const hasActive =
                  sortBy !== "recommended" ||
                  priceFilter !== "all" ||
                  fastingFilter !== "all" ||
                  selectedSubCategory !== "all" ||
                  labSearchQuery.trim().length > 0;

                if (!hasActive) return null;

                const sortLabels: Record<string, string> = {
                  price_asc: "Price: Low to High",
                  price_desc: "Price: High to Low",
                  name_asc: "Name: A to Z",
                  name_desc: "Name: Z to A",
                  discount_desc: "Highest Discount %",
                };

                const priceLabels: Record<string, string> = {
                  under_300: "Under ₹300",
                  300_500: "₹300 – ₹500",
                  500_1000: "₹500 – ₹1,000",
                  above_1000: "₹1,000+",
                };

                const fastingLabels: Record<string, string> = {
                  fasting: "Fasting Required",
                  non_fasting: "No Fasting",
                };

                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 16,
                      padding: "8px 12px",
                      background: "rgba(240, 249, 255, 0.7)",
                      borderRadius: 12,
                      border: "1px solid #e0f2fe",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0369a1" }}>
                      Active Filters:
                    </span>

                    {labSearchQuery.trim() && (
                      <span
                        className="active-filter-tag"
                        onClick={() => setLabSearchQuery("")}
                        style={{ cursor: "pointer" }}
                        title="Remove search filter"
                      >
                        <span>Search: &ldquo;{labSearchQuery}&rdquo;</span>
                        <X size={12} />
                      </span>
                    )}

                    {selectedSubCategory !== "all" && (
                      <span
                        className="active-filter-tag"
                        onClick={() => setSelectedSubCategory("all")}
                        style={{ cursor: "pointer" }}
                        title="Remove category filter"
                      >
                        <span>Category: {SUB_CATEGORIES.find((c) => c.id === selectedSubCategory)?.label}</span>
                        <X size={12} />
                      </span>
                    )}

                    {sortBy !== "recommended" && (
                      <span
                        className="active-filter-tag"
                        onClick={() => setSortBy("recommended")}
                        style={{ cursor: "pointer" }}
                        title="Reset sort"
                      >
                        <span>Sort: {sortLabels[sortBy]}</span>
                        <X size={12} />
                      </span>
                    )}

                    {priceFilter !== "all" && (
                      <span
                        className="active-filter-tag"
                        onClick={() => setPriceFilter("all")}
                        style={{ cursor: "pointer" }}
                        title="Reset price filter"
                      >
                        <span>Price: {priceLabels[priceFilter]}</span>
                        <X size={12} />
                      </span>
                    )}

                    {fastingFilter !== "all" && (
                      <span
                        className="active-filter-tag"
                        onClick={() => setFastingFilter("all")}
                        style={{ cursor: "pointer" }}
                        title="Reset fasting filter"
                      >
                        <span>Fasting: {fastingLabels[fastingFilter]}</span>
                        <X size={12} />
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setLabSearchQuery("");
                        setSelectedSubCategory("all");
                        setSortBy("recommended");
                        setPriceFilter("all");
                        setFastingFilter("all");
                      }}
                      className="btn-press"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: "2px 6px",
                        marginLeft: "auto",
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                );
              })()}

              {/* Grid of Lab Tests */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
                {filteredHomeTests.slice(0, visibleCount).map((t, idx) => {
                  const savings = t.mrp - t.price;
                  const pct = t.mrp > 0 ? Math.round((savings / t.mrp) * 100) : 0;
                  const isFasting = requiresFasting(t.name);
                  return (
                    <div
                      key={idx}
                      className="card smooth-card-hover"
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
                        <div style={{ fontSize: "0.75rem", color: isFasting ? "#b45309" : "#16a34a", fontWeight: 600, marginTop: 4 }}>
                          • {isFasting ? "Fasting 8-10 hrs" : "No Fasting Required"} · Report in 6-12h
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
                          className="btn-press"
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

              {/* Empty State when no tests match */}
              {filteredHomeTests.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 16px", background: "#f8fafc", borderRadius: 16, border: "1px dashed #cbd5e1", marginTop: 16 }}>
                  <TestTube2 size={36} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
                  <h4 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "1.05rem", fontWeight: 700 }}>No Tests Found</h4>
                  <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "0.85rem" }}>
                    Try adjusting your search query, price bracket, or category filter.
                  </p>
                  <button
                    onClick={() => {
                      setLabSearchQuery("");
                      setSelectedSubCategory("all");
                      setPriceFilter("all");
                      setFastingFilter("all");
                      setSortBy("recommended");
                    }}
                    className="btn-press"
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      background: "#0284c7",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Reset All Filters
                  </button>
                </div>
              )}

              {/* Progressive Pagination Controls */}
              {filteredHomeTests.length > visibleCount && (
                <div style={{ textAlign: "center", marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <p style={{ color: "#64748b", fontSize: "0.88rem", margin: 0 }}>
                    Showing {Math.min(visibleCount, filteredHomeTests.length)} of {filteredHomeTests.length} tests
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button
                      onClick={() => setVisibleCount((prev) => Math.min(prev + 48, filteredHomeTests.length))}
                      className="btn-press"
                      style={{
                        padding: "10px 22px",
                        borderRadius: 10,
                        background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(2, 132, 199, 0.25)",
                      }}
                    >
                      Load 48 More Tests
                    </button>
                    <button
                      onClick={() => setVisibleCount(filteredHomeTests.length)}
                      className="btn-press"
                      style={{
                        padding: "10px 18px",
                        borderRadius: 10,
                        background: "#ffffff",
                        color: "#0369a1",
                        border: "1.5px solid #cbd5e1",
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        cursor: "pointer",
                      }}
                    >
                      Show All ({filteredHomeTests.length})
                    </button>
                  </div>
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

                        {center.timing && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#64748b", marginBottom: 14 }}>
                            <Clock size={14} style={{ color: "#0284c7" }} />
                            <span>Hours: {center.timing}</span>
                          </div>
                        )}

                        {/* Available Facilities Badges */}
                        {(center.facilities || []).length > 0 && (
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
                        )}
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
                  {activeCenterModal.timing && <span style={{ fontSize: "0.8rem", color: "#bae6fd" }}>• {activeCenterModal.timing}</span>}
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