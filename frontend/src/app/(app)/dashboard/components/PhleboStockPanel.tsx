"use client";

/**
 * Phlebo Kit & Stock Panel — DoctorC-style "Current Equipment" inventory.
 *
 * Displays all active kit items grouped by category, with per-phlebo stock
 * counts that auto-decrement as samples are collected.  The phlebotomist can
 * manually adjust counts via an inline input + Save button.
 *
 * Layout mirrors DoctorC: colour dot for tubes/containers, big in-hand count,
 * muted "used today" stat.  Low-stock (<=5) items are highlighted.
 */

import { useCallback, useEffect, useState } from "react";
import { Banner, Icon, SkeletonRows } from "@/components/ui";
import { Package, Boxes, FlaskConical } from "@/components/ui/icons";

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
  tube: "Tubes & Containers",
  container: "Tubes & Containers",
  consumable: "Consumables",
};

const CATEGORY_ICON: Record<string, any> = {
  tube: Boxes,
  container: Boxes,
  consumable: FlaskConical,
};

const CATEGORY_ORDER = ["tube", "container", "consumable"];

export default function PhleboStockPanel() {
  const [items, setItems] = useState<KitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  // Track edits locally so the input is editable before Save is clicked.
  const [edits, setEdits] = useState<Record<string, string>>({});

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

  const handleSave = async (itemCode: string) => {
    const raw = edits[itemCode];
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
        // Update local state
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
      }
    } catch {
      // Silently fail — the user can retry.
    } finally {
      setSaving((prev) => ({ ...prev, [itemCode]: false }));
    }
  };

  // Group items by category, respecting CATEGORY_ORDER
  const groups: Record<string, KitItem[]> = {};
  for (const item of items) {
    const key = item.category;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  if (loading) {
    return <SkeletonRows rows={4} />;
  }
  if (error) {
    return <Banner tone="urgent">{error}</Banner>;
  }

  return (
    <div className="stock-panel">
      <div className="stock-panel__explainer">
        <Icon as={Package} size={16} />
        <span>
          Counts auto-decrement as you collect.
        </span>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const catItems = groups[cat];
        if (!catItems || catItems.length === 0) return null;
        const label = CATEGORY_LABEL[cat] || cat;
        const CatIcon = CATEGORY_ICON[cat] || Boxes;

        return (
          <div key={cat} className="stock-panel__group">
            <div className="stock-panel__group-title">
              <Icon as={CatIcon} size={14} /> {label}
            </div>
            <div className="stock-panel__grid">
              {catItems.map((item) => {
                const isLow = item.quantity <= 5;
                const editVal =
                  edits[item.code] !== undefined
                    ? edits[item.code]
                    : String(item.quantity);

                return (
                  <div
                    key={item.code}
                    className={`stock-card${isLow ? " stock-card--low" : ""}`}
                  >
                    {/* Colour dot for tubes/containers */}
                    {(item.category === "tube" || item.category === "container") &&
                    item.cap_colour ? (
                      <div
                        className="stock-card__dot"
                        style={{
                          backgroundColor: CAP_COLOUR_MAP[item.cap_colour] || "#ccc",
                        }}
                      />
                    ) : (
                      <div className="stock-card__dot" style={{ backgroundColor: "#e5e7eb" }} />
                    )}

                    <div className="stock-card__info">
                      <div className="stock-card__name">{item.name}</div>
                      <div className="stock-card__meta">
                        {item.used_today > 0
                          ? `${item.used_today} used today`
                          : "Not used today"}
                      </div>
                    </div>

                    <div
                      className={`stock-card__count${isLow ? " stock-card__count--low" : ""}`}
                    >
                      {editVal}
                    </div>

                    <div className="stock-card__controls">
                      <input
                        className="stock-card__input"
                        type="number"
                        min={0}
                        value={editVal}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [item.code]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSave(item.code);
                        }}
                      />
                      <button
                        className="stock-card__save"
                        disabled={saving[item.code]}
                        onClick={() => handleSave(item.code)}
                      >
                        {saving[item.code] ? "..." : "Save"}
                      </button>
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

const CAP_COLOUR_MAP: Record<string, string> = {
  lavender: "#e6b8d4",
  gold: "#f0d060",
  blue: "#60a5fa",
  grey: "#9ca3af",
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
  black: "#1f2937",
  white: "#f3f4f6",
};