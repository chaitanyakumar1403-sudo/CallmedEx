"use client";

/**
 * Offers & Health Packages — top of the patient dashboard.
 *
 * Replaces the hardcoded package cards removed from the marketing site, which
 * quoted invented prices with no partner behind them. Everything here comes
 * from a verified partner and is priced through the same PricingService as the
 * rest of the marketplace, so a package cannot quietly use different arithmetic
 * from a single test.
 *
 * When no partner has published anything the strip says so plainly rather than
 * rendering placeholder cards — an empty shelf is honest; a fake one is not.
 */

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Priced = {
  mrp: number;
  price: number;
  savings: number;
  discount_pct: number;
  provider_name: string;
  city?: string;
};

type Pkg = Priced & { id: string; name: string; description: string; test_count: number; provider_user_id: string };
type Svc = Priced & { service_id: string; name: string; home_available: boolean; provider_user_id: string };

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function PriceBlock({ item }: { item: Priced }) {
  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--cm-ink)" }}>
        {inr(item.price)}
      </span>
      {item.savings > 0 && (
        <>
          <span style={{ color: "var(--cm-ink-faint)", textDecoration: "line-through", fontSize: "0.85rem" }}>
            {inr(item.mrp)}
          </span>
          <span className="cm-pill cm-pill--done">Save {inr(item.savings)}</span>
        </>
      )}
    </div>
  );
}

export default function OffersStrip({ city }: { city?: string }) {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [discounted, setDiscounted] = useState<Svc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = new URL(`${API}/api/marketplace/offers/featured`);
    if (city) url.searchParams.set("city", city);
    fetch(url.toString())
      .then((r) => r.json())
      .then((d) => {
        setPackages(d.packages || []);
        setDiscounted(d.discounted || []);
      })
      .catch(() => {
        setPackages([]);
        setDiscounted([]);
      })
      .finally(() => setLoading(false));
  }, [city]);

  if (loading) {
    return (
      <section className="cm-panel" style={{ marginBottom: 24 }}>
        <div className="cm-skeleton cm-skeleton--title" />
        <div className="cm-skeleton cm-skeleton--card" />
      </section>
    );
  }

  const nothingYet = packages.length === 0 && discounted.length === 0;

  return (
    <section className="cm-panel" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 className="cm-panel__title">Health packages &amp; offers</h2>
          <p className="cm-panel__note" style={{ marginBottom: 0 }}>
            Published by verified partner centres near you.
          </p>
        </div>
        <a href="/diagnostics" style={{ color: "var(--cm-active)", fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}>
          Browse all tests →
        </a>
      </div>

      {nothingYet ? (
        <div style={{ marginTop: 16 }}>
          <div className="cm-empty">
            <div className="cm-empty__icon" aria-hidden="true">🏷️</div>
            <p className="cm-empty__title">No partner offers yet</p>
            <p className="cm-empty__body">
              Diagnostic centres and hospitals publish their packages and discounts here.
              You can still search and book any test at the standard rate.
            </p>
            <div style={{ marginTop: 16 }}>
              <a href="/diagnostics" className="btn btn-primary">Book a test</a>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {packages.map((p) => (
            <a
              key={p.id}
              href={`/booking?provider=${p.provider_user_id}&package=${p.id}`}
              style={{
                textDecoration: "none", color: "inherit", padding: 16,
                border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)",
                background: "var(--cm-surface)", display: "block",
              }}
            >
              <span className="cm-pill cm-pill--active">Package</span>
              <div style={{ fontWeight: 800, color: "var(--cm-ink)", marginTop: 8 }}>{p.name}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                {p.provider_name}
                {p.city ? ` · ${p.city}` : ""}
                {p.test_count > 0 ? ` · ${p.test_count} tests` : ""}
              </div>
              <PriceBlock item={p} />
            </a>
          ))}

          {discounted.map((d) => (
            <a
              key={d.service_id}
              href={`/booking?provider=${d.provider_user_id}&service=${d.service_id}`}
              style={{
                textDecoration: "none", color: "inherit", padding: 16,
                border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)",
                background: "var(--cm-surface)", display: "block",
              }}
            >
              <span className="cm-pill cm-pill--waiting">{d.discount_pct}% off</span>
              <div style={{ fontWeight: 800, color: "var(--cm-ink)", marginTop: 8 }}>{d.name}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                {d.provider_name}
                {d.city ? ` · ${d.city}` : ""}
                {d.home_available ? " · 🏠 home collection" : ""}
              </div>
              <PriceBlock item={d} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
