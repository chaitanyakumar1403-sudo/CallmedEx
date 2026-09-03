"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import healthPackages from "@/data/health-packages.json";
import PackageAddonModal, { HealthPackageItem, SelectedAddonTest } from "@/app/components/PackageAddonModal";

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function savingsPct(mrp: number, price: number): number {
  if (mrp <= 0) return 0;
  return Math.round((1 - price / mrp) * 100);
}

export default function PackagesPage() {
  const router = useRouter();
  const [selectedPkgForAddon, setSelectedPkgForAddon] = useState<HealthPackageItem | null>(null);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);

  const packagesList = healthPackages as HealthPackageItem[];

  const handleOpenAddons = (pkg: HealthPackageItem) => {
    setSelectedPkgForAddon(pkg);
    setIsAddonModalOpen(true);
  };

  const handleConfirmBookingWithAddons = (
    pkg: HealthPackageItem,
    planType: "single" | "couple",
    pkgPrice: number,
    selectedAddons: SelectedAddonTest[]
  ) => {
    setIsAddonModalOpen(false);

    // Build URL query parameters
    const params = new URLSearchParams();
    params.set("type", "lab");
    params.set("package", pkg.name);
    params.set("price", String(pkgPrice));
    params.set("plan_type", planType);

    if (selectedAddons.length > 0) {
      params.set(
        "addons",
        JSON.stringify(
          selectedAddons.map((a) => ({
            name: `${a.name} (Add-on 30% OFF)`,
            price: a.discountedPrice,
            original_price: a.originalPrice,
          }))
        )
      );
    }

    router.push(`/booking?${params.toString()}`);
  };

  return (
    <div className="section" style={{ backgroundColor: "#f8fafc", minHeight: "85vh", paddingBottom: 64 }}>
      <div className="container">
        {/* ── Section Title ────────────────────────────────────────── */}
        <div className="section-title" style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(2, 132, 199, 0.1)",
              border: "1px solid rgba(2, 132, 199, 0.25)",
              color: "#0284c7",
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            🎁 100% TRANSPARENT HEALTH PACKAGES • VIZAG HOME COLLECTION INCLUDED
          </div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 900, color: "#0f172a", margin: "0 0 8px" }}>
            Health Packages
          </h1>
          <p style={{ maxWidth: 650, margin: "0 auto", color: "#64748b", fontSize: "1.05rem" }}>
            Fixed CallMedex rates with free doorstep blood collection. Add any individual test or imaging scan with your package for an instant <strong>Flat 30% Discount</strong>.
          </p>
        </div>

        {/* ── Packages Grid (Exclusively 15 Health Packages) ─────── */}
        <div className="grid-3" style={{ gap: 24 }}>
          {packagesList.map((pkg) => {
            const singlePrice = pkg.single_price || pkg.price;
            const couplePrice = pkg.couple_price;
            const singleSavings = savingsPct(pkg.mrp, singlePrice);
            const tests = pkg.tests.split(/[,/]/).map((t) => t.trim()).filter(Boolean);

            return (
              <div
                key={pkg.id}
                className="card"
                style={{
                  padding: 24,
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Top Accent Strip */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: "linear-gradient(90deg, #0284c7, #10b981)",
                  }}
                />

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
                      {pkg.name}
                    </h3>
                  </div>

                  {/* Designated Add-on Tag if any */}
                  {pkg.special_add_on && (
                    <div
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        marginBottom: 10,
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        color: "#059669",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                    >
                      ⭐ Recommended Add-on: {pkg.special_add_on} (30% OFF)
                    </div>
                  )}

                  {/* Included Tests Pill List */}
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#64748b",
                      lineHeight: 1.6,
                      marginTop: 8,
                      marginBottom: 16,
                      background: "#f8fafc",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      ✓ Includes {tests.length} Parameters:
                    </div>
                    <div>
                      {tests.slice(0, 5).join(" · ")}
                      {tests.length > 5 && ` · +${tests.length - 5} more`}
                    </div>
                  </div>
                </div>

                {/* Price & Action Section */}
                <div>
                  <div
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "#f0fdf4",
                      borderRadius: 14,
                      border: "1px solid #bbf7d0",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div>
                        <span style={{ color: "#94a3b8", textDecoration: "line-through", fontSize: "0.85rem" }}>
                          {inr(pkg.mrp)}
                        </span>
                        <div style={{ fontSize: "1.65rem", fontWeight: 900, color: "#0f172a" }}>
                          {inr(singlePrice)}
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>Single Person</span>
                      </div>

                      {couplePrice ? (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#059669" }}>
                            {inr(couplePrice)}
                          </div>
                          <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 700 }}>
                            Couple (2 Persons)
                          </span>
                        </div>
                      ) : (
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              background: "#dcfce7",
                              color: "#166534",
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: "0.75rem",
                              fontWeight: 800,
                            }}
                          >
                            {singleSavings}% OFF
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary Attention-Grabbing Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenAddons(pkg)}
                    style={{
                      width: "100%",
                      backgroundColor: "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: "0.92rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                      marginBottom: 8,
                    }}
                  >
                    <span>🎁 Add Tests & Save 30%</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/booking?type=lab&package=${encodeURIComponent(pkg.name)}&price=${singlePrice}`);
                    }}
                    style={{
                      width: "100%",
                      backgroundColor: "transparent",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      padding: "8px 14px",
                      borderRadius: 10,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Quick Book Base Package
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 30% Add-On Test Customizer Modal ────────────────────── */}
      {isAddonModalOpen && selectedPkgForAddon && (
        <PackageAddonModal
          packageItem={selectedPkgForAddon}
          isOpen={isAddonModalOpen}
          onClose={() => setIsAddonModalOpen(false)}
          onConfirmBooking={handleConfirmBookingWithAddons}
        />
      )}
    </div>
  );
}