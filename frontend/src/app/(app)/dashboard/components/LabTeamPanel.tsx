"use client";

/**
 * Phlebotomy Team panel — diagnostic centre.
 *
 * The centre's side of a two-sided affiliation. A centre may invite a collector,
 * but the collector must accept before they appear on the roster — so an invited
 * name sits under "Invited" rather than counting as staff. Collectors who applied
 * appear as requests the centre must answer.
 */

import { useCallback, useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

export default function LabTeamPanel() {
  const [team, setTeam] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [busy, setBusy] = useState(false);
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
      const res = await fetch(`${apiBase}/api/lab-team`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      setTeam(data.team || []);
      setIncoming(data.incoming || []);
      setSent(data.sent || []);
    } catch {
      setMsg({ kind: "err", text: "Could not load your team." });
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    if (!identifier.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/lab-team/invite`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ identifier: identifier.trim(), message: inviteMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Could not send the invitation." });
        return;
      }
      setMsg({ kind: "ok", text: data.message });
      setIdentifier("");
      setInviteMessage("");
      await load();
    } catch {
      setMsg({ kind: "err", text: "Network error sending the invitation." });
    } finally {
      setBusy(false);
    }
  }

  async function respond(linkId: string, accept: boolean) {
    setBusy(true);
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
      await load();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(linkId: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/lab-team/${linkId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Could not remove them." });
        return;
      }
      setMsg({ kind: "ok", text: data.message });
      await load();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading team…</div>;
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

      {/* ── Requests to answer ───────────────────────────────────────── */}
      {incoming.length > 0 && (
        <div className="card" style={{ padding: 20, borderLeft: "5px solid #f59e0b" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem" }}>
            🔔 Collectors asking to join ({incoming.length})
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            {incoming.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {r.phlebotomist?.full_name || "Collector"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    {r.phlebotomist?.mobile} • {r.phlebotomist?.email}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => respond(r.id, true)} disabled={busy} className="btn btn-primary" style={{ padding: "6px 16px", fontSize: "0.83rem" }}>
                    Approve
                  </button>
                  <button onClick={() => respond(r.id, false)} disabled={busy} style={declineBtn}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Invite ───────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem" }}>➕ Invite a collector</h3>
        <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#64748b" }}>
          Invite by email or mobile. They join your roster only once they accept.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or mobile number"
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          />
          <input
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            placeholder="Message (optional)"
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button onClick={invite} disabled={busy || !identifier.trim()} className="btn btn-primary" style={{ opacity: busy || !identifier.trim() ? 0.6 : 1 }}>
            Send invite
          </button>
        </div>
      </div>

      {/* ── Roster ───────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem" }}>
          🧑‍🔬 Your collectors ({team.length})
        </h3>
        {team.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>
            No collectors yet. Invited people appear here once they accept.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {team.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {m.phlebotomist?.full_name || "Collector"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    {m.phlebotomist?.mobile} • joined{" "}
                    {m.responded_at ? new Date(m.responded_at).toLocaleDateString("en-IN") : "—"}
                  </div>
                </div>
                <button onClick={() => remove(m.id)} disabled={busy} style={declineBtn}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Awaiting their answer ────────────────────────────────────── */}
      {sent.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem" }}>
            ⏳ Invited, awaiting reply ({sent.length})
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {sent.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#334155" }}>
                    {s.phlebotomist?.full_name || "Collector"}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    Invited {new Date(s.requested_at).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <button onClick={() => remove(s.id)} disabled={busy} style={declineBtn}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: "0.9rem",
};

const declineBtn: React.CSSProperties = {
  padding: "6px 16px",
  fontSize: "0.83rem",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};
