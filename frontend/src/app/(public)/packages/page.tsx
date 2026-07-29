"use client";

import { useMemo, useState } from "react";
import healthPackages from "@/data/health-packages.json";
import labTests from "@/data/lab-test-prices.json";

type HealthPackage = {
  id: string;
  name: string;
  tests: string;
  mrp: number;
  price: number;
};

type LabTest = {
  name: string;
  mrp: number;
  price: number;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function savingsPct(mrp: number, price: number): number {
  if (mrp <= 0) return 0;
  return Math.round((1 - price / mrp) * 100);
}

export default function PackagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return labTests as LabTest[];
    const q = searchQuery.toLowerCase().trim();
    return (labTests as LabTest[]).filter((t) =>
      t.name.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const visible = filtered.length === (labTests as LabTest[]).length && !showAll
    ? filtered.slice(0, 50)
    : filtered;

  return (
    <div className="section">
      <div className="container">
        {/* ── Section 1: Health Packages ──────────────────────────────── */}
        <div className="section-title">
          <h1>Health Packages</h1>
          <p>
            Fixed CallMedex rates, home collection included. Book a curated
            package and save up to{" "}
            {savingsPct(
              Math.max(...(healthPackages as HealthPackage[]).map((p) => p.mrp)),
              Math.min(...(healthPackages as HealthPackage[]).map((p) => p.price))
            )}
            % off MRP.
          </p>
        </div>

        <div className="grid-3" style={{ marginBottom: 48 }}>
          {(healthPackages as HealthPackage[]).map((pkg) => {
            const pct = savingsPct(pkg.mrp, pkg.price);
            const tests = pkg.tests.split(",").map((t) => t.trim());
            return (
              <div
                key={pkg.id}
                className="card"
                style={{
                  padding: 20,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", color: "#0f172a" }}>
                  {pkg.name}
                </h3>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#64748b",
                    lineHeight: 1.5,
                    marginBottom: 12,
                    flex: 1,
                  }}
                >
                  {tests.map((t, i) => (
                    <span key={i} style={{ display: "inline-block", marginRight: 4 }}>
                      {t}
                      {i < tests.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>

                {/* Price block */}
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      color: "#94a3b8",
                      textDecoration: "line-through",
                      fontSize: "0.85rem",
                    }}
                  >
                    {inr(pkg.mrp)}
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    {inr(pkg.price)}
                  </div>
                  {pct > 0 && (
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      Save {inr(pkg.mrp - pkg.price)} ({pct}% off)
                    </span>
                  )}
                </div>

                <a
                  href={`/booking?type=lab&package=${encodeURIComponent(pkg.name)}&price=${pkg.price}`}
                  className="btn btn-primary"
                  style={{
                    display: "block",
                    textAlign: "center",
                    borderRadius: 10,
                    fontSize: "0.9rem",
                  }}
                >
                  Book
                </a>
              </div>
            );
          })}
        </div>

        {/* ── Section 2: Lab Test Price List ──────────────────────────── */}
        <div className="section-title" style={{ marginTop: 32 }}>
          <h1>Individual Lab Tests</h1>
          <p>CallMedex rates — all tests include home collection where available.</p>
        </div>

        <div style={{ maxWidth: 780, margin: "0 auto 28px" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lab tests by name..."
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 12,
              border: "1.5px solid #cbd5e1",
              fontSize: "1rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            maxWidth: 780,
            margin: "0 auto",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {visible.map((test, i) => {
            const pct = savingsPct(test.mrp, test.price);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 18px",
                  borderBottom:
                    i < visible.length - 1 ? "1px solid #f1f5f9" : "none",
                  background: i % 2 === 0 ? "#fff" : "#f8fafc",
                }}
              >
                <div style={{ flex: 1, fontSize: "0.9rem", color: "#0f172a", fontWeight: 500 }}>
                  {test.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: "#94a3b8",
                      textDecoration: "line-through",
                      fontSize: "0.8rem",
                    }}
                  >
                    {inr(test.mrp)}
                  </span>
                  <span
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    {inr(test.price)}
                  </span>
                  {pct > 0 && (
                    <span
                      style={{
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {pct}% off
                    </span>
                  )}
                  <a
                    href="/booking?type=lab"
                    className="btn btn-primary"
                    style={{
                      padding: "6px 14px",
                      fontSize: "0.78rem",
                      borderRadius: 8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Book
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show all / fewer toggle */}
        {filtered.length === (labTests as LabTest[]).length && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={() => setShowAll((s) => !s)}
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "10px 24px",
                cursor: "pointer",
                fontWeight: 600,
                color: "#1a2b4a",
                fontSize: "0.88rem",
              }}
            >
              {showAll
                ? "Show fewer tests"
                : `Show all ${(labTests as LabTest[]).length} tests`}
            </button>
          </div>
        )}

        {filtered.length === 0 && searchQuery.trim() && (
          <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 24 }}>
            No tests match &quot;{searchQuery}&quot;. Try a different search term.
          </p>
        )}
      </div>
    </div>
  );
}