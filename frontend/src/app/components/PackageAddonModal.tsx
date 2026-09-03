"use client";

import React, { useState, useMemo } from "react";
import labTestsCatalog from "@/data/lab-test-prices.json";

export interface HealthPackageItem {
  id: string;
  name: string;
  tests: string;
  mrp: number;
  price: number;
  single_price?: number;
  couple_price?: number | null;
  special_add_on?: string | null;
}

export interface SelectedAddonTest {
  name: string;
  originalPrice: number;
  discountedPrice: number;
  savings: number;
}

interface PackageAddonModalProps {
  packageItem: HealthPackageItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking: (
    pkg: HealthPackageItem,
    planType: "single" | "couple",
    pkgPrice: number,
    selectedAddons: SelectedAddonTest[]
  ) => void;
}

// Key imaging add-ons highlighted from CALL MedEx ONLINE.xls
const FEATURED_IMAGING_ADDONS = [
  { name: "Ultrasound Scan (USG Abdomen & Pelvis)", mrp: 1600, price: 1200 },
  { name: "ECG (12-Lead Electrocardiogram)", mrp: 400, price: 300 },
  { name: "2D Echo (Echocardiography with Doppler)", mrp: 2200, price: 1600 },
  { name: "TMT (Treadmill Stress Test)", mrp: 2500, price: 1800 },
  { name: "Doppler Ultrasound Study", mrp: 2600, price: 1900 },
  { name: "Digital Chest X-Ray (PA View)", mrp: 600, price: 450 },
];

