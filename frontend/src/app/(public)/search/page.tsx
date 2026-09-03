"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  MapPin,
  Home,
  Stethoscope,
  Pill,
  Microscope,
  Building2,
  CheckCircle2,
} from "lucide-react";

interface Provider {
  provider_user_id: string;
  provider_type: string;      // organization | doctor | pharmacy
  display_name: string;
  subtype?: string;           // diagnostic_center | polyclinic | hospital | specialization | ...
  city?: string;
  state?: string;
  rating?: number;
  home_service_enabled?: boolean;
  min_price?: number | null;
  verification_status?: string;
}

interface CatalogItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  base_price?: number;
  price?: number;
  home_available?: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Provider-type visual language — derived from the subject.
function visualFor(p: Provider): { type: string; accent: string; tint: string; label: string } {
  const t = (p.subtype || "").toLowerCase();
  const pt = (p.provider_type || "").toLowerCase();
  if (pt === "doctor") return { type: "doctor", accent: "var(--cm-active)", tint: "var(--cm-surface-2)", label: p.subtype || "Doctor" };
  if (pt === "pharmacy") return { type: "pharmacy", accent: "var(--cm-done)", tint: "var(--cm-surface-2)", label: "Pharmacy" };
  if (t.includes("diagnostic") || t.includes("lab")) return { type: "lab", accent: "var(--cm-active)", tint: "var(--cm-surface-2)", label: "Diagnostic Center" };
  if (t.includes("hospital")) return { type: "hospital", accent: "var(--cm-navy)", tint: "var(--cm-surface-2)", label: "Hospital" };
  if (t.includes("clinic")) return { type: "clinic", accent: "var(--cm-active)", tint: "var(--cm-surface-2)", label: "Polyclinic" };
  return { type: "facility", accent: "var(--cm-navy)", tint: "var(--cm-surface-2)", label: p.subtype || "Facility" };
}

function renderVisualIcon(type: string, size = 20) {
  if (type === "doctor") return <Stethoscope size={size} />;
  if (type === "pharmacy") return <Pill size={size} />;
  if (type === "lab") return <Microscope size={size} />;
  return <Building2 size={size} />;
}

