"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Package,
  Boxes,
  FlaskConical,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

type KitItem = {
  code: string;
  name: string;
  category: "tube" | "container" | "consumable";
  cap_colour: string;
  decrement_event: string;
  quantity: number;
  used_today: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  tube: "Blood Collection Tubes & Specimen Containers",
  container: "Blood Collection Tubes & Specimen Containers",
  consumable: "Clinical Consumables & PPE",
};

const TUBE_DESCRIPTIONS: Record<string, string> = {
  edta: "K2 EDTA • Hematology & Complete Blood Count (CBC)",
  citrate: "Sodium Citrate 3.2% • Coagulation & PT/INR",
  fluoride: "Sodium Fluoride / Oxalate • Plasma Glucose & Fasting",
  plain: "Clot Activator (No Gel) • Blood Banking & Serology",
  sst: "Serum Separator Tube (Gel + Activator) • Biochemistry",
  urine: "Sterile Graduated Specimen Cup (50 mL) • Urinalysis",
};

const CAP_COLOUR_MAP: Record<string, { bg: string; border: string; glow: string; label: string }> = {
  lavender: { bg: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)", border: "#7e22ce", glow: "rgba(168, 85, 247, 0.3)", label: "Lavender" },
  gold: { bg: "linear-gradient(135deg, #facc15 0%, #ca8a04 100%)", border: "#ca8a04", glow: "rgba(250, 204, 21, 0.3)", label: "Gold / Yellow" },
  blue: { bg: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)", border: "#1d4ed8", glow: "rgba(37, 99, 235, 0.3)", label: "Light Blue" },
  grey: { bg: "linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)", border: "#374151", glow: "rgba(107, 114, 128, 0.3)", label: "Grey" },
  red: { bg: "linear-gradient(135deg, #f87171 0%, #dc2626 100%)", border: "#b91c1c", glow: "rgba(220, 38, 38, 0.3)", label: "Plain Red" },
  yellow: { bg: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)", border: "#b45309", glow: "rgba(217, 119, 6, 0.3)", label: "Yellow" },
  green: { bg: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)", border: "#15803d", glow: "rgba(22, 163, 74, 0.3)", label: "Green" },
  black: { bg: "linear-gradient(135deg, #4b5563 0%, #111827 100%)", border: "#030712", glow: "rgba(17, 24, 39, 0.3)", label: "Black" },
  white: { bg: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)", border: "#9ca3af", glow: "rgba(156, 163, 175, 0.3)", label: "White" },
};

const CATEGORY_ORDER = ["tube", "container", "consumable"];

