"use client";

/**
 * Diagnostics — test-first, partner-blind marketplace.
 *
 * The patient searches for a TEST, not a centre. Someone who needs an MRI does
 * not know or care which lab they end up at; they care what it costs, how far
 * it is and when they can be seen.
 *
 * A blood test booked here is between CallMedex and the patient only.
 * CallMedex links to partner centres internally to fulfil it, but that
 * partner is never named, rated or compared on this screen — only the
 * CallMedex price, the real saving against MRP, and whether the test is
 * home-serviceable or requires a walk-in visit (see CLAUDE.md, "partner-blind
 * diagnostics booking"). The allocated centre is still recorded on the
 * booking server-side so dispatch/samples/settlement work unchanged; it is
 * only ever revealed to the patient once a walk-in booking is confirmed.
 */

import { useCallback, useEffect, useState } from "react";
import StateDistrictPicker from "@/components/StateDistrictPicker";

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

// Walk-in-only services (dental, physiotherapy) are deliberately NOT here —
// a root canal can't be home-collected. They are discoverable under
// Consultation → Walk-in instead.
const CATEGORIES = [
  { id: "lab_test", label: "Lab Tests", icon: "🧪" },
  { id: "imaging", label: "Imaging", icon: "📷" },
];

// Sub-categories for organized browsing within each category
const SUB_CATEGORIES: Record<string, { id: string; label: string; icon: string }[]> = {
  lab_test: [
    { id: "blood_test", label: "Blood Tests", icon: "🩸" },
    { id: "hormone", label: "Hormone Tests", icon: "⚗️" },
    { id: "diabetes", label: "Diabetes & Sugar", icon: "🍬" },
    { id: "thyroid", label: "Thyroid Panel", icon: "🦋" },
    { id: "liver", label: "Liver Function", icon: "🫘" },
    { id: "kidney", label: "Kidney Function", icon: "🫧" },
    { id: "allergy", label: "Allergy Tests", icon: "🤧" },
    { id: "vitamin", label: "Vitamin & Nutrition", icon: "💊" },
    { id: "infection", label: "Infection Markers", icon: "🦠" },
    { id: "urine_stool", label: "Urine & Stool", icon: "🔬" },
  ],
  imaging: [
    { id: "mri", label: "MRI Scans", icon: "🧲" },
    { id: "ct_scan", label: "CT Scans", icon: "🖥️" },
    { id: "xray", label: "X-Ray", icon: "☢️" },
    { id: "ultrasound", label: "Ultrasound", icon: "📡" },
    { id: "ecg_echo", label: "ECG & Echo", icon: "💓" },
    { id: "dexa", label: "DEXA / Bone Density", icon: "🦴" },
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

const CATEGORY_ICON: Record<string, string> = {
  lab_test: "🧪",
  imaging: "📷",
  procedure: "🔬",
  health_package: "📦",
  consultation: "🩺",
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

  // Debounced type-ahead: a request per keystroke would hammer the API and can
  // deliver results out of order.
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

  // Browsing a category lists what CallMedex actually carries for it, so a
  // patient can pick "Root Canal Treatment" without knowing to type it.
  useEffect(() => {
    if (!category) {
      setBrowse([]);
      return;
    }

    // If a sub-category is selected, search using its keywords instead of the full category
    if (subCategory && SUB_CATEGORY_KEYWORDS[subCategory]) {
      setLoadingBrowse(true);
      const keywords = SUB_CATEGORY_KEYWORDS[subCategory];
      // Search using the first keyword as the main query, filtered by category
      const searchQ = keywords[0];
      fetch(`${API}/api/marketplace/tests/search?q=${encodeURIComponent(searchQ)}&category=${encodeURIComponent(category)}&limit=200`)
        .then((r) => r.json())
        .then((d) => {
          // Client-side filter: keep tests that match any of the sub-category keywords
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
        // The fulfilment endpoint substring-matches `city` against a partner's
        // city + state, so the district alone is the strongest single token.
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

  function pick(test: Test) {
    setSelected(test);
    setSuggestions([]);
    setQuery(test.name);
    loadFulfilment(test);
  }

  // Re-price when a filter changes, so toggling "urgent" updates the numbers in
  // place rather than making the patient search again.
  useEffect(() => {
    if (selected) loadFulfilment(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeOnly, urgent]);

  // State → District cascade (auto-detect included) lives in the shared
  // StateDistrictPicker; when the district changes we re-price the selected
  // test for the new location.
  const handleLocationChange = useCallback(
    (next: { state: string; district: string; detected: boolean }) => {
      setLocState(next.state);
      setDistrict(next.district);
      setLocationDetected(next.detected);
    },
    []
  );

  useEffect(() => {
    if (selected) loadFulfilment(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Book a lab test or imaging — home collection or verified walk-in centre</h1>
          <p>
            Search across lab tests and imaging. Book at the CallMedex rate —
            home collection where possible, or we&apos;ll allocate a verified
            partner centre for tests that need one. Looking for dental or
            physiotherapy? See Consultation → Walk-in.
          </p>
        </div>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 780, margin: "0 auto 28px", position: "relative" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              placeholder="Try MRI, thyroid, CBC, sugar test..."
              style={{
                flex: 2,
                minWidth: 260,
                padding: "14px 18px",
                borderRadius: 12,
                border: "1.5px solid #cbd5e1",
                fontSize: "1rem",
              }}
            />
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
                  <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{CATEGORY_ICON[t.category] || "🧪"}</span>
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
            <label style={{ ...filterLabel, color: urgent ? "#b91c1c" : "#475569" }}>
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
              />
              🔴 Urgent — priority slot
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
                      border: on ? "2px solid #1a2b4a" : "1px solid #cbd5e1",
                      background: on ? "#1a2b4a" : "#fff",
                      color: on ? "#fff" : "#475569",
                      fontWeight: 600, fontSize: "0.88rem",
                      transition: "all 0.2s ease",
                      boxShadow: on ? "0 4px 12px rgba(26,43,74,0.25)" : "none",
                    }}
                  >
                    {c.icon} {c.label}
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
                    border: !subCategory ? "2px solid #0284c7" : "1px solid #cbd5e1",
                    background: !subCategory ? "#e0f2fe" : "#fff",
                    color: !subCategory ? "#0369a1" : "#64748b",
                    fontWeight: 600, fontSize: "0.78rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  📋 All
                </button>
                {SUB_CATEGORIES[category].map((sc) => {
                  const active = subCategory === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => setSubCategory(active ? "" : sc.id)}
                      style={{
                        padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                        border: active ? "2px solid #0284c7" : "1px solid #cbd5e1",
                        background: active ? "#e0f2fe" : "#fff",
                        color: active ? "#0369a1" : "#64748b",
                        fontWeight: active ? 700 : 500, fontSize: "0.78rem",
                        transition: "all 0.2s ease",
                        boxShadow: active ? "0 2px 6px rgba(2,132,199,0.15)" : "none",
                      }}
                    >
                      {sc.icon} {sc.label}
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
                        <span style={{ fontSize: "1.1rem" }}>{CATEGORY_ICON[t.category] || "🧪"}</span>
                        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0f172a" }}>{t.name}</div>
                      </div>
                      {t.sub_category && (
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4, marginLeft: 30 }}>{t.sub_category}</div>
                      )}
                    </button>
                  ))}
                </div>
                {browse.length === 0 && (
                  <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 16 }}>
                    No tests found in this category. Try searching above.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Popular grid ───────────────────────────────────────────── */}
        {!selected && !category && (
          <>
            <h3 style={{ textAlign: "center", color: "#475569", marginBottom: 16 }}>
              Frequently booked
            </h3>
            <div className="grid-3">
              {popular.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pick(t)}
                  className="card"
                  style={{
                    padding: 20,
                    textAlign: "left",
                    cursor: "pointer",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontSize: "1.5rem" }}>{CATEGORY_ICON[t.category] || "🧪"}</div>
                  <h4 style={{ margin: "8px 0 4px", fontSize: "1rem" }}>{t.name}</h4>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    {t.provider_count
                      ? `${t.provider_count} partner centre${t.provider_count === 1 ? "" : "s"}`
                      : "Coming soon in your city"}
                  </div>
                </button>
              ))}
            </div>
            {popular.length === 0 && (
              <p style={{ textAlign: "center", color: "#94a3b8" }}>
                Loading the test catalogue…
              </p>
            )}
          </>
        )}

        {/* ── Offers ─────────────────────────────────────────────────── */}
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
              <h2 style={{ margin: 0 }}>
                {CATEGORY_ICON[selected.category] || "🧪"} {selected.name}
              </h2>
              <button
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                  setFulfilment(null);
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
                  {/* The processing centre itself is never named — the patient
                      only learns whether home collection covers their district. */}
                  {district && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: fulfilment.walk_in_required ? "#92400e" : "#166534",
                      }}
                    >
                      {fulfilment.walk_in_required
                        ? `⚠️ Walk-in centre will be assigned in ${district}${locState ? `, ${locState}` : ""}`
                        : `✅ Home collection available in ${district}${locState ? `, ${locState}` : ""}`}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {!fulfilment.walk_in_required && <span style={tag}>🏠 Home collection</span>}
                    {fulfilment.walk_in_required && <span style={tag}>🏥 Walk-in visit</span>}
                    {selected.typical_turnaround_hours ? (
                      <span style={tag}>⏱ {selected.typical_turnaround_hours}h report</span>
                    ) : null}
                    {urgent && fulfilment.urgent_available && (
                      <span style={{ ...tag, background: "#fee2e2", color: "#991b1b" }}>
                        🔴 Priority
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
                  {fulfilment.savings > 0 && (
                    <div
                      style={{
                        color: "#94a3b8",
                        textDecoration: "line-through",
                        fontSize: "0.9rem",
                      }}
                    >
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