const FILTERS: { key: string; label: string; match: (p: Provider) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "hospital", label: "Hospitals", match: (p) => (p.subtype || "").toLowerCase().includes("hospital") },
  { key: "diagnostic", label: "Diagnostics", match: (p) => (p.subtype || "").toLowerCase().includes("diagnostic") || (p.subtype || "").toLowerCase().includes("lab") },
  { key: "clinic", label: "Clinics", match: (p) => (p.subtype || "").toLowerCase().includes("clinic") },
  { key: "doctor", label: "Doctors", match: (p) => p.provider_type === "doctor" },
  { key: "pharmacy", label: "Pharmacy", match: (p) => p.provider_type === "pharmacy" },
];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [all, setAll] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const [selected, setSelected] = useState<Provider | null>(null);
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [packages, setPackages] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => { fetchProviders(); }, []);

  const fetchProviders = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setHasSearched(true);
    try {
      const url = new URL(`${API}/api/providers/search/providers`);
      if (searchQuery) url.searchParams.append("q", searchQuery);
      if (locationQuery) url.searchParams.append("city", locationQuery);
      const res = await fetch(url.toString());
      const data = await res.json();
      setAll(data.success ? (data.providers || []) : []);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  };

  const openProvider = async (p: Provider) => {
    setSelected(p);
    setServices([]); setPackages([]);
    setLoadingCatalog(true);
    try {
      const res = await fetch(`${API}/api/providers/${p.provider_user_id}/catalog`);
      const data = await res.json();
      if (data.success) { setServices(data.services || []); setPackages(data.packages || []); }
    } catch { /* keep empty */ } finally { setLoadingCatalog(false); }
  };

  const results = useMemo(() => {
    const f = FILTERS.find((x) => x.key === activeFilter) || FILTERS[0];
    return all.filter(f.match);
  }, [all, activeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.key] = all.filter(f.match).length;
    return c;
  }, [all]);

  const priceLabel = (n?: number | null) =>
    n === null || n === undefined ? null : `₹${Number(n).toLocaleString("en-IN")}`;

  return (
    <div className="mkt">
      <style>{CSS}</style>

      <div className="mkt-wrap">
        {/* Header */}
        <header className="mkt-head">
          <p className="mkt-eyebrow">Verified providers only</p>
          <h1 className="mkt-title">Find Hospitals, Labs &amp; Clinics</h1>
          <p className="mkt-sub">
            Every facility below is verified against government registries. Compare price, ratings,
            and home-collection availability, then book in a tap.
          </p>
        </header>

        {/* Search */}
        <form className="mkt-search" onSubmit={fetchProviders}>
          <div className="mkt-field">
            <span className="mkt-ic" aria-hidden><Search size={16} /></span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or specialty"
              aria-label="Search by name or specialty"
            />
          </div>
          <div className="mkt-field">
            <span className="mkt-ic" aria-hidden><MapPin size={16} /></span>
            <input
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="City, district or pincode"
              aria-label="Location"
            />
          </div>
          <button className="mkt-go" type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {/* Filter chips */}
        <div className="mkt-chips" role="tablist" aria-label="Filter by type">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={activeFilter === f.key}
              className={`mkt-chip ${activeFilter === f.key ? "is-active" : ""}`}
              onClick={() => setActiveFilter(f.key)}
              disabled={!loading && counts[f.key] === 0 && f.key !== "all"}
            >
              {f.label}
              {!loading && <span className="mkt-chip-n">{counts[f.key] ?? 0}</span>}
            </button>
          ))}
        </div>

        {/* Result count */}
        {!loading && (
          <p className="mkt-count">
            <strong>{results.length}</strong> verified {results.length === 1 ? "provider" : "providers"}
          </p>
        )}

        {/* Cards / skeletons / empty */}
        <div className="mkt-list">
          {loading &&
            [0, 1, 2].map((i) => <div key={i} className="mkt-card mkt-skel" aria-hidden />)}

          {!loading &&
            results.map((p) => {
              const v = visualFor(p);
              const loc = [p.city, p.state].filter(Boolean).join(", ");
              const price = priceLabel(p.min_price);
              return (
                <article key={p.provider_user_id} className="mkt-card">
                  <div className="mkt-avatar" style={{ background: v.tint, color: v.accent }}>
                    {renderVisualIcon(v.type)}
                  </div>

                  <div className="mkt-body">
                    <div className="mkt-namerow">
                      <h3 className="mkt-name">{p.display_name}</h3>
                      <span className="mkt-verified" title="Verified against government registry">✓ Verified</span>
                    </div>
                    <div className="mkt-meta">
                      <span className="mkt-type" style={{ color: v.accent, background: v.tint }}>{v.label}</span>
                      <span className="mkt-rate">★ {(p.rating ?? 5).toFixed(1)}</span>
                      {loc && (
                        <span className="mkt-loc" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <MapPin size={12} /> {loc}
                        </span>
                      )}
                    </div>
                    {p.home_service_enabled && (
                      <span className="mkt-home" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Home size={12} /> Home collection available
                      </span>
                    )}
                  </div>

                  <div className="mkt-rail">
                    {price ? (
                      <div className="mkt-price">
                        <span className="mkt-price-from">from</span>
                        <span className="mkt-price-val">{price}</span>
                      </div>
                    ) : (
                      <div className="mkt-price mkt-price-req">Price on request</div>
                    )}
                    <button className="mkt-view" onClick={() => openProvider(p)}>View services</button>
                  </div>
                </article>
              );
            })}

          {!loading && hasSearched && results.length === 0 && (
            <div className="mkt-empty">
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--cm-surface-2)", color: "var(--cm-ink-3)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Search size={24} />
              </div>
              <h3>No verified providers match</h3>
              <p>Try a different name, clear the location, or switch the filter above.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="mkt-overlay" onClick={() => setSelected(null)}>
          <div className="mkt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="mkt-close" onClick={() => setSelected(null)} aria-label="Close">✕</button>

            <div className="mkt-modal-head">
              <div className="mkt-avatar mkt-avatar-lg" style={{ background: visualFor(selected).tint, color: visualFor(selected).accent }}>
                {renderVisualIcon(visualFor(selected).type, 28)}
              </div>
              <div>
                <div className="mkt-namerow">
                  <h2 className="mkt-name">{selected.display_name}</h2>
                  <span className="mkt-verified">✓ Verified</span>
                </div>
                <div className="mkt-meta">
                  <span className="mkt-type" style={{ color: visualFor(selected).accent, background: visualFor(selected).tint }}>{visualFor(selected).label}</span>
                  <span className="mkt-rate">★ {(selected.rating ?? 5).toFixed(1)}</span>
                  {[selected.city, selected.state].filter(Boolean).length > 0 && (
                    <span className="mkt-loc" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <MapPin size={12} /> {[selected.city, selected.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {loadingCatalog ? (
              <div className="mkt-modal-loading">Loading services…</div>
            ) : (
              <div className="mkt-catalog">
                {services.length > 0 && (
                  <section>
                    <h4 className="mkt-sec">Tests &amp; services</h4>
                    {services.map((s) => (
                      <div key={s.id} className="mkt-item">
                        <div>
                          <div className="mkt-item-name">{s.name}</div>
                          <div className="mkt-item-sub">
                            {s.category && <span className="mkt-tag">{s.category.replace(/_/g, " ")}</span>}
                            {s.home_available && (
                              <span className="mkt-tag mkt-tag-home" style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <Home size={10} /> home
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mkt-item-buy">
                          <span className="mkt-item-price">₹{Number(s.base_price ?? 0).toLocaleString("en-IN")}</span>
                          <a className="mkt-book" href={`/booking?type=lab&org=${selected.provider_user_id}&service=${s.id}`}>Book</a>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {packages.length > 0 && (
                  <section>
                    <h4 className="mkt-sec">Health packages</h4>
                    {packages.map((pk) => (
                      <div key={pk.id} className="mkt-item mkt-item-pkg">
                        <div>
                          <div className="mkt-item-name">{pk.name}</div>
                          {pk.description && <div className="mkt-item-desc">{pk.description}</div>}
                        </div>
                        <div className="mkt-item-buy">
                          <span className="mkt-item-price">₹{Number(pk.price ?? 0).toLocaleString("en-IN")}</span>
                          <a className="mkt-book" href={`/booking?type=lab&org=${selected.provider_user_id}&package=${pk.id}`}>Book</a>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {services.length === 0 && packages.length === 0 && (
                  <div className="mkt-modal-empty">
                    This provider hasn’t published a service catalog yet. Reach out directly to book.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.mkt { background:
  radial-gradient(1100px 380px at 50% -140px, #eaf1fb 0%, rgba(234,241,251,0) 70%),
  var(--color-gray-50, #f8fafc);
  min-height: 100vh; padding: 40px 20px 72px; font-family: var(--font-body, 'Inter', sans-serif); }
.mkt-wrap { max-width: 940px; margin: 0 auto; }

.mkt-head { text-align: center; margin-bottom: 28px; }
.mkt-eyebrow { text-transform: uppercase; letter-spacing: .16em; font-size: .72rem; font-weight: 700;
  color: var(--color-teal, #0891b2); margin: 0 0 10px; }
.mkt-title { font-family: var(--font-display, 'Playfair Display', serif); font-weight: 800;
  color: var(--color-navy, #1a2b4a); font-size: clamp(1.9rem, 4vw, 2.8rem); line-height: 1.08; margin: 0 0 12px; }
.mkt-sub { color: var(--color-gray-500, #64748b); font-size: 1.02rem; max-width: 560px; margin: 0 auto; line-height: 1.5; }

.mkt-search { display: flex; gap: 10px; background: #fff; padding: 10px; border-radius: 16px;
  border: 1px solid var(--color-gray-200, #e2e8f0); box-shadow: 0 12px 30px -18px rgba(26,43,74,.35);
  margin-bottom: 20px; flex-wrap: wrap; }
.mkt-field { flex: 1 1 240px; position: relative; display: flex; align-items: center; }
.mkt-ic { position: absolute; left: 14px; font-size: 1rem; opacity: .7; pointer-events: none; }
.mkt-field input { width: 100%; padding: 13px 14px 13px 40px; border: 1px solid transparent;
  background: var(--color-gray-50, #f8fafc); border-radius: 11px; font-size: .98rem; color: var(--color-gray-900, #0f172a); }
.mkt-field input:focus { outline: none; border-color: var(--color-teal, #0891b2); background: #fff;
  box-shadow: 0 0 0 3px rgba(8,145,178,.14); }
.mkt-go { padding: 0 30px; background: var(--color-navy, #1a2b4a); color: #fff; border: none;
  border-radius: 11px; font-weight: 700; font-size: .98rem; cursor: pointer; transition: background .15s, transform .1s; }
.mkt-go:hover:not(:disabled) { background: var(--color-navy-hover, #2a3d5e); }
.mkt-go:active { transform: translateY(1px); }
.mkt-go:disabled { opacity: .7; cursor: wait; }

.mkt-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
.mkt-chip { display: inline-flex; align-items: center; gap: 7px; padding: 8px 15px; border-radius: 999px;
  border: 1px solid var(--color-gray-200, #e2e8f0); background: #fff; color: var(--color-gray-600, #475569);
  font-size: .88rem; font-weight: 600; cursor: pointer; transition: all .15s; }
.mkt-chip:hover:not(:disabled) { border-color: var(--color-navy, #1a2b4a); color: var(--color-navy, #1a2b4a); }
.mkt-chip.is-active { background: var(--color-navy, #1a2b4a); border-color: var(--color-navy, #1a2b4a); color: #fff; }
.mkt-chip:disabled { opacity: .45; cursor: default; }
.mkt-chip-n { font-size: .74rem; background: rgba(0,0,0,.07); border-radius: 999px; padding: 1px 7px; font-weight: 700; }
.mkt-chip.is-active .mkt-chip-n { background: rgba(255,255,255,.22); }

.mkt-count { color: var(--color-gray-500, #64748b); font-size: .92rem; margin: 0 0 14px; }
.mkt-count strong { color: var(--color-navy, #1a2b4a); }

.mkt-list { display: flex; flex-direction: column; gap: 14px; }

.mkt-card { display: grid; grid-template-columns: auto 1fr auto; gap: 20px; align-items: center;
  background: #fff; border: 1px solid var(--color-gray-200, #e2e8f0); border-radius: 16px; padding: 20px 22px;
  box-shadow: 0 1px 2px rgba(16,24,40,.04); transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
.mkt-card:hover { transform: translateY(-2px); box-shadow: 0 18px 40px -24px rgba(26,43,74,.45); border-color: #d4deea; }

.mkt-avatar { width: 58px; height: 58px; border-radius: 14px; display: flex; align-items: center;
  justify-content: center; font-size: 1.7rem; flex-shrink: 0; }
.mkt-avatar-lg { width: 64px; height: 64px; font-size: 1.9rem; }

.mkt-body { min-width: 0; }
.mkt-namerow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 7px; }
.mkt-name { font-family: var(--font-display, 'Playfair Display', serif); font-weight: 700;
  color: var(--color-gray-900, #0f172a); font-size: 1.32rem; margin: 0; line-height: 1.15; }
.mkt-verified { display: inline-flex; align-items: center; gap: 3px; font-size: .74rem; font-weight: 700;
  color: var(--color-green, #16a34a); background: #e8f7ee; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.mkt-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; color: var(--color-gray-500, #64748b); font-size: .9rem; }
.mkt-type { font-size: .74rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; text-transform: capitalize; }
.mkt-rate { color: var(--color-amber, #f59e0b); font-weight: 700; }
.mkt-loc { color: var(--color-gray-500, #64748b); }
.mkt-home { display: inline-block; margin-top: 10px; font-size: .8rem; font-weight: 600; color: var(--color-teal-dark, #0e7490);
  background: #e2f6fb; border: 1px solid #c3e9f1; padding: 4px 10px; border-radius: 8px; }

.mkt-rail { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; text-align: right; }
.mkt-price { display: flex; flex-direction: column; align-items: flex-end; line-height: 1; }
.mkt-price-from { font-size: .68rem; text-transform: uppercase; letter-spacing: .1em; color: var(--color-gray-400, #94a3b8); font-weight: 700; }
.mkt-price-val { font-family: var(--font-display, 'Playfair Display', serif); font-size: 1.5rem; font-weight: 800; color: var(--color-navy, #1a2b4a); }
.mkt-price-req { font-size: .82rem; color: var(--color-gray-400, #94a3b8); font-weight: 600; }
.mkt-view { padding: 10px 20px; background: var(--color-teal, #0891b2); color: #fff; border: none; border-radius: 10px;
  font-weight: 700; font-size: .9rem; cursor: pointer; white-space: nowrap; transition: background .15s, transform .1s; }
.mkt-view:hover { background: var(--color-teal-dark, #0e7490); }
.mkt-view:active { transform: translateY(1px); }

.mkt-skel { height: 100px; border: 1px solid var(--color-gray-200, #e2e8f0);
  background: linear-gradient(100deg, #fff 30%, #f1f5f9 50%, #fff 70%); background-size: 220% 100%;
  animation: mkt-sh 1.25s infinite linear; }
@keyframes mkt-sh { from { background-position: 180% 0 } to { background-position: -60% 0 } }

.mkt-empty { text-align: center; background: #fff; border: 1px dashed var(--color-gray-300, #cbd5e1);
  border-radius: 16px; padding: 56px 24px; }
.mkt-empty span { font-size: 2.6rem; display: block; margin-bottom: 12px; }
.mkt-empty h3 { margin: 0 0 6px; color: var(--color-gray-700, #334155); }
.mkt-empty p { margin: 0; color: var(--color-gray-500, #64748b); }

.mkt-overlay { position: fixed; inset: 0; background: rgba(15,29,51,.55); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; }
.mkt-modal { background: #fff; border-radius: 18px; width: 100%; max-width: 620px; max-height: 86vh; overflow-y: auto;
  padding: 28px; position: relative; box-shadow: 0 30px 80px -20px rgba(15,29,51,.5); }
.mkt-close { position: absolute; top: 20px; right: 20px; background: var(--color-gray-100, #f1f5f9); border: none;
  width: 34px; height: 34px; border-radius: 50%; font-size: 1rem; cursor: pointer; color: var(--color-gray-500, #64748b); }
.mkt-close:hover { background: var(--color-gray-200, #e2e8f0); }
.mkt-modal-head { display: flex; gap: 16px; align-items: center; margin-bottom: 22px; padding-right: 30px; }
.mkt-modal-loading, .mkt-modal-empty { text-align: center; padding: 34px; color: var(--color-gray-500, #64748b);
  background: var(--color-gray-50, #f8fafc); border-radius: 12px; }
.mkt-catalog { display: flex; flex-direction: column; gap: 22px; }
.mkt-sec { font-size: .8rem; text-transform: uppercase; letter-spacing: .1em; color: var(--color-gray-400, #94a3b8);
  font-weight: 700; margin: 0 0 12px; }
.mkt-item { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 14px 16px;
  border: 1px solid var(--color-gray-200, #e2e8f0); border-radius: 12px; margin-bottom: 10px; }
.mkt-item-pkg { background: var(--color-gray-50, #f8fafc); }
.mkt-item-name { font-weight: 700; color: var(--color-gray-900, #0f172a); }
.mkt-item-sub { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.mkt-item-desc { font-size: .85rem; color: var(--color-gray-500, #64748b); margin-top: 4px; max-width: 340px; }
.mkt-tag { font-size: .7rem; font-weight: 600; text-transform: capitalize; color: var(--color-gray-600, #475569);
  background: var(--color-gray-100, #f1f5f9); padding: 2px 8px; border-radius: 6px; }
.mkt-tag-home { color: var(--color-teal-dark, #0e7490); background: #e2f6fb; }
.mkt-item-buy { display: flex; align-items: center; gap: 12px; }
.mkt-item-price { font-weight: 800; color: var(--color-navy, #1a2b4a); }
.mkt-book { padding: 8px 16px; background: var(--color-navy, #1a2b4a); color: #fff; border-radius: 8px;
  font-weight: 700; font-size: .85rem; text-decoration: none; white-space: nowrap; }
.mkt-book:hover { background: var(--color-navy-hover, #2a3d5e); }

@media (max-width: 620px) {
  .mkt-card { grid-template-columns: auto 1fr; }
  .mkt-rail { grid-column: 1 / -1; flex-direction: row; justify-content: space-between; align-items: center;
    border-top: 1px solid var(--color-gray-100, #f1f5f9); padding-top: 14px; }
  .mkt-price { flex-direction: row; align-items: baseline; gap: 6px; }
  .mkt-go { flex: 1 1 100%; padding: 13px; }
}
@media (prefers-reduced-motion: reduce) {
  .mkt-card, .mkt-go, .mkt-view, .mkt-book { transition: none; }
  .mkt-skel { animation: none; }
}
`;