export default function PhleboStockPanel() {
  const [items, setItems] = useState<KitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [quickFilling, setQuickFilling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/phlebo/stock`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Could not load kit & stock.");
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("Network error loading stock.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (itemCode: string, overrideQty?: number) => {
    const raw = overrideQty !== undefined ? String(overrideQty) : edits[itemCode];
    if (raw === undefined || raw === "") return;
    const qty = parseInt(raw, 10);
    if (isNaN(qty) || qty < 0) return;

    setSaving((prev) => ({ ...prev, [itemCode]: true }));
    try {
      const res = await fetch(`${apiBase}/api/phlebo/stock`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item_code: itemCode, quantity: qty }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setItems((prev) =>
          prev.map((i) =>
            i.code === itemCode ? { ...i, quantity: data.quantity } : i,
          ),
        );
        setEdits((prev) => {
          const next = { ...prev };
          delete next[itemCode];
          return next;
        });
        setJustSaved((prev) => ({ ...prev, [itemCode]: true }));
        setTimeout(() => {
          setJustSaved((prev) => ({ ...prev, [itemCode]: false }));
        }, 2000);
      }
    } catch {
      // Retain state on error
    } finally {
      setSaving((prev) => ({ ...prev, [itemCode]: false }));
    }
  };

  const handleStep = (itemCode: string, delta: number) => {
    const currentItem = items.find((i) => i.code === itemCode);
    const currentVal = edits[itemCode] !== undefined ? parseInt(edits[itemCode], 10) : (currentItem?.quantity || 0);
    const newVal = Math.max(0, (isNaN(currentVal) ? 0 : currentVal) + delta);
    setEdits((prev) => ({ ...prev, [itemCode]: String(newVal) }));
  };

  const handleQuickRestockAll = async () => {
    if (!confirm("Quick Restock: Add +10 units to all collection tubes and consumables for today's shift?")) return;
    setQuickFilling(true);
    try {
      for (const item of items) {
        const targetQty = (item.quantity || 0) + 10;
        await fetch(`${apiBase}/api/phlebo/stock`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ item_code: item.code, quantity: targetQty }),
        });
      }
      await load();
    } catch {
      // silent
    } finally {
      setQuickFilling(false);
    }
  };

  // Group items by category
  const groups: Record<string, KitItem[]> = {};
  for (const item of items) {
    const key = item.category;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  if (loading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid #e2e8f0", borderTopColor: "#0284c7",
          animation: "spin 0.8s linear infinite", margin: "0 auto 16px"
        }} />
        <p style={{ fontWeight: 600 }}>Loading field equipment and inventory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 16, background: "#fef2f2", border: "1px solid #fecaca",
        borderRadius: 12, color: "#b91c1c", fontWeight: 600
      }}>
        {error}
      </div>
    );
  }

  const totalTubesInHand = items
    .filter((i) => i.category === "tube" || i.category === "container")
    .reduce((acc, i) => acc + (i.quantity || 0), 0);

  const totalUsedToday = items.reduce((acc, i) => acc + (i.used_today || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner & Quick Actions */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "white",
        padding: "20px 24px",
        borderRadius: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.15)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 8, background: "rgba(2, 132, 199, 0.3)", color: "#38bdf8"
            }}>
              <Boxes size={16} />
            </span>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
              Field Equipment &amp; Kit Inventory
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#94a3b8" }}>
            Vacuum collection tubes and consumables automatically decrement upon doorstep barcode registration.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#38bdf8" }}>{totalTubesInHand}</div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tubes In Hand</div>
          </div>
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.15)" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#34d399" }}>{totalUsedToday}</div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Collected Today</div>
          </div>

          <button
            type="button"
            onClick={handleQuickRestockAll}
            disabled={quickFilling}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "white", padding: "8px 14px", borderRadius: 8,
              fontSize: "0.8rem", fontWeight: 700, cursor: quickFilling ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            <Sparkles size={14} color="#facc15" />
            {quickFilling ? "Restocking..." : "+10 Shift Restock"}
          </button>
        </div>
      </div>

      {/* Item Groups */}
      {CATEGORY_ORDER.map((cat) => {
        const catItems = groups[cat];
        if (!catItems || catItems.length === 0) return null;
        const label = CATEGORY_LABEL[cat] || cat;

        return (
          <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: "0.88rem", fontWeight: 800, color: "#1e293b",
              textTransform: "uppercase", letterSpacing: "0.5px"
            }}>
              {cat === "consumable" ? <FlaskConical size={16} color="#0284c7" /> : <Boxes size={16} color="#0284c7" />}
              {label}
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>({catItems.length} items)</span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14
            }}>
              {catItems.map((item) => {
                const isEdited = edits[item.code] !== undefined;
                const displayQty = isEdited ? parseInt(edits[item.code], 10) || 0 : item.quantity;
                const capCfg = CAP_COLOUR_MAP[item.cap_colour?.toLowerCase()] || {
                  bg: "#64748b", border: "#475569", glow: "transparent", label: item.cap_colour || "Standard"
                };

                // Determine stock status pill
                let statusBadge = {
                  label: "Optimal Stock",
                  bg: "#f0fdf4",
                  border: "#bbf7d0",
                  text: "#15803d",
                  icon: CheckCircle2,
                };
                if (displayQty === 0) {
                  statusBadge = {
                    label: "Depleted (0)",
                    bg: "#f8fafc",
                    border: "#e2e8f0",
                    text: "#64748b",
                    icon: AlertCircle,
                  };
                } else if (displayQty <= 5) {
                  statusBadge = {
                    label: "Low Stock (≤5)",
                    bg: "#fffbeb",
                    border: "#fde68a",
                    text: "#b45309",
                    icon: AlertTriangle,
                  };
                }

                const StatusIcon = statusBadge.icon;
                const detailDesc = Object.entries(TUBE_DESCRIPTIONS).find(([k]) =>
                  item.name.toLowerCase().includes(k)
                )?.[1] || "Clinical Field Collection Specification";

                return (
                  <div
                    key={item.code}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 14,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                    }}
                  >
                    {/* Top: Cap Visualizer + Item Name + Subtitle */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {/* Tube Cap Capsule */}
                          <div style={{
                            width: 20,
                            height: 28,
                            borderRadius: "6px 6px 3px 3px",
                            background: capCfg.bg,
                            border: `1.5px solid ${capCfg.border}`,
                            boxShadow: `0 2px 6px ${capCfg.glow}`,
                            flexShrink: 0,
                            position: "relative",
                            overflow: "hidden"
                          }}>
                            {/* Cap highlight sheen */}
                            <div style={{
                              position: "absolute", top: 0, left: 0, right: 0, height: 6,
                              background: "rgba(255,255,255,0.4)"
                            }} />
                          </div>

                          <div>
                            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
                              {item.name}
                            </h4>
                            <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginTop: 2 }}>
                              {detailDesc}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: "0.68rem", fontWeight: 700, padding: "3px 8px",
                          borderRadius: 20, background: statusBadge.bg,
                          border: `1px solid ${statusBadge.border}`, color: statusBadge.text,
                          whiteSpace: "nowrap", flexShrink: 0
                        }}>
                          <StatusIcon size={11} />
                          {statusBadge.label}
                        </div>
                      </div>

                      {/* Usage summary */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem", color: "#64748b", marginTop: 6 }}>
                        <span style={{
                          display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                          background: item.used_today > 0 ? "#10b981" : "#cbd5e1"
                        }} />
                        {item.used_today > 0 ? (
                          <strong style={{ color: "#059669" }}>{item.used_today} tubes collected today</strong>
                        ) : (
                          "0 used today"
                        )}
                      </div>
                    </div>

                    {/* Bottom: Stepper + Input + Save Button */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 12,
                      borderTop: "1px solid #f1f5f9",
                      gap: 12
                    }}>
                      {/* Count Display */}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{
                          fontSize: "1.45rem", fontWeight: 800,
                          color: displayQty === 0 ? "#94a3b8" : "#0f172a",
                          lineHeight: 1
                        }}>
                          {displayQty}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>in bag</span>
                      </div>

                      {/* Steppers & Save */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center",
                          border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc",
                          overflow: "hidden"
                        }}>
                          <button
                            type="button"
                            onClick={() => handleStep(item.code, -1)}
                            disabled={displayQty <= 0}
                            style={{
                              width: 28, height: 32, border: "none", background: "none",
                              cursor: displayQty <= 0 ? "not-allowed" : "pointer",
                              display: "grid", placeItems: "center", color: "#475569"
                            }}
                          >
                            <Minus size={12} />
                          </button>

                          <input
                            type="number"
                            min={0}
                            value={isEdited ? edits[item.code] : item.quantity}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [item.code]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(item.code); }}
                            style={{
                              width: 44, height: 32, border: "none", textAlign: "center",
                              fontWeight: 700, fontSize: "0.85rem", background: "white",
                              outline: "none", color: "#0f172a"
                            }}
                          />

                          <button
                            type="button"
                            onClick={() => handleStep(item.code, 1)}
                            style={{
                              width: 28, height: 32, border: "none", background: "none",
                              cursor: "pointer", display: "grid", placeItems: "center", color: "#475569"
                            }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSave(item.code)}
                          disabled={saving[item.code] || !isEdited}
                          style={{
                            height: 32, padding: "0 12px", borderRadius: 8,
                            fontSize: "0.78rem", fontWeight: 700, border: "none",
                            background: justSaved[item.code]
                              ? "#10b981"
                              : isEdited
                              ? "#0284c7"
                              : "#f1f5f9",
                            color: justSaved[item.code] || isEdited ? "white" : "#94a3b8",
                            cursor: saving[item.code] || !isEdited ? "default" : "pointer",
                            transition: "all 0.2s",
                            display: "inline-flex", alignItems: "center", gap: 4
                          }}
                        >
                          {justSaved[item.code] ? (
                            <>
                              <Check size={13} /> Saved
                            </>
                          ) : saving[item.code] ? (
                            "..."
                          ) : (
                            "Save"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}