"use client";

/**
 * Daily attendance card — field providers.
 *
 * The MOUs require a live selfie with the collection kit before field duty, by
 * 05:15 IST. Missing it holds PAYMENT, not dispatch — so the copy here is
 * careful to say the payout is paused, never that work is blocked. A provider
 * who reads "you can't work" when they can will stop taking jobs, which costs
 * the patient.
 */

import { useCallback, useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

export default function AttendanceCard() {
  const [state, setState] = useState<any>(null);
  const [selfieUrl, setSelfieUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    }),
    []
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/attendance/today`, { headers: authHeaders() });
      setState(await res.json().catch(() => ({})));
    } catch {
      /* the card is supplementary — a failure here must not block the dashboard */
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!selfieUrl.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/attendance`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ selfie_url: selfieUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Could not record attendance." });
        return;
      }
      setMsg({ kind: data.is_late ? "err" : "ok", text: data.message });
      setSelfieUrl("");
      await load();
    } catch {
      setMsg({ kind: "err", text: "Network error recording attendance." });
    } finally {
      setSaving(false);
    }
  }

  if (!state) return null;

  const done = state.submitted && !state.is_late;

  return (
    <div
      className="card"
      style={{
        padding: 18,
        borderLeft: `5px solid ${done ? "#16a34a" : state.on_hold ? "#dc2626" : "#f59e0b"}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>
            📸 Daily attendance {done ? "✓" : ""}
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.83rem", color: "#64748b" }}>
            Live selfie with your ID and collection kit, by {state.deadline} IST.
          </p>
        </div>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: "0.75rem",
            fontWeight: 700,
            height: "fit-content",
            background: done ? "#dcfce7" : state.status === "missed" ? "#fee2e2" : "#fef3c7",
            color: done ? "#166534" : state.status === "missed" ? "#991b1b" : "#92400e",
          }}
        >
          {done ? "Recorded" : state.status === "missed" ? "Missed" : state.is_late ? "Late" : "Pending"}
        </span>
      </div>

      {state.on_hold && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            fontSize: "0.84rem",
          }}
        >
          <strong>Payout paused.</strong> {state.hold_reason}. You can still take jobs and
          keep earning — only the transfer is on hold.
        </div>
      )}

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: "0.84rem",
            background: msg.kind === "ok" ? "#dcfce7" : "#fef2f2",
            color: msg.kind === "ok" ? "#166534" : "#991b1b",
          }}
        >
          {msg.text}
        </div>
      )}

      {!done && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input
            value={selfieUrl}
            onChange={(e) => setSelfieUrl(e.target.value)}
            placeholder="Selfie image URL"
            style={{
              flex: 1,
              minWidth: 220,
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: "0.87rem",
            }}
          />
          <button
            onClick={submit}
            disabled={saving || !selfieUrl.trim()}
            className="btn btn-primary"
            style={{ opacity: saving || !selfieUrl.trim() ? 0.6 : 1 }}
          >
            {saving ? "Recording…" : "Submit"}
          </button>
        </div>
      )}
    </div>
  );
}
