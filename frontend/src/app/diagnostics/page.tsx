"use client";

/**
 * Diagnostics — test-first marketplace.
 *
 * The patient searches for a TEST, not a centre. Someone who needs an MRI does
 * not know or care which lab they end up at; they care what it costs, how far
 * it is and when they can be seen. Every offer shows the partner's own MRP
 * struck through against the CallMedex price, so the saving is a number the
 * patient can verify rather than a claim.
 *
 * Replaces the previous hardcoded array of twelve tests with fixed prices,
 * which was backed by no partner and could not actually be booked.
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

type Offer = {
  service_id: string;
  service_name: string;
  provider_user_id: string;
  provider_name: string;
  city: string;
  rating: number;
  mrp: number;
  price: number;
  savings: number;
  discount_pct: number;
  urgent_surcharge: number;
  payable: number;
  home_available: boolean;
  urgent_available: boolean;
  turnaround_hours?: number | null;
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

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
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

  const loadOffers = useCallback(
    async (test: Test) => {
      setLoadingOffers(true);
      try {
        const url = new URL(`${API}/api/marketplace/offers`);
        url.searchParams.set("catalog_id", test.id);
        if (city.trim()) url.searchParams.set("city", city.trim());
        if (homeOnly) url.searchParams.set("home_only", "true");
        if (urgent) url.searchParams.set("urgent", "true");

        const res = await fetch(url.toString());
        const data = await res.json();
        setOffers(data.offers || []);
      } catch {
        setOffers([]);
      } finally {
        setLoadingOffers(false);
      }
    },
    [city, homeOnly, urgent]
  );

  function pick(test: Test) {
    setSelected(test);
    setSuggestions([]);
    setQuery(test.name);
    loadOffers(test);
  }

  // Re-price when a filter changes, so toggling "urgent" updates the numbers in
  // place rather than making the patient search again.
  useEffect(() => {
    if (selected) loadOffers(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeOnly, urgent]);

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Book a test, treatment or therapy</h1>
          <p>
            Search across lab tests, imaging, dental and physiotherapy. Compare
            verified partner centres and pay the CallMedex rate, not the walk-in price.
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
              onBlur={() => selected && loadOffers(selected)}
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

            {loadingOffers ? (
              <p style={{ textAlign: "center", color: "#64748b" }}>Finding partner centres…</p>
            ) : offers.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: "center" }}>
                <p style={{ margin: 0, color: "#64748b" }}>
                  No verified partner offers this test{city ? ` in ${city}` : ""} yet.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {offers.map((o, idx) => (
                  <div
                    key={o.service_id}
                    className="card"
                    style={{
                      padding: 20,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 20,
                      flexWrap: "wrap",
                      // The cheapest offer is what most patients came for.
                      border: idx === 0 ? "2px solid #16a34a" : "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 220 }}>
                      {idx === 0 && (
                        <span
                          style={{
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: "0.7rem",
                            fontWeight: 800,
                          }}
                        >
                          BEST PRICE
                        </span>
                      )}
                      <h4 style={{ margin: "6px 0 2px", fontSize: "1.05rem" }}>
                        {o.provider_name}
                      </h4>
                      <div style={{ fontSize: "0.83rem", color: "#64748b" }}>
                        {o.service_name}
                        {o.city ? ` · ${o.city}` : ""} · ⭐ {Number(o.rating).toFixed(1)}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {o.home_available && <span style={tag}>🏠 Home collection</span>}
                        {o.turnaround_hours ? (
                          <span style={tag}>⏱ {o.turnaround_hours}h report</span>
                        ) : null}
                        {urgent && o.urgent_available && (
                          <span style={{ ...tag, background: "#fee2e2", color: "#991b1b" }}>
                            🔴 Priority
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: 170 }}>
                      {o.savings > 0 && (
                        <div
                          style={{
                            color: "#94a3b8",
                            textDecoration: "line-through",
                            fontSize: "0.9rem",
                          }}
                        >
                          {inr(o.mrp)}
                        </div>
                      )}
                      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>
                        {inr(o.price)}
                      </div>
                      {o.savings > 0 && (
                        <div style={{ color: "#16a34a", fontSize: "0.82rem", fontWeight: 700 }}>
                          You save {inr(o.savings)} ({o.discount_pct}% off)
                        </div>
                      )}
                      {o.urgent_surcharge > 0 && (
                        <div style={{ color: "#b91c1c", fontSize: "0.8rem", marginTop: 4 }}>
                          + {inr(o.urgent_surcharge)} priority · pay {inr(o.payable)}
                        </div>
                      )}
                      <a
                        href={`/booking?provider=${o.provider_user_id}&service=${o.service_id}${urgent ? "&priority=urgent" : ""}`}
                        className="btn btn-primary"
                        style={{ marginTop: 10, display: "inline-block" }}
                      >
                        Book
                      </a>
                    </div>
                  </div>
                ))}
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
