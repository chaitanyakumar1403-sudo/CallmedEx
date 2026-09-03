"use client";

/**
 * Diagnostics — two-model marketplace: blood tests are partner-blind (CallMedex
 * fixed rate, home collection); walk-in/imaging tests show every verified centre
 * with prices, ratings, and direct booking per provider.
 *
 * Blood tests (lab_test category): the patient books with CallMedex, who
 * allocates a partner centre internally. The partner is never named, rated or
 * compared on this screen — only the CallMedex rate, MRP saving, home vs walk-in
 * coverage, and partner count are shown. Prices are cross-checked against the
 * fixed-rate catalogue (lab-test-prices.json) for the "CallMedex fixed rate"
 * display, falling back to the API fulfilment price when the test has no
 * entry in the fixed-rate catalogue.
 *
 * Imaging and walk-in tests (imaging category): the patient browses every
 * verified partner centre that offers the test, with price, MRP strike, rating,
 * and a Book button that links directly to that centre's booking page.
 *
 * See CLAUDE.md §7 — Tier A (home-serviceable, partner-blind) vs Tier B
 * (centre-visible, slot-based) model.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StateDistrictPicker from "@/components/StateDistrictPicker";
import FIXED_PRICES from "@/data/lab-test-prices.json";
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
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Test = {
  id: string;
  name: string;
  slug: string;
  category: string;
  synonyms?: string[];
  provider_count?: number;
  typical_turnaround_hours?: number;
  preparation?: string;
  sub_category?: string;
};

// The ONE CallMedex fulfilment option for the selected test. Never a list of
// partners — no provider name, id, rating or address. `partner_count` is the
// one coverage signal that's safe to show, because it doesn't identify anyone.
type Fulfilment = {
  price: number;
  mrp: number;
  savings: number;
  home_available: boolean;
  walk_in_required: boolean;
  urgent_available: boolean;
  urgent_surcharge: number;
  partner_count: number;
};

// A partner-centre offer for imaging/walk-in tests. Here the provider IS
// visible — the patient picks the centre they want.
type Offer = {
  service_id: string;
  service_name: string;
  provider_user_id: string;
  provider_name: string;
  provider_type?: string;
  city: string;
  state: string;
  rating: number;
  home_available: boolean;
  urgent_available: boolean;
  turnaround_hours?: number;
  price: number;
  mrp: number;
  savings: number;
  payable: number;
  urgent_surcharge: number;
};

// Fixed-rate catalogue — names may differ from the search catalog so we
// normalise and fuzzy-match on both sides.
const FIXED_RATE_CATALOG = FIXED_PRICES as Array<{ name: string; mrp: number; price: number }>;

function normName(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function lookupFixedRate(testName: string): { mrp: number; price: number } | null {
  const target = normName(testName);
  // 1. Exact normalised match
  let hit = FIXED_RATE_CATALOG.find((e) => normName(e.name) === target);
  if (hit) return hit;
  // 2. Contains-fallback — when multiple candidates contain the target,
  //    prefer the one with the SHORTEST normalised name (closest to query).
  const candidates = FIXED_RATE_CATALOG.filter(
    (e) => target.includes(normName(e.name)) || normName(e.name).includes(target)
  );
  if (candidates.length > 0) {
    candidates.sort((a, b) => normName(a.name).length - normName(b.name).length);
    return candidates[0];
  }
  return null;
}

// Curated list shown when the popular endpoint returns nothing bookable (all
// provider_count 0 or empty response).
const CURATED_NAMES = [
  "CBC", "HbA1c", "Thyroid Profile", "Lipid Profile", "Vitamin D",
  "Vitamin B12", "KFT", "LFT", "Fasting Blood Sugar", "Urine Routine",
  "ECG", "Chest X-Ray",
];

// Walk-in-only services (dental, physiotherapy) are deliberately NOT here —
// a root canal can't be home-collected. They are discoverable under
// Consultation → Walk-in instead.
const CATEGORIES = [
  { id: "lab_test", label: "Lab Tests" },
  { id: "imaging", label: "Imaging & Scans" },
];

// Sub-categories for organized browsing within each category
const SUB_CATEGORIES: Record<string, { id: string; label: string }[]> = {
  lab_test: [
    { id: "blood_test", label: "Blood Tests" },
    { id: "hormone", label: "Hormone Tests" },
    { id: "diabetes", label: "Diabetes & Sugar" },
    { id: "thyroid", label: "Thyroid Panel" },
    { id: "liver", label: "Liver Function" },
    { id: "kidney", label: "Kidney Function" },
    { id: "allergy", label: "Allergy Tests" },
    { id: "vitamin", label: "Vitamin & Nutrition" },
    { id: "infection", label: "Infection Markers" },
    { id: "urine_stool", label: "Urine & Stool" },
  ],
  imaging: [
    { id: "mri", label: "MRI Scans" },
    { id: "ct_scan", label: "CT Scans" },
    { id: "xray", label: "X-Ray" },
    { id: "ultrasound", label: "Ultrasound" },
    { id: "ecg_echo", label: "ECG & Echo" },
    { id: "dexa", label: "DEXA / Bone Density" },
  ],
};

// Maps sub-category IDs to search keywords for the API
const SUB_CATEGORY_KEYWORDS: Record<string, string[]> = {
  blood_test: ["blood", "cbc", "haemoglobin", "platelet", "rbc", "wbc", "blood count", "blood group"],
  hormone: ["hormone", "testosterone", "estrogen", "prolactin", "cortisol", "fsh", "lh", "growth hormone"],
  diabetes: ["diabetes", "hba1c", "glucose", "sugar", "fasting glucose", "insulin", "ogtt", "gtt"],
  thyroid: ["thyroid", "t3", "t4", "tsh", "thyroid profile", "free t3", "free t4"],
  liver: ["liver", "lft", "sgot", "sgpt", "bilirubin", "alkaline phosphatase", "ggt", "albumin"],
  kidney: ["kidney", "kft", "creatinine", "urea", "uric acid", "bun", "egfr", "electrolytes"],
  allergy: ["allergy", "ige", "skin prick", "food allergy", "dust", "pollen"],
  vitamin: ["vitamin", "vitamin d", "vitamin b12", "folate", "folic acid", "iron", "ferritin", "calcium"],
  infection: ["infection", "crp", "esr", "procalcitonin", "widal", "dengue", "malaria", "typhoid", "hiv", "hepatitis"],
  urine_stool: ["urine", "stool", "urinalysis", "urine culture", "stool culture", "occult blood"],
  mri: ["mri", "magnetic resonance"],
  ct_scan: ["ct scan", "ct", "computed tomography", "cect"],
  xray: ["x-ray", "xray", "x ray", "radiograph"],
  ultrasound: ["ultrasound", "usg", "sonography", "doppler"],
  ecg_echo: ["ecg", "echo", "echocardiogram", "electrocardiogram", "2d echo", "treadmill"],
  dexa: ["dexa", "bone density", "bmd", "bone mineral"],
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

export default function DiagnosticsPage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Test[]>([]);
  const [popular, setPopular] = useState<Test[]>([]);
  const [selected, setSelected] = useState<Test | null>(null);

  const [fulfilment, setFulfilment] = useState<Fulfilment | null>(null);
  const [loadingFulfilment, setLoadingFulfilment] = useState(false);

  // Offers for imaging tests (centre-visible, Tier B)
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // Curated fallback grid when popular returns nothing bookable
  const [curatedTests, setCuratedTests] = useState<Test[]>([]);
  const [curatedLoading, setCuratedLoading] = useState(false);
  const curatedAttempted = useRef(false);

  // Location is a State → District cascade (never free text) so the value
  // always resolves against processing-centre serviceable areas server-side.
  const [locState, setLocState] = useState("");
  const [district, setDistrict] = useState("");
  const [locationDetected, setLocationDetected] = useState(false);
  const [homeOnly, setHomeOnly] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [browse, setBrowse] = useState<Test[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);

  // Browse grid for an empty search box.
  useEffect(() => {
    fetch(`${API}/api/marketplace/tests/popular`)
      .then((r) => r.json())
      .then((d) => setPopular(d.tests || []))
      .catch(() => setPopular([]));
  }, []);

  // ── Curated popular fallback ─────────────────────────────────────────
  // When the popular endpoint returns nothing bookable (all provider_count 0
  // or empty), resolve the curated name list via the search API so the grid
  // never goes blank.
  useEffect(() => {
    if (curatedAttempted.current) return;
    if (popular.length === 0 && !curatedAttempted.current) {
      // Still loading — wait for a second tick to be sure.
      const t = setTimeout(() => {
        if (popular.length === 0 && !curatedAttempted.current) {
          curatedAttempted.current = true;
          fetchCurated();
        }
      }, 2000);
      return () => clearTimeout(t);
    }
    if (!curatedAttempted.current && popular.every((t) => !t.provider_count)) {
      curatedAttempted.current = true;
      fetchCurated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popular]);

  async function fetchCurated() {
    setCuratedLoading(true);
    const results = await Promise.all(
      CURATED_NAMES.map((name) =>
        fetch(`${API}/api/marketplace/tests/search?q=${encodeURIComponent(name)}&limit=1`)
          .then((r) => r.json())
          .then((d) => d.tests?.[0] || null)
          .catch(() => null)
      )
    );
    setCuratedTests(results.filter(Boolean));
    setCuratedLoading(false);
  }

  // Debounced type-ahead
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`${API}/api/marketplace/tests/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.tests || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Browsing a category lists what CallMedex actually carries for it
  useEffect(() => {
    if (!category) {
      setBrowse([]);
      return;
    }

    if (subCategory && SUB_CATEGORY_KEYWORDS[subCategory]) {
      setLoadingBrowse(true);
      const keywords = SUB_CATEGORY_KEYWORDS[subCategory];
      const searchQ = keywords[0];
      fetch(`${API}/api/marketplace/tests/search?q=${encodeURIComponent(searchQ)}&category=${encodeURIComponent(category)}&limit=200`)
        .then((r) => r.json())
        .then((d) => {
          const tests = (d.tests || []) as Test[];
          const filtered = tests.filter((t: Test) => {
            const name = t.name.toLowerCase();
            const syns = (t.synonyms || []).map((s: string) => s.toLowerCase()).join(" ");
            const combined = `${name} ${syns} ${(t.sub_category || "").toLowerCase()}`;
            return keywords.some((kw: string) => combined.includes(kw.toLowerCase()));
          });
          setBrowse(filtered.length > 0 ? filtered : tests);
        })
        .catch(() => setBrowse([]))
        .finally(() => setLoadingBrowse(false));
      return;
    }

    setLoadingBrowse(true);
    fetch(`${API}/api/marketplace/tests/search?category=${encodeURIComponent(category)}&limit=200`)
      .then((r) => r.json())
      .then((d) => setBrowse(d.tests || []))
      .catch(() => setBrowse([]))
      .finally(() => setLoadingBrowse(false));
  }, [category, subCategory]);

  const loadFulfilment = useCallback(
    async (test: Test) => {
      setLoadingFulfilment(true);
      try {
        const url = new URL(`${API}/api/marketplace/fulfilment`);
        url.searchParams.set("catalog_id", test.id);
        if (district.trim()) url.searchParams.set("city", district.trim());
        if (homeOnly) url.searchParams.set("home", "true");
        if (urgent) url.searchParams.set("urgent", "true");

        const res = await fetch(url.toString());
        const data = await res.json();
        setFulfilment(data.fulfilment || null);
      } catch {
        setFulfilment(null);
      } finally {
        setLoadingFulfilment(false);
      }
    },
    [district, homeOnly, urgent]
  );

  // Fetch offers for imaging tests from the offers endpoint
  const loadOffers = useCallback(
    async (test: Test) => {
      setLoadingOffers(true);
      try {
        const url = new URL(`${API}/api/marketplace/offers`);
        url.searchParams.set("catalog_id", test.id);
        if (district.trim()) url.searchParams.set("city", district.trim());
        const res = await fetch(url.toString());
        const data = await res.json();
        setOffers(data.offers || []);
      } catch {
        setOffers([]);
      } finally {
        setLoadingOffers(false);
      }
    },
    [district]
  );

  function pick(test: Test) {
    setSelected(test);
    setSuggestions([]);
    setQuery(test.name);
    setFulfilment(null);
    setOffers([]);
    if (test.category === "imaging") {
      loadOffers(test);
    } else {
      loadFulfilment(test);
    }
  }

  // Re-price when a filter changes
  useEffect(() => {
    if (selected) {
      if (selected.category === "imaging") {
        loadOffers(selected);
      } else {
        loadFulfilment(selected);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeOnly, urgent]);

  const handleLocationChange = useCallback(
    (next: { state: string; district: string; detected: boolean }) => {
      setLocState(next.state);
      setDistrict(next.district);
      setLocationDetected(next.detected);
    },
    []
  );

  useEffect(() => {
    if (selected) {
      if (selected.category === "imaging") {
        loadOffers(selected);
      } else {
        loadFulfilment(selected);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  // Compute whether to show the curated fallback
  const isPopularBookable = popular.length > 0 && popular.some((t) => t.provider_count && t.provider_count > 0);

  // Fixed rate price for the selected test (blood tests only)
  const fixedRate = selected && selected.category === "lab_test" ? lookupFixedRate(selected.name) : null;

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Book a lab test or imaging — home collection or verified walk-in centre</h1>
          <p>
            Search across lab tests and imaging. Lab tests are booked at the CallMedex
            fixed rate with home collection where possible. Imaging and walk-in tests
            let you choose from verified partner centres in your area.
          </p>
        </div>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 780, margin: "0 auto 28px", position: "relative" }}>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Try MRI, thyroid, CBC, sugar test..."
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 12,
              border: "1.5px solid #cbd5e1",
              fontSize: "1rem",
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <StateDistrictPicker
              stateValue={locState}
              districtValue={district}
              detected={locationDetected}
              onChange={handleLocationChange}
            />
          </div>

          {suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                zIndex: 20,
                left: 0,
                right: 0,
                marginTop: 6,
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 12px 32px rgba(15,23,42,0.12)",
                overflow: "hidden",
                maxHeight: 360,
                overflowY: "auto",
              }}
            >
              {suggestions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pick(t)}
                  style={{
                    display: "flex",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 18px",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: "0.95rem",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <TestTube2 size={16} style={{ color: "var(--cm-active)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <strong>{t.name}</strong>
                    {t.sub_category && (
                      <span style={{ color: "#64748b", fontSize: "0.78rem", marginLeft: 6 }}>
                        {t.sub_category}
                      </span>
                    )}
                    {t.synonyms?.length ? (
                      <span style={{ color: "#94a3b8", fontSize: "0.78rem", display: "block" }}>
                        {t.synonyms.slice(0, 3).join(", ")}
                      </span>
                    ) : null}
                  </div>
                  <span style={{
                    background: "#f1f5f9", color: "#64748b", padding: "2px 8px",
                    borderRadius: 12, fontSize: "0.68rem", fontWeight: 600, whiteSpace: "nowrap",
                  }}>
                    {CATEGORIES.find(c => c.id === t.category)?.label || t.category}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <label style={filterLabel}>
              <input
                type="checkbox"
                checked={homeOnly}
                onChange={(e) => setHomeOnly(e.target.checked)}
              />
              Home collection only
            </label>
            <label style={{ ...filterLabel, color: urgent ? "var(--cm-urgent)" : "var(--cm-ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
              />
              <AlertCircle size={14} style={{ color: "var(--cm-urgent)" }} /> Urgent priority dispatch
            </label>
          </div>
        </div>

        {/* ── Browse by category ─────────────────────────────────────── */}
        {!selected && (
          <>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              {CATEGORIES.map((c) => {
                const on = category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCategory(on ? "" : c.id);
                      setSubCategory("");
                    }}
                    style={{
                      padding: "10px 20px", borderRadius: 999, cursor: "pointer",
                      border: on ? "2px solid var(--cm-navy)" : "1px solid var(--cm-line-strong)",
                      background: on ? "var(--cm-navy)" : "#fff",
                      color: on ? "#fff" : "var(--cm-ink-2)",
                      fontWeight: 700, fontSize: "0.88rem",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* ── Sub-category chips ─────────────────────────────────── */}
            {category && SUB_CATEGORIES[category] && (
              <div style={{
                display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap",
                marginBottom: 20, padding: "12px 16px",
                background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0",
              }}>
                <button
                  onClick={() => setSubCategory("")}
                  style={{
                    padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                    border: !subCategory ? "2px solid var(--cm-active)" : "1px solid var(--cm-line-strong)",
                    background: !subCategory ? "var(--cm-active-surface)" : "#fff",
                    color: !subCategory ? "var(--cm-active)" : "var(--cm-ink-3)",
                    fontWeight: 700, fontSize: "0.78rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  All
                </button>
                {SUB_CATEGORIES[category].map((sc) => {
                  const active = subCategory === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => setSubCategory(active ? "" : sc.id)}
                      style={{
                        padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                        border: active ? "2px solid var(--cm-active)" : "1px solid var(--cm-line-strong)",
                        background: active ? "var(--cm-active-surface)" : "#fff",
                        color: active ? "var(--cm-active)" : "var(--cm-ink-2)",
                        fontWeight: active ? 700 : 500, fontSize: "0.78rem",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Category / Sub-category listing ───────────────────────── */}
        {!selected && category && (
          <div style={{ marginBottom: 28 }}>
            {loadingBrowse ? (
              <p style={{ textAlign: "center", color: "#64748b" }}>Loading services…</p>
            ) : (
              <>
                <h3 style={{ textAlign: "center", color: "#475569", marginBottom: 14 }}>
                  {browse.length}{" "}
                  {subCategory
                    ? SUB_CATEGORIES[category]?.find((sc) => sc.id === subCategory)?.label
                    : CATEGORIES.find((c) => c.id === category)?.label}{" "}
                  service{browse.length === 1 ? "" : "s"}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                  {browse.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => pick(t)}
                      style={{
                        textAlign: "left", cursor: "pointer", padding: "14px 16px",
                        borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff",
                        transition: "all 0.2s ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.borderColor = "#0284c7";
                        (e.target as HTMLElement).style.boxShadow = "0 4px 12px rgba(2,132,199,0.12)";
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.borderColor = "#e2e8f0";
                        (e.target as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <TestTube2 size={16} style={{ color: "var(--cm-active)", flexShrink: 0 }} />
                        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0f172a" }}>{t.name}</div>
                      </div>
                      {t.sub_category && (
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4, marginLeft: 24 }}>{t.sub_category}</div>
                      )}
                    </button>
                  ))}
                </div>
                {browse.length === 0 && category === "lab_test" && (() => {
                  const keywords = subCategory ? (SUB_CATEGORY_KEYWORDS[subCategory] || []) : [];
                  const matchedTests = keywords.length > 0
                    ? FIXED_RATE_CATALOG.filter((t) =>
                        keywords.some((kw) => t.name.toLowerCase().includes(kw.toLowerCase())))
                    : FIXED_RATE_CATALOG.slice(0, 40);
                  return matchedTests.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginTop: 12 }}>
                      {matchedTests.map((t, i) => {
                        const pct = t.mrp > 0 ? Math.round((1 - t.price / t.mrp) * 100) : 0;
                        return (
                          <a
                            key={i}
                            href="/booking?type=lab"
                            style={{
                              textAlign: "left", padding: "14px 16px",
                              borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff",
                              textDecoration: "none", color: "inherit",
                              transition: "all 0.2s ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.88rem" }}>{t.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                              <span style={{ color: "#94a3b8", textDecoration: "line-through", fontSize: "0.75rem" }}>
                                ₹{t.mrp.toLocaleString("en-IN")}
                              </span>
                              <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem" }}>
                                ₹{t.price.toLocaleString("en-IN")}
                              </span>
                              {pct > 0 && (
                                <span style={{
                                  background: "#dcfce7", color: "#166534",
                                  padding: "2px 6px", borderRadius: 999,
                                  fontSize: "0.62rem", fontWeight: 700,
                                }}>{pct}% off</span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#16a34a", marginTop: 4, fontWeight: 600 }}>
                              CallMedex rate · Home collection
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 16 }}>
                      No tests found in this category. Try searching above.
                    </p>
                  );
                })()}
                {browse.length === 0 && category !== "lab_test" && (
                  <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 16 }}>
                    No tests found in this category. Try searching above.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Popular grid / Fixed-rate catalog ────────────────────── */}
        {!selected && !category && (
          <>


            {/* Frequently booked lab tests with prices */}
            <h3 style={{ textAlign: "center", color: "var(--cm-ink)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: "var(--cm-text-base)", fontWeight: 800 }}>
              <TestTube2 size={18} style={{ color: "var(--cm-active)" }} /> Frequently Booked Lab Tests
            </h3>
            <div className="grid-3">
              {(FIXED_RATE_CATALOG as any[]).slice(0, 12).map((t, i) => {
                const pct = t.mrp > 0 ? Math.round((1 - t.price / t.mrp) * 100) : 0;
                return (
                  <a
                    key={i}
                    href={`/booking?type=lab`}
                    className="card"
                    style={{
                      padding: 20,
                      textAlign: "left",
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--cm-surface-2)", color: "var(--cm-active)", display: "grid", placeItems: "center", marginBottom: 8 }}>
                      <TestTube2 size={16} />
                    </div>
                    <h4 style={{ margin: "0 0 6px", fontSize: "0.92rem", color: "#0f172a" }}>{t.name}</h4>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#94a3b8", textDecoration: "line-through", fontSize: "0.78rem" }}>
                        ₹{t.mrp.toLocaleString("en-IN")}
                      </span>
                      <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>
                        ₹{t.price.toLocaleString("en-IN")}
                      </span>
                      {pct > 0 && (
                        <span style={{
                          background: "#dcfce7", color: "#166534",
                          padding: "2px 6px", borderRadius: 999,
                          fontSize: "0.65rem", fontWeight: 700,
                        }}>{pct}% off</span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: 4, fontWeight: 600 }}>
                      CallMedex fixed rate · Home collection
                    </div>
                  </a>
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <a
                href="/packages"
                style={{
                  color: "#0284c7", fontWeight: 600, fontSize: "0.88rem",
                  textDecoration: "none", borderBottom: "1px dashed #0284c7",
                }}
              >
                View all {FIXED_RATE_CATALOG.length} lab tests with prices →
              </a>
            </div>
          </>
        )}

        {/* ── Selected test — two-model display ──────────────────────── */}
        {selected && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <TestTube2 size={24} style={{ color: "var(--cm-active)" }} /> {selected.name}
              </h2>
              <button
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                  setFulfilment(null);
                  setOffers([]);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ← Search another test
              </button>
            </div>

            {selected.preparation && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#eff6ff",
                  color: "#1e40af",
                  fontSize: "0.88rem",
                  marginBottom: 16,
                }}
              >
                <strong>Preparation:</strong> {selected.preparation}
              </div>
            )}

            {/* ── Model A: Blood test (partner-blind) ──────────────── */}
            {selected.category === "lab_test" && (
              <>
                {loadingFulfilment ? (
                  <p style={{ textAlign: "center", color: "#64748b" }}>Checking availability…</p>
                ) : !fulfilment ? (
                  <div className="card" style={{ padding: 32, textAlign: "center" }}>
                    <p style={{ margin: 0, color: "#64748b" }}>
                      CallMedex doesn&apos;t cover this test{district ? ` in ${district}${locState ? `, ${locState}` : ""}` : ""} yet.
                    </p>
                  </div>
                ) : (
                  <div className="card" style={{ padding: 24, display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <h4 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>Booked with CallMedex</h4>
                      <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.5 }}>
                        {fulfilment.walk_in_required
                          ? "This test needs lab equipment. Book a slot and we'll confirm your nearest CallMedex partner centre."
                          : "Home collection — a CallMedex phlebotomist comes to you."}
                      </p>
                      {district && (
                        <p
                          style={{
                            margin: "8px 0 0",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: fulfilment.walk_in_required ? "#92400e" : "#166534",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {fulfilment.walk_in_required ? (
                            <>
                              <AlertCircle size={14} /> Walk-in centre will be assigned in {district}{locState ? `, ${locState}` : ""}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} /> Home collection available in {district}{locState ? `, ${locState}` : ""}
                            </>
                          )}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {!fulfilment.walk_in_required && <span style={tag}><Home size={12} /> Home collection</span>}
                        {fulfilment.walk_in_required && <span style={tag}><Building2 size={12} /> Walk-in visit</span>}
                        {selected.typical_turnaround_hours ? (
                          <span style={tag}><Clock size={12} /> {selected.typical_turnaround_hours}h report</span>
                        ) : null}
                        {urgent && fulfilment.urgent_available && (
                          <span className="cm-pill cm-pill--urgent" style={{ fontSize: "0.72rem" }}>
                            <AlertCircle size={12} /> Priority
                          </span>
                        )}
                        {fulfilment.partner_count > 0 && (
                          <span style={tag}>
                            {fulfilment.partner_count} CallMedex partner{fulfilment.partner_count === 1 ? "" : "s"} in your area
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: 170 }}>
                      {fixedRate ? (
                        <>
                          <div style={{ color: "#94a3b8", textDecoration: "line-through", fontSize: "0.9rem" }}>
                            {inr(fixedRate.mrp)}
                          </div>
                          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>
                            {inr(fixedRate.price)}
                          </div>
                          <div style={{ color: "#16a34a", fontSize: "0.76rem", fontWeight: 700 }}>
                            CallMedex fixed rate — save {inr(fixedRate.mrp - fixedRate.price)}
                          </div>
                        </>
                      ) : (
                        <>
                          {fulfilment.savings > 0 && (
                            <div style={{ color: "#94a3b8", textDecoration: "line-through", fontSize: "0.9rem" }}>
                              {inr(fulfilment.mrp)}
                            </div>
                          )}
                          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>
                            {inr(fulfilment.price)}
                          </div>
                          {fulfilment.savings > 0 && (
                            <div style={{ color: "#16a34a", fontSize: "0.82rem", fontWeight: 700 }}>
                              You save {inr(fulfilment.savings)}
                            </div>
                          )}
                        </>
                      )}
                      {urgent && fulfilment.urgent_surcharge > 0 && (
                        <div style={{ color: "#b91c1c", fontSize: "0.8rem", marginTop: 4 }}>
                          + {inr(fulfilment.urgent_surcharge)} priority · pay {inr(fulfilment.price + fulfilment.urgent_surcharge)}
                        </div>
                      )}
                      <a
                        href={`/booking?service=${selected.id}&mode=${fulfilment.walk_in_required ? "walkin" : "home"}${urgent ? "&priority=urgent" : ""}`}
                        className="btn btn-primary"
                        style={{ marginTop: 10, display: "inline-block" }}
                      >
                        Book
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Model B: Imaging / walk-in (centre-visible) ───────── */}
            {selected.category === "imaging" && (
              <>
                <h3 style={{ margin: "0 0 10px", fontSize: "1.05rem", color: "#0f172a" }}>
                  Available at these verified centres
                </h3>
                {loadingOffers ? (
                  <p style={{ textAlign: "center", color: "#64748b" }}>Loading centre offers…</p>
                ) : offers.length === 0 ? (
                  <div className="card" style={{ padding: 32, textAlign: "center" }}>
                    <p style={{ margin: 0, color: "#64748b" }}>
                      No partner centre has listed this test in your district{district ? ` (${district})` : ""} yet — we&apos;ll notify you as centres onboard.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {offers.map((offer) => (
                      <div
                        key={offer.service_id}
                        className="card"
                        style={{
                          padding: "16px 20px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                            {offer.provider_name}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 2 }}>
                            {offer.city}{offer.state ? `, ${offer.state}` : ""}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {offer.rating > 0 && (
                              <span style={{ fontSize: "0.82rem", color: "#d97706", fontWeight: 600 }}>
                                ★ {offer.rating.toFixed(1)}
                              </span>
                            )}
                            {offer.home_available && <span style={tag}><Home size={12} /> Home available</span>}
                            {offer.turnaround_hours && (
                              <span style={tag}><Clock size={12} /> {offer.turnaround_hours}h</span>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", minWidth: 150 }}>
                          {offer.savings > 0 && (
                            <div style={{ color: "#94a3b8", textDecoration: "line-through", fontSize: "0.85rem" }}>
                              {inr(offer.mrp)}
                            </div>
                          )}
                          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a" }}>
                            {inr(offer.price)}
                          </div>
                          {offer.savings > 0 && (
                            <div style={{ color: "#16a34a", fontSize: "0.78rem", fontWeight: 700 }}>
                              Save {inr(offer.savings)}
                            </div>
                          )}
                          <a
                            href={`/booking?type=lab&org=${offer.provider_user_id}&service=${selected.id}`}
                            className="btn btn-primary"
                            style={{ marginTop: 8, display: "inline-block", fontSize: "0.85rem" }}
                          >
                            Book
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const filterLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: "0.88rem",
  color: "#475569",
  cursor: "pointer",
  fontWeight: 600,
};

const tag: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#475569",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: "0.75rem",
  fontWeight: 600,
};