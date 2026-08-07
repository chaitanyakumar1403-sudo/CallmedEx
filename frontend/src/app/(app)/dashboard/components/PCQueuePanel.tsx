"use client";

/**
 * PCQueuePanel — Capacity & Queue Tiles
 *
 * Shows upcoming booking volume and expected tube counts by type.
 * e.g. "140 EDTA Lavender, 80 SST Gold for tomorrow"
 */

import { useCallback, useEffect, useState } from "react";
import { Stat, StatGrid } from "@/components/ui";
import { Icon } from "@/components/ui";
import {
  TestTube, Package, ShieldCheck, Ban, BarChart3, Clock,
} from "@/components/ui/icons";

const TUBE_COLOURS: Record<string, string> = {
  lavender: "#9b59b6",
  gold: "#f39c12",
  blue: "#3498db",
  grey: "#95a5a6",
  red: "#e74c3c",
  green: "#2ecc71",
  yellow: "#f1c40f",
};

function capToHex(cap: string): string {
  const key = (cap || "").toLowerCase().trim();
  return TUBE_COLOURS[key] || "#64748b";
}

export default function PCQueuePanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/pc/queue", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to load queue");
      setData(json);
    } catch (e: any) {
      setError(e.message || "Failed to load queue data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        Loading queue data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "16px 20px", borderRadius: 12,
        background: "#fee2e2", color: "#991b1b",
        border: "1px solid #fca5a5", fontWeight: 600,
      }}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  const capacity = data.daily_capacity || 0;
  const total = data.pending_collection + data.awaiting_verification + data.verified_today;
  const utilPct = capacity > 0 ? Math.round((total / capacity) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* ── 10 Canonical Laboratory Workflow Widgets ─────────────────── */}
      <div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", color: "#0f172a", fontWeight: 700 }}>
          Laboratory Workflow Pipeline
        </h3>
        <StatGrid>
          <Stat
            label="Pending Receipt"
            value={data.pending_receipt ?? data.pending_collection}
            meta="In transit / expecting arrival"
            icon={Clock}
            tone="default"
          />
          <Stat
            label="Received"
            value={data.received ?? data.awaiting_verification}
            meta="Intake desk scanned"
            icon={Package}
            tone="default"
          />
          <Stat
            label="Verification Queue"
            value={data.verification_queue ?? data.awaiting_verification}
            meta="Awaiting 5-point quality check"
            icon={ShieldCheck}
            tone={(data.verification_queue ?? 0) > 0 ? "urgent" : "default"}
          />
          <Stat
            label="Verified"
            value={data.verified ?? data.verified_today}
            meta="Passed quality check"
            icon={ShieldCheck}
            tone="done"
          />
          <Stat
            label="Submitted to MediAssist"
            value={data.submitted_to_mediassist ?? 0}
            meta="Handoff payload sent"
            icon={Package}
            tone="default"
          />
          <Stat
            label="Awaiting Report"
            value={data.awaiting_report ?? 0}
            meta="In processing pipeline"
            icon={Clock}
            tone="default"
          />
          <Stat
            label="Report Processing"
            value={data.report_processing ?? 0}
            meta="OCR / interpretation active"
            icon={BarChart3}
            tone="default"
          />
          <Stat
            label="Delivered"
            value={data.delivered ?? 0}
            meta="Patient notified on WhatsApp"
            icon={Package}
            tone="done"
          />
          <Stat
            label="Corrected Reports"
            value={data.corrected_reports ?? 0}
            meta="Updated version released"
            icon={ShieldCheck}
            tone="default"
          />
          <Stat
            label="Failed Jobs"
            value={data.failed_jobs ?? 0}
            meta="Requires admin retry"
            icon={Ban}
            tone={(data.failed_jobs ?? 0) > 0 ? "urgent" : "default"}
          />
        </StatGrid>
      </div>

      {/* ── Capacity bar ───────────────────────────────────────────── */}
      {capacity > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 10,
          }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>
              <Icon as={BarChart3} size={16} /> Daily Capacity
            </div>
            <span style={{
              fontWeight: 800, fontSize: "1.1rem",
              color: utilPct > 90 ? "#dc2626" : utilPct > 70 ? "#f59e0b" : "#16a34a",
            }}>
              {utilPct}%
            </span>
          </div>
          <div style={{
            height: 10, borderRadius: 999,
            background: "#e2e8f0", overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.min(utilPct, 100)}%`,
              borderRadius: 999,
              background: utilPct > 90
                ? "linear-gradient(90deg, #dc2626, #ef4444)"
                : utilPct > 70
                  ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                  : "linear-gradient(90deg, #16a34a, #22c55e)",
              transition: "width 0.6s ease",
            }} />
          </div>
          <div style={{
            fontSize: "0.8rem", color: "#64748b", marginTop: 6,
          }}>
            {total} of {capacity} daily capacity
          </div>
        </div>
      )}

      {/* ── Tube breakdown ─────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 14px 0", fontSize: "1.05rem", color: "#0f172a" }}>
          <Icon as={TestTube} size={16} /> Expected Tubes by Type
        </h3>

        {data.tube_breakdown?.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>
            No pending tubes at the moment.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {(data.tube_breakdown || []).map((tube: any) => (
              <div
                key={tube.tube_type_code}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderRadius: 10,
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: capToHex(tube.cap_colour),
                  border: "2px solid #fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.92rem" }}>
                    {tube.name}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    {tube.cap_colour ? `${tube.cap_colour} cap` : tube.tube_type_code}
                  </div>
                </div>
                <div style={{
                  fontWeight: 800, fontSize: "1.2rem",
                  color: "#1a2b4a", fontFamily: "monospace",
                }}>
                  {tube.count}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
