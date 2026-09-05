"use client";

/**
 * PCRosterPanel — Advance Roster Management
 *
 * The centre marks who is available tomorrow. Shows phlebotomists with their
 * roster status, assigned/unassigned job counts, and the ability to run the
 * assignment pass early.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui";
import {
  CalendarDays, Users, RefreshCw, CheckCircle2, Clock, AlertTriangle,
} from "@/components/ui/icons";
import { pcAPI } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "available", label: "Available", color: "#16a34a", bg: "#dcfce7" },
  { value: "unavailable", label: "Unavailable", color: "#64748b", bg: "#f1f5f9" },
  { value: "leave", label: "On Leave", color: "#dc2626", bg: "#fee2e2" },
];

export default function PCRosterPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Date picker
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [selectedDate, setSelectedDate] = useState(
    tomorrow.toISOString().split("T")[0]
  );

  // Local roster edits (user_id → status)
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Roster writes are centre-admin only (require_pc_admin on the backend).
  // The buttons used to be shown to everyone, so a technician could edit the
  // whole roster, press Save and get a flat error with no idea why — which is
  // how "the processing centre roster is broken" gets reported.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    pcAPI.getMe()
      .then((me: any) => setIsAdmin(me?.pc_role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // A previous failure's banner used to survive every later successful
    // reload, so the panel showed an error over correct, current data.
    setMsg(null);
    try {
      const result = await pcAPI.getRosterSummary(selectedDate);
      setData(result);
      // Initialize edits from current roster
      const initial: Record<string, string> = {};
      for (const p of result.phlebotomists || []) {
        initial[p.user_id] = p.roster_status;
      }
      setEdits(initial);
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to load roster" });
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  async function saveRoster() {
    setBusy(true);
    setMsg(null);
    try {
      const entries = Object.entries(edits)
        .filter(([_, status]) => status !== "not_rostered")
        .map(([user_id, status]) => ({
          phlebotomist_user_id: user_id,
          status,
          max_jobs: 0,
        }));
      await pcAPI.setRoster(selectedDate, entries);
      setMsg({ kind: "ok", text: "Roster saved." });
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to save roster" });
    } finally {
      setBusy(false);
    }
  }

  async function runAssignment() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await pcAPI.runRosterPass(selectedDate);
      setMsg({
        kind: "ok",
        text: `Assignment pass complete. ${result.count || 0} job(s) assigned.`,
      });
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Assignment pass failed" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading roster…</div>;
  }

  const phlebos = data?.phlebotomists || [];
  const unassigned = data?.unassigned_jobs || [];
  const available = phlebos.filter((p: any) => edits[p.user_id] === "available");
  const hasEdits = phlebos.some(
    (p: any) => edits[p.user_id] !== p.roster_status
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {msg && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, fontWeight: 600,
          background: msg.kind === "ok" ? "#dcfce7" : "#fee2e2",
          color: msg.kind === "ok" ? "#166534" : "#991b1b",
          border: `1px solid ${msg.kind === "ok" ? "#86efac" : "#fca5a5"}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* ── Date picker + summary ────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon as={CalendarDays} size={20} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: "10px 14px", borderRadius: 8,
                border: "2px solid #1a2b4a", fontWeight: 700,
                fontSize: "1rem",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: "0.85rem" }}>
            <span style={{ color: "#16a34a", fontWeight: 700 }}>
              <Icon as={CheckCircle2} size={14} /> {available.length} available
            </span>
            <span style={{ color: "#64748b", fontWeight: 700 }}>
              <Icon as={Users} size={14} /> {phlebos.length} total
            </span>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>
              <Icon as={Clock} size={14} /> {data?.total_dispatches || 0} dispatches
            </span>
          </div>
        </div>
      </div>

      {/* ── Phlebotomist list ────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10,
        }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
            <Icon as={Users} size={16} /> Phlebotomists
          </h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin === false && (
              <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
                View only — roster changes need a centre administrator.
              </span>
            )}
            {isAdmin !== false && hasEdits && (
              <Button variant="primary" onClick={saveRoster} disabled={busy}>
                {busy ? "Saving…" : "Save Roster"}
              </Button>
            )}
            {isAdmin !== false && (
              <Button variant="secondary" onClick={runAssignment} disabled={busy}>
                <Icon as={RefreshCw} size={14} /> Run Assignment
              </Button>
            )}
          </div>
        </div>

        {phlebos.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>
            No phlebotomists registered for this centre.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {phlebos.map((p: any) => {
              const currentStatus = edits[p.user_id] || "not_rostered";
              const statusInfo = STATUS_OPTIONS.find(s => s.value === currentStatus);

              return (
                <div
                  key={p.user_id}
                  style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "14px 16px",
                    borderRadius: 10, border: "1px solid #e2e8f0",
                    background: "#fff", gap: 12, flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>
                      {p.full_name || "Unnamed"}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                      {p.mobile}
                      {p.assigned_jobs > 0 && (
                        <span style={{ fontWeight: 700, marginLeft: 8, color: "#1a2b4a" }}>
                          {p.assigned_jobs} job(s) assigned
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 4 }}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        disabled={isAdmin === false}
                        onClick={() => setEdits(prev => ({
                          ...prev, [p.user_id]: opt.value,
                        }))}
                        style={{
                          padding: "6px 14px", borderRadius: 999,
                          border: "1.5px solid",
                          borderColor: currentStatus === opt.value ? opt.color : "#e2e8f0",
                          background: currentStatus === opt.value ? opt.bg : "#fff",
                          color: currentStatus === opt.value ? opt.color : "#94a3b8",
                          fontWeight: 700, fontSize: "0.78rem",
                          cursor: isAdmin === false ? "not-allowed" : "pointer",
                          opacity: isAdmin === false && currentStatus !== opt.value ? 0.5 : 1,
                          transition: "all 0.15s",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Unassigned jobs ───────────────────────────────────────── */}
      {unassigned.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 14px 0", fontSize: "1.05rem", color: "#f59e0b" }}>
            <Icon as={AlertTriangle} size={16} /> Unassigned Jobs ({unassigned.length})
          </h3>
          <p style={{ margin: "0 0 14px 0", fontSize: "0.85rem", color: "#64748b" }}>
            These bookings need manual assignment — every rostered phlebotomist declined or is out of range.
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {unassigned.map((job: any) => (
              <div
                key={job.id}
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "10px 14px",
                  borderRadius: 8, background: "#fffbeb",
                  border: "1px solid #fcd34d",
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#92400e" }}>
                    Booking: {job.booking_id?.slice(0, 8)}…
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#a16207", marginLeft: 8 }}>
                    {job.status?.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