export default function PackageAddonModal({
  packageItem,
  isOpen,
  onClose,
  onConfirmBooking,
}: PackageAddonModalProps) {
  const [planType, setPlanType] = useState<"single" | "couple">("single");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("recommended");
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddonTest[]>([]);

  // Reset state when opening modal with new package
  React.useEffect(() => {
    if (isOpen) {
      setPlanType("single");
      setSelectedAddons([]);
      setSearchQuery("");
      setActiveCategory("recommended");
    }
  }, [isOpen, packageItem?.id]);

  if (!isOpen || !packageItem) return null;

  const currentPkgPrice =
    planType === "couple" && packageItem.couple_price
      ? packageItem.couple_price
      : packageItem.single_price || packageItem.price;

  // Base package tests list
  const baseTests = packageItem.tests
    .split(/[,/]/)
    .map((t) => t.trim())
    .filter(Boolean);

  // All master catalog tests combined with featured imaging
  const allAvailableTests = useMemo(() => {
    const combined = [
      ...FEATURED_IMAGING_ADDONS,
      ...labTestsCatalog.map((t) => ({ name: t.name, mrp: t.mrp, price: t.price })),
    ];
    // Remove duplicates
    const seen = new Set<string>();
    return combined.filter((t) => {
      const k = t.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, []);

  // Filter tests by query and active category
  const filteredTests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = allAvailableTests;

    if (activeCategory === "recommended") {
      list = [
        ...FEATURED_IMAGING_ADDONS,
        ...allAvailableTests.filter((t) => {
          const n = t.name.toLowerCase();
          return (
            n.includes("vitamin d") ||
            n.includes("vitamin b12") ||
            n.includes("hba1c") ||
            n.includes("thyroid") ||
            n.includes("calcium") ||
            n.includes("ferritin") ||
            n.includes("lipid")
          );
        }),
      ];
    } else if (activeCategory === "imaging") {
      list = allAvailableTests.filter((t) => {
        const n = t.name.toLowerCase();
        return (
          n.includes("scan") ||
          n.includes("x-ray") ||
          n.includes("echo") ||
          n.includes("ecg") ||
          n.includes("tmt") ||
          n.includes("doppler") ||
          n.includes("mri") ||
          n.includes("ct ")
        );
      });
    } else if (activeCategory === "vitamins") {
      list = allAvailableTests.filter((t) => {
        const n = t.name.toLowerCase();
        return n.includes("vitamin") || n.includes("calcium") || n.includes("iron") || n.includes("ferritin") || n.includes("folic");
      });
    } else if (activeCategory === "diabetes") {
      list = allAvailableTests.filter((t) => {
        const n = t.name.toLowerCase();
        return n.includes("glucose") || n.includes("sugar") || n.includes("hba1c") || n.includes("insulin") || n.includes("c-peptide");
      });
    } else if (activeCategory === "cardiac") {
      list = allAvailableTests.filter((t) => {
        const n = t.name.toLowerCase();
        return n.includes("cardiac") || n.includes("crp") || n.includes("lipid") || n.includes("cholesterol") || n.includes("ecg") || n.includes("troponin");
      });
    }

    if (q) {
      list = allAvailableTests.filter((t) => t.name.toLowerCase().includes(q));
    }

    return list.slice(0, 40);
  }, [searchQuery, activeCategory, allAvailableTests]);

  // Toggle add-on selection
  const toggleAddon = (test: { name: string; price: number; mrp: number }) => {
    const isSelected = selectedAddons.some((a) => a.name === test.name);
    if (isSelected) {
      setSelectedAddons((prev) => prev.filter((a) => a.name !== test.name));
    } else {
      // 30% discount applied to the individual test price!
      const basePrice = test.price || test.mrp || 0;
      const discounted = Math.round(basePrice * 0.70); // 30% OFF
      const savings = basePrice - discounted;
      setSelectedAddons((prev) => [
        ...prev,
        {
          name: test.name,
          originalPrice: basePrice,
          discountedPrice: discounted,
          savings,
        },
      ]);
    }
  };

  const totalAddonsPrice = selectedAddons.reduce((sum, a) => sum + a.discountedPrice, 0);
  const totalAddonsSavings = selectedAddons.reduce((sum, a) => sum + a.savings, 0);
  const finalTotalPrice = currentPkgPrice + totalAddonsPrice;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 19, 32, 0.78)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "840px",
          maxHeight: "92vh",
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          boxShadow: "0 25px 60px -15px rgba(2, 132, 199, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* ── Top Header Banner with Dynamic Aurora Glow ── */}
        <div
          style={{
            background: "linear-gradient(135deg, #0A2540 0%, #064e3b 50%, #0369a1 100%)",
            color: "#ffffff",
            padding: "20px 24px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(16, 185, 129, 0.25)",
                  border: "1px solid rgba(52, 211, 153, 0.5)",
                  color: "#34d399",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  marginBottom: "8px",
                }}
              >
                🎁 SPECIAL PACKAGE BUNDLE • FLAT 30% OFF ALL ADD-ONS
              </div>
              <h2 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#ffffff" }}>
                {packageItem.name}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "0.86rem", color: "#cbd5e1" }}>
                Customize your booking: pair with any individual lab test or imaging scan at 30% discount!
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                color: "#ffffff",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Plan Selector: Single vs Couple */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "16px",
              background: "rgba(0, 0, 0, 0.25)",
              padding: "4px",
              borderRadius: "14px",
              width: "fit-content",
            }}
          >
            <button
              onClick={() => setPlanType("single")}
              style={{
                padding: "8px 18px",
                borderRadius: "10px",
                border: "none",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                backgroundColor: planType === "single" ? "#0284c7" : "transparent",
                color: "#ffffff",
              }}
            >
              👤 Single Person • ₹{packageItem.single_price || packageItem.price}
            </button>

            {packageItem.couple_price && (
              <button
                onClick={() => setPlanType("couple")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "10px",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  backgroundColor: planType === "couple" ? "#059669" : "transparent",
                  color: "#ffffff",
                }}
              >
                👥 Couple (2 Persons) • ₹{packageItem.couple_price}
              </button>
            )}
          </div>
        </div>

        {/* ── Middle Scrollable Content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Base Tests Included pill row */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "14px 18px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                ✓ {baseTests.length} Tests Included In This Package
              </span>
              <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 600 }}>Home Collection Included</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {baseTests.map((t, i) => (
                <span
                  key={i}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    fontSize: "0.74rem",
                    padding: "3px 9px",
                    borderRadius: "8px",
                    fontWeight: 500,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Recommended Special Add-On (from Excel column G) */}
          {packageItem.special_add_on && (
            <div
              style={{
                background: "linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)",
                border: "1.5px dashed #10b981",
                borderRadius: "16px",
                padding: "12px 18px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#059669", letterSpacing: "0.5px" }}>
                  ⭐ DESIGNATED ADD-ON FOR THIS PACKAGE
                </span>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#065f46", marginTop: "2px" }}>
                  {packageItem.special_add_on}
                </div>
                <div style={{ fontSize: "0.76rem", color: "#047857" }}>
                  Clinical recommendation to complement your {packageItem.name}
                </div>
              </div>
              <div
                style={{
                  background: "#059669",
                  color: "#ffffff",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: "10px",
                }}
              >
                30% OFF APPLIED
              </div>
            </div>
          )}

          {/* Add-on Test Search & Category Selector */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                Add Individual Tests & Scans (30% Discount Applied Automatically)
              </h3>
              {selectedAddons.length > 0 && (
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0284c7" }}>
                  {selectedAddons.length} test{selectedAddons.length > 1 ? "s" : ""} selected
                </span>
              )}
            </div>

            {/* Search input */}
            <input
              type="text"
              placeholder="Search by test name (e.g. Vitamin D, Thyroid, Ultrasound, HbA1c, ECG)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "14px",
                border: "1.5px solid #cbd5e1",
                fontSize: "0.92rem",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "10px",
              }}
            />

            {/* Category Pills */}
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
              {[
                { id: "recommended", label: "⭐ Recommended & Scans" },
                { id: "imaging", label: "📷 Scans & Imaging" },
                { id: "vitamins", label: "🧪 Vitamins & Minerals" },
                { id: "diabetes", label: "🩸 Diabetes & Sugar" },
                { id: "cardiac", label: "❤️ Heart & Lipid" },
                { id: "all", label: "🔬 All Master Tests" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "999px",
                    border: "1px solid",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    backgroundColor: activeCategory === cat.id ? "#0284c7" : "#f1f5f9",
                    color: activeCategory === cat.id ? "#ffffff" : "#475569",
                    borderColor: activeCategory === cat.id ? "#0284c7" : "#e2e8f0",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Test Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            {filteredTests.map((test) => {
              const isSelected = selectedAddons.some((a) => a.name === test.name);
              const basePrice = test.price || test.mrp || 0;
              const discountedPrice = Math.round(basePrice * 0.70);
              const savings = basePrice - discountedPrice;

              return (
                <div
                  key={test.name}
                  onClick={() => toggleAddon(test)}
                  style={{
                    padding: "14px",
                    borderRadius: "16px",
                    border: isSelected ? "2px solid #0284c7" : "1px solid #e2e8f0",
                    background: isSelected ? "#f0f9ff" : "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                      {test.name}
                    </div>
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8", textDecoration: "line-through" }}>
                        ₹{basePrice}
                      </span>
                      <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#059669" }}>
                        ₹{discountedPrice}
                      </span>
                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#166534",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "6px",
                        }}
                      >
                        30% OFF
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <span style={{ fontSize: "0.72rem", color: "#0284c7", fontWeight: 600 }}>
                        Save ₹{savings}
                      </span>
                      <button
                        type="button"
                        style={{
                          padding: "4px 12px",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          backgroundColor: isSelected ? "#0284c7" : "#e2e8f0",
                          color: isSelected ? "#ffffff" : "#1e293b",
                          cursor: "pointer",
                        }}
                      >
                        {isSelected ? "✓ Added" : "+ Add"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sticky Bottom Checkout Bar ── */}
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Package: <strong>₹{currentPkgPrice}</strong> ({planType === "single" ? "Single" : "Couple"})
              </span>
              {selectedAddons.length > 0 && (
                <span style={{ fontSize: "0.85rem", color: "#059669", fontWeight: 700 }}>
                  + {selectedAddons.length} Add-on{selectedAddons.length > 1 ? "s" : ""} (₹{totalAddonsPrice})
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
              <span style={{ fontSize: "1.6rem", fontWeight: 900, color: "#0f172a" }}>
                ₹{finalTotalPrice}
              </span>
              {totalAddonsSavings > 0 && (
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#15803d",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    fontSize: "0.76rem",
                    fontWeight: 800,
                  }}
                >
                  🎉 Total 30% Add-on Savings: ₹{totalAddonsSavings}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => onConfirmBooking(packageItem, planType, currentPkgPrice, selectedAddons)}
            style={{
              backgroundColor: "#0284c7",
              color: "#ffffff",
              border: "none",
              padding: "14px 28px",
              borderRadius: "14px",
              fontSize: "1rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 10px 25px -5px rgba(2, 132, 199, 0.4)",
              transition: "transform 0.1s ease",
            }}
          >
            Confirm & Proceed to Book →
          </button>
        </div>
      </div>
    </div>
  );
}
