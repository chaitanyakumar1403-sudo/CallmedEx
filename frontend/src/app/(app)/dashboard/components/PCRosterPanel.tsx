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

  // Collections auto-assignment could not place, and the centre's pick per
  // booking (defaults to the top suggestion — nearest free collector).
  const [queue, setQueue] = useState<any[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);

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
      const [result, unplaced] = await Promise.all([
        pcAPI.getRosterSummary(selectedDate),
        // The roster must still render if this list fails to load.
        pcAPI.getUnassignedCollections(selectedDate).catch(() => ({ items: [] })),
      ]);
      setData(result);
      const items = unplaced?.items || [];
      setQueue(items);
      setPicks(Object.fromEntries(
        items.map((q: any) => [
          q.booking_id,
          (q.suggestions || []).find((s: any) => !s.busy_at_slot)?.user_id || "",
        ])
      ));
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

  async function assign(bookingId: string) {
    const uid = picks[bookingId];
    if (!uid) return;
    setAssigning(bookingId);
    setMsg(null);
    try {
      const result = await pcAPI.assignCollection(bookingId, uid);
      setMsg({ kind: "ok", text: result.message || "Phlebotomist assigned." });
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Could not assign the phlebotomist" });
    } finally {
      setAssigning(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading roster…</div>;
  }

  const phlebos = data?.phlebotomists || [];
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
          <div className="cm-pc-datepick" style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          <div style={{ display: "flex", gap: 8, columnGap: 16, flexWrap: "wrap", fontSize: "0.85rem" }}>
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
          <div className="cm-pc-actions cm-pc-actions--inline" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
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

                  <div className="cm-pc-seg" style={{ display: "flex", gap: 4 }}>
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

      {/* ── Collections needing a phlebotomist ────────────────────── */}
      {queue.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", color: "#b45309" }}>
            <Icon as={AlertTriangle} size={16} /> Needs a phlebotomist ({queue.length})
          </h3>
          <p style={{ margin: "0 0 14px 0", fontSize: "0.85rem", color: "#64748b" }}>
            Phlebotomists are assigned automatically from the patient&apos;s location. These are the
            collections that could not be placed automatically. Suggestions are nearest to the patient first.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {queue.map((q: any) => {
              const failed = q.reason === "auto_assignment_failed";
              return (
                <div
                  key={q.booking_id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 10,
                    background: failed ? "#fffbeb" : "#f8fafc",
                    border: `1px solid ${failed ? "#fcd34d" : "#e2e8f0"}`,
                  }}
                >
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>
                      <Icon as={Clock} size={14} /> {q.slot_time || "No time"} · {q.area || "Area not given"}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2, overflowWrap: "anywhere" }}>
                      {(q.tests || []).join(", ") || "Tests not listed"}
                    </div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, marginTop: 4, color: failed ? "#b45309" : "#64748b" }}>
                      {failed ? "Auto-assignment found no one" : "Not yet auto-assigned"}
                      {!q.has_location && " · No collection location — cannot dispatch"}
                    </div>
                  </div>
                  {isAdmin !== false && q.has_location && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", maxWidth: "100%" }}>
                      <select
                        aria-label="Phlebotomist to assign"
                        value={picks[q.booking_id] || ""}
                        onChange={(e) => setPicks((p) => ({ ...p, [q.booking_id]: e.target.value }))}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", maxWidth: "100%" }}
                      >
                        {(q.suggestions || []).length === 0 && <option value="">No verified phlebotomists</option>}
                        {(q.suggestions || []).map((s: any) => (
                          <option key={s.user_id} value={s.user_id} disabled={s.busy_at_slot}>
                            {s.full_name || "Unnamed"}
                            {s.distance_km != null ? ` · ${s.distance_km} km` : ""}
                            {s.on_leave ? " · on leave" : s.busy_at_slot ? " · busy at this time" : !s.within_radius ? " · out of range" : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="primary"
                        onClick={() => assign(q.booking_id)}
                        disabled={!picks[q.booking_id] || assigning === q.booking_id}
                      >
                        {assigning === q.booking_id ? "Assigning…" : "Assign"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
