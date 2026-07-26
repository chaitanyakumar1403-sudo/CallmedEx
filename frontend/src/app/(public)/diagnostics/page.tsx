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

const CATEGORIES = [
  { id: "lab_test", label: "Lab Tests", icon: "🧪" },
  { id: "imaging", label: "Imaging", icon: "📷" },
  { id: "dental", label: "Dental", icon: "🦷" },
  { id: "physiotherapy", label: "Physiotherapy", icon: "🧘" },
];

const CATEGORY_ICON: Record<string, string> = {
  lab_test: "🧪",
  imaging: "📷",
  dental: "🦷",
  physiotherapy: "🧘",
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
  const [city, setCity] = useState("");
  const [homeOnly, setHomeOnly] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [category, setCategory] = useState("");
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
    setLoadingBrowse(true);
    fetch(`${API}/api/marketplace/tests/search?category=${encodeURIComponent(category)}&limit=200`)
      .then((r) => r.json())
      .then((d) => setBrowse(d.tests || []))
      .catch(() => setBrowse([]))
      .finally(() => setLoadingBrowse(false));
  }, [category]);

  const loadFulfilment = useCallback(
    async (test: Test) => {
      setLoadingFulfilment(true);
      try {
        const url = new URL(`${API}/api/marketplace/fulfilment`);
        url.searchParams.set("catalog_id", test.id);
        if (city.trim()) url.searchParams.set("city", city.trim());
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
    [city, homeOnly, urgent]
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

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Book a test, treatment or therapy</h1>
          <p>
            Search across lab tests, imaging, dental and physiotherapy. Book at
            the CallMedex rate — home collection where possible, or we&apos;ll
            allocate a verified partner centre for tests that need one.
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
              placeholder="Try “MRI”, “thyroid”, “CBC”, “sugar test”…"
              style={{
                flex: 2,
                minWidth: 260,
                padding: "14px 18px",
                borderRadius: 12,
                border: "1.5px solid #cbd5e1",
                fontSize: "1rem",
              }}
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onBlur={() => selected && loadFulfilment(selected)}
              placeholder="City"
              style={{
                flex: 1,
                minWidth: 150,
                padding: "14px 18px",
                borderRadius: 12,
                border: "1.5px solid #cbd5e1",
                fontSize: "1rem",
              }}
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
              }}
            >
              {suggestions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pick(t)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 18px",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: "0.95rem",
                  }}
                >
                  <span style={{ marginRight: 8 }}>{CATEGORY_ICON[t.category] || "🧪"}</span>
                  <strong>{t.name}</strong>
                  {t.synonyms?.length ? (
                    <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>
                      {" "}
                      · {t.synonyms.slice(0, 3).join(", ")}
                    </span>
                  ) : null}
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
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
            {CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(on ? "" : c.id)}
                  style={{
                    padding: "8px 16px", borderRadius: 999, cursor: "pointer",
                    border: on ? "2px solid #1a2b4a" : "1px solid #cbd5e1",
                    background: on ? "#1a2b4a" : "#fff",
                    color: on ? "#fff" : "#475569",
                    fontWeight: 600, fontSize: "0.85rem",
                  }}
                >
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Category listing ───────────────────────────────────────── */}
        {!selected && category && (
          <div style={{ marginBottom: 28 }}>
            {loadingBrowse ? (
              <p style={{ textAlign: "center", color: "#64748b" }}>Loading services…</p>
            ) : (
              <>
                <h3 style={{ textAlign: "center", color: "#475569", marginBottom: 14 }}>
                  {browse.length} {CATEGORIES.find((c) => c.id === category)?.label} service
                  {browse.length === 1 ? "" : "s"}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                  {browse.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => pick(t)}
                      style={{
                        textAlign: "left", cursor: "pointer", padding: "10px 14px",
                        borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff",
                      }}
                    >
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0f172a" }}>{t.name}</div>
                      {t.sub_category && (
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{t.sub_category}</div>
                      )}
                    </button>
                  ))}
                </div>
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
                  CallMedex doesn&apos;t cover this test{city ? ` in ${city}` : ""} yet.
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
