"use client";

/**
 * Sample Collection Panel — phlebotomist
 *
 * Three jobs, in the order the field day actually runs:
 *   1. Today's runs, urgent ones flagged red and sorted first.
 *   2. Register a tube at the patient's side (scan or mint a barcode).
 *   3. Hand the batch to a diagnostic centre for verification.
 *
 * Replaces the previous barcode "simulator", which generated a throwaway
 * VAM-###### string client-side and never persisted anything.
 */

import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "../../../components/StatusSpine";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

const SAMPLE_TYPES = ["blood", "urine", "stool", "swab", "sputum", "other"];

export default function SampleCollectionPanel() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Collection form
  const [activeTask, setActiveTask] = useState<any>(null);
  const [barcode, setBarcode] = useState("");
  const [sampleType, setSampleType] = useState("blood");
  const [containerType, setContainerType] = useState("");
  const [testNames, setTestNames] = useState("");
  const [saving, setSaving] = useState(false);

  // Handover
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Linked lab
  const [labs, setLabs] = useState<any[]>([]);
  const [homeLab, setHomeLab] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [savingLab, setSavingLab] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);

  const authHeaders = useCallback(() => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [taskRes, sampleRes, labRes, myLabRes] = await Promise.all([
        fetch(`${apiBase}/api/dispatch/my-tasks`, { headers: authHeaders() }),
        fetch(`${apiBase}/api/samples/mine`, { headers: authHeaders() }),
        fetch(`${apiBase}/api/providers/search/organizations?org_type=diagnostic_center`, {
          headers: authHeaders(),
        }),
        fetch(`${apiBase}/api/lab-team/mine`, { headers: authHeaders() }),
      ]);
      const taskData = await taskRes.json().catch(() => ({}));
      const sampleData = await sampleRes.json().catch(() => ({}));
      const labData = await labRes.json().catch(() => ({}));
      const myLab = await myLabRes.json().catch(() => ({}));

      setLabs(labData.organizations || []);
      setHomeLab({
        id: myLab.current?.org_user_id || null,
        name: myLab.current?.org_name || null,
      });
      setInvitations(myLab.incoming || []);
      setPendingApplications(myLab.sent || []);

      // Urgent first, then oldest — the red ones are the first priority.
      const list: any[] = taskData.tasks || [];
      list.sort((a, b) => {
        const ua = a.priority === "urgent" ? 0 : 1;
        const ub = b.priority === "urgent" ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });
      setTasks(list);
      setSamples(sampleData.samples || []);
    } catch (e) {
      setMsg({ kind: "err", text: "Could not load your runs. Check your connection." });
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const inHand = samples.filter(
    (s) => s.status === "collected" || s.status === "in_transit"
  );
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  async function registerSample() {
    if (!activeTask) {
      setMsg({ kind: "err", text: "Pick the run this tube belongs to first." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/samples/collect`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          patient_id: activeTask.patient_id,
          booking_id: activeTask.booking_id || null,
          dispatch_request_id: activeTask.id || null,
          barcode: barcode.trim() || null,
          sample_type: sampleType,
          container_type: containerType,
          test_names: testNames
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Could not register the tube." });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Tube ${data.barcode} registered.${data.warning ? " " + data.warning : ""}`,
      });
      setBarcode("");
      setContainerType("");
      setTestNames("");
      await loadAll();
    } catch {
      setMsg({ kind: "err", text: "Network error registering the tube." });
    } finally {
      setSaving(false);
    }
  }

  /** Ask a centre to take you on. They must accept before the link is real. */
  async function requestToJoin(orgUserId: string) {
    if (!orgUserId) return;
    setSavingLab(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/lab-team/join`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ org_user_id: orgUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Could not send the request." });
        return;
      }
      setMsg({ kind: "ok", text: data.message });
      await loadAll();
    } catch {
      setMsg({ kind: "err", text: "Network error sending the request." });
    } finally {
      setSavingLab(false);
    }
  }

  /** Accept or decline a centre's invitation. */
  async function respondToInvite(linkId: string, accept: boolean) {
    setSavingLab(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/lab-team/${linkId}/respond`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ accept }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Could not record your response." });
        return;
      }
      setMsg({ kind: "ok", text: data.message });
      await loadAll();
    } catch {
      setMsg({ kind: "err", text: "Network error recording your response." });
    } finally {
      setSavingLab(false);
    }
  }

  async function submitHandover() {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/samples/handover`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sample_ids: selectedIds,
          destination_org_user_id: destination.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Handover failed." });
        return;
      }
      setMsg({ kind: "ok", text: data.message });
      setSelected({});
      await loadAll();
    } catch {
      setMsg({ kind: "err", text: "Network error submitting the handover." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading your runs…</div>;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {msg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            fontWeight: 600,
            background: msg.kind === "ok" ? "#dcfce7" : "#fee2e2",
            color: msg.kind === "ok" ? "#166534" : "#991b1b",
            border: `1px solid ${msg.kind === "ok" ? "#86efac" : "#fca5a5"}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* ── Linked lab ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem" }}>🏥 Your linked lab</h3>
        <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#64748b" }}>
          Where your samples go by default. You can still send a batch elsewhere when a
          booking belongs to another partner centre.
        </p>

        {/* Invitations need answering before anything else on this card. */}
        {invitations.map((inv) => (
          <div
            key={inv.id}
            style={{
              padding: 14,
              borderRadius: 10,
              background: "#eff6ff",
              border: "1px solid #93c5fd",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700, color: "#1e3a8a" }}>
              {inv.org_name} invited you to join their team
            </div>
            {inv.message && (
              <div style={{ fontSize: "0.85rem", color: "#1e40af", marginTop: 4 }}>
                “{inv.message}”
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => respondToInvite(inv.id, true)}
                disabled={savingLab}
                className="btn btn-primary"
                style={{ padding: "6px 16px", fontSize: "0.83rem" }}
              >
                Accept
              </button>
              <button
                onClick={() => respondToInvite(inv.id, false)}
                disabled={savingLab}
                style={{
                  padding: "6px 16px",
                  fontSize: "0.83rem",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Decline
              </button>
            </div>
          </div>
        ))}

        {homeLab.id ? (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "#f0fdf4",
              border: "1px solid #86efac",
              color: "#166534",
              fontWeight: 700,
            }}
          >
            ✓ Teamed up with {homeLab.name}
          </div>
        ) : pendingApplications.length > 0 ? (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              color: "#92400e",
              fontSize: "0.88rem",
            }}
          >
            ⏳ Waiting on {pendingApplications[0].org_name} to approve your request.
          </div>
        ) : (
          <>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                color: "#92400e",
                fontSize: "0.85rem",
                marginBottom: 12,
              }}
            >
              Not on a team yet. Ask a centre to take you on — they confirm before
              it takes effect.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                onChange={(e) => requestToJoin(e.target.value)}
                disabled={savingLab || labs.length === 0}
                defaultValue=""
                style={{ ...inputStyle, flex: 1, minWidth: 260, marginTop: 0 }}
              >
                <option value="">— Request to join a diagnostic centre —</option>
                {labs.map((l) => (
                  <option key={l.user_id} value={l.user_id}>
                    {l.organization_name || l.name}
                    {l.city ? ` — ${l.city}` : ""}
                  </option>
                ))}
              </select>
              {savingLab && <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Sending…</span>}
            </div>
            {labs.length === 0 && (
              <p style={{ margin: "10px 0 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
                No verified diagnostic centres are listed yet.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Today's runs ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 14px 0", fontSize: "1.05rem" }}>
          📍 Your active runs ({tasks.length})
        </h3>

        {tasks.length === 0 && (
          <p style={{ color: "#64748b", margin: 0 }}>
            No active runs. Accepted dispatches appear here.
          </p>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {tasks.map((t) => {
            const urgent = t.priority === "urgent";
            const chosen = activeTask?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTask(t)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  padding: 14,
                  borderRadius: 10,
                  border: chosen ? "2px solid #1a2b4a" : "1px solid #e2e8f0",
                  // Urgent runs carry a red wash so they read as first priority.
                  background: urgent ? "#fef2f2" : "#ffffff",
                  borderLeft: urgent ? "5px solid #dc2626" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {urgent && (
                      <span style={{ color: "#dc2626", marginRight: 8 }}>🔴 URGENT</span>
                    )}
                    {(t.service_subtype || "Home collection").replace(/_/g, " ")}
                  </div>
                  <StatusPill status={t.status} urgent={urgent} />
                </div>
                <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: 6 }}>
                  {t.patient_address || "Address on the run sheet"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Register a tube ──────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem" }}>🧪 Register a collected tube</h3>
        <p style={{ margin: "0 0 14px 0", fontSize: "0.85rem", color: "#64748b" }}>
          {activeTask
            ? "Scan the label, or leave it blank and CallMedex will mint one."
            : "Select a run above first."}
        </p>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Barcode</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or leave blank"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Sample type</label>
            <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} style={inputStyle}>
              {SAMPLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Container / tube</label>
            <input
              value={containerType}
              onChange={(e) => setContainerType(e.target.value)}
              placeholder="e.g. EDTA purple-top"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>Tests (comma separated)</label>
            <input
              value={testNames}
              onChange={(e) => setTestNames(e.target.value)}
              placeholder="CBC, HbA1c"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          onClick={registerSample}
          disabled={saving || !activeTask}
          className="btn btn-primary"
          style={{ marginTop: 14, opacity: saving || !activeTask ? 0.6 : 1 }}
        >
          {saving ? "Registering…" : "Register tube"}
        </button>
      </div>

      {/* ── Manifest + handover ──────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>📦 Tubes in your hand ({inHand.length})</h3>
          {selectedIds.length > 0 && (
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1a2b4a" }}>
              {selectedIds.length} selected
            </span>
          )}
        </div>

        {inHand.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>
            Nothing awaiting handover. Registered tubes appear here until a lab accepts them.
          </p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              {inHand.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                    background: selected[s.id] ? "#f0f9ff" : "#fff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selected[s.id]}
                    onChange={(e) => setSelected({ ...selected, [s.id]: e.target.checked })}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontFamily: "monospace", color: "#0f172a" }}>
                      {s.barcode}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {s.sample_type}
                      {s.container_type ? ` • ${s.container_type}` : ""}
                      {s.test_names?.length ? ` • ${s.test_names.join(", ")}` : ""}
                    </div>
                  </div>
                  <StatusPill status={s.status} />
                </label>
              ))}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 260, marginTop: 0 }}
              >
                <option value="">
                  {homeLab.name ? `Your lab — ${homeLab.name}` : "Choose a destination lab"}
                </option>
                {labs
                  .filter((l) => l.user_id !== homeLab.id)
                  .map((l) => (
                    <option key={l.user_id} value={l.user_id}>
                      {l.organization_name || l.name}
                      {l.city ? ` — ${l.city}` : ""}
                    </option>
                  ))}
              </select>
              <button
                onClick={submitHandover}
                // Without a destination there is nowhere to send the batch, so
                // block it here rather than round-tripping to a 400.
                disabled={
                  submitting ||
                  selectedIds.length === 0 ||
                  (!destination && !homeLab.id)
                }
                className="btn btn-primary"
                style={{
                  opacity:
                    submitting || selectedIds.length === 0 || (!destination && !homeLab.id)
                      ? 0.6
                      : 1,
                }}
              >
                {submitting ? "Submitting…" : `Submit ${selectedIds.length || ""} to lab`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Recent history ───────────────────────────────────────────── */}
      {samples.length > inHand.length && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem" }}>🕓 Recent tubes</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {samples
              .filter((s) => s.status !== "collected" && s.status !== "in_transit")
              .slice(0, 15)
              .map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#f8fafc",
                  }}
                >
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{s.barcode}</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {s.rejection_reason && (
                      <span style={{ fontSize: "0.78rem", color: "#991b1b" }}>{s.rejection_reason}</span>
                    )}
                    <StatusPill status={s.status} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: "0.9rem",
  marginTop: 4,
};
