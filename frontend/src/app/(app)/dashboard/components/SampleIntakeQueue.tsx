"use client";

/**
 * Sample Intake Queue — diagnostic centre.
 *
 * The receiving half of the phlebotomist handover. A centre verifies each tube
 * INDIVIDUALLY, because a courier bag routinely arrives with some tubes intact
 * and others haemolysed, leaking or mislabelled — a single accept/reject for
 * the whole batch would force the centre to lie about one or the other.
 *
 * Accepting credits the collecting phlebotomist and notifies the patient by name
 * of centre. Rejecting pays nothing and records the reason against the tube.
 */

import { useCallback, useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

const COMMON_REJECTIONS = [
  "Haemolysed",
  "Insufficient volume",
  "Leaked in transit",
  "Mislabelled / unreadable",
  "Wrong container",
  "Clotted",
  "Temperature excursion",
];

type Verdict = "accept" | "reject";

export default function SampleIntakeQueue() {
  const [handovers, setHandovers] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // handoverId -> sampleId -> verdict / reason
  const [verdicts, setVerdicts] = useState<Record<string, Record<string, Verdict>>>({});
  const [reasons, setReasons] = useState<Record<string, Record<string, string>>>({});

  // sampleId -> report URL being entered
  const [reportUrls, setReportUrls] = useState<Record<string, string>>({});

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    }),
    []
  );

  const load = useCallback(async () => {
    try {
      const [pendingRes, acceptedRes] = await Promise.all([
        fetch(`${apiBase}/api/samples/handovers/incoming?status=pending`, { headers: authHeaders() }),
        fetch(`${apiBase}/api/samples/handovers/incoming?status=accepted`, { headers: authHeaders() }),
      ]);
      const pending = await pendingRes.json().catch(() => ({}));
      const accepted = await acceptedRes.json().catch(() => ({}));

      setHandovers(pending.handovers || []);
      // Tubes already in the building and awaiting a report.
      const inBuilding: any[] = [];
      for (const h of accepted.handovers || []) {
        for (const s of h.samples || []) {
          if (s.status === "received" || s.status === "processing") inBuilding.push(s);
        }
      }
      setReceived(inBuilding);
    } catch {
      setMsg({ kind: "err", text: "Could not load the intake queue." });
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  function setVerdict(hid: string, sid: string, v: Verdict) {
    setVerdicts((prev) => ({ ...prev, [hid]: { ...(prev[hid] || {}), [sid]: v } }));
  }

  function setReason(hid: string, sid: string, r: string) {
    setReasons((prev) => ({ ...prev, [hid]: { ...(prev[hid] || {}), [sid]: r } }));
  }

  async function submitVerdicts(h: any) {
    const hv = verdicts[h.id] || {};
    const hr = reasons[h.id] || {};

    const rejected: Record<string, string> = {};
    const acceptedIds: string[] = [];
    for (const s of h.samples || []) {
      if (hv[s.id] === "reject") {
        rejected[s.id] = hr[s.id] || "Rejected on inspection";
      } else {
        // Anything not explicitly rejected is accepted with the batch.
        acceptedIds.push(s.id);
      }
    }

    setBusy(h.id);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/samples/handovers/${h.id}/respond`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ accepted_sample_ids: acceptedIds, rejected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Could not record the verification." });
        return;
      }
      const paid = data.payout?.amount || 0;
      setMsg({
        kind: "ok",
        text:
          `${data.message} Patients notified.` +
          (paid > 0 ? ` ₹${paid} credited to the phlebotomist.` : ""),
      });
      await load();
    } catch {
      setMsg({ kind: "err", text: "Network error recording the verification." });
    } finally {
      setBusy(null);
    }
  }

  async function publishReport(sampleId: string) {
    const url = (reportUrls[sampleId] || "").trim();
    if (!url) return;
    setBusy(sampleId);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/samples/${sampleId}/report`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ report_url: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: data.detail || "Could not publish the report." });
        return;
      }
      setMsg({ kind: "ok", text: "Report published. The patient has been notified." });
      setReportUrls((p) => ({ ...p, [sampleId]: "" }));
      await load();
    } catch {
      setMsg({ kind: "err", text: "Network error publishing the report." });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading intake queue…</div>;
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

      {/* ── Awaiting verification ────────────────────────────────────── */}
      <div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>
          📥 Awaiting verification ({handovers.length})
        </h3>

        {handovers.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
            No handovers waiting. Batches submitted by phlebotomists land here.
          </div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          {handovers.map((h) => {
            const hv = verdicts[h.id] || {};
            const rejectCount = (h.samples || []).filter((s: any) => hv[s.id] === "reject").length;
            return (
              <div key={h.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>
                      {h.phlebotomist?.full_name || "Phlebotomist"}
                      <span style={{ fontWeight: 500, color: "#64748b" }}>
                        {h.phlebotomist?.mobile ? ` • ${h.phlebotomist.mobile}` : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                      {h.sample_count} tube{h.sample_count === 1 ? "" : "s"} • submitted{" "}
                      {new Date(h.requested_at).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <span
                    style={{
                      background: "#fef3c7",
                      color: "#92400e",
                      padding: "4px 12px",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      height: "fit-content",
                    }}
                  >
                    Pending
                  </span>
                </div>

                <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                  {(h.samples || []).map((s: any) => {
                    const v = hv[s.id] || "accept";
                    const rejecting = v === "reject";
                    return (
                      <div
                        key={s.id}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          background: rejecting ? "#fef2f2" : "#f8fafc",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#0f172a" }}>
                              {s.barcode}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                              {s.sample_type}
                              {s.container_type ? ` • ${s.container_type}` : ""}
                              {s.test_names?.length ? ` • ${s.test_names.join(", ")}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => setVerdict(h.id, s.id, "accept")}
                              style={{
                                ...verdictBtn,
                                background: !rejecting ? "#16a34a" : "#fff",
                                color: !rejecting ? "#fff" : "#16a34a",
                                borderColor: "#16a34a",
                              }}
                            >
                              ✓ Accept
                            </button>
                            <button
                              onClick={() => setVerdict(h.id, s.id, "reject")}
                              style={{
                                ...verdictBtn,
                                background: rejecting ? "#dc2626" : "#fff",
                                color: rejecting ? "#fff" : "#dc2626",
                                borderColor: "#dc2626",
                              }}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </div>

                        {rejecting && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                              {COMMON_REJECTIONS.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => setReason(h.id, s.id, r)}
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    border: "1px solid #fca5a5",
                                    background:
                                      (reasons[h.id] || {})[s.id] === r ? "#dc2626" : "#fff",
                                    color: (reasons[h.id] || {})[s.id] === r ? "#fff" : "#991b1b",
                                    fontSize: "0.72rem",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                  }}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                            <input
                              value={(reasons[h.id] || {})[s.id] || ""}
                              onChange={(e) => setReason(h.id, s.id, e.target.value)}
                              placeholder="Reason recorded against this tube"
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 6,
                                border: "1px solid #fca5a5",
                                fontSize: "0.83rem",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                    {(h.samples?.length || 0) - rejectCount} accepting
                    {rejectCount > 0 ? `, ${rejectCount} rejecting` : ""}
                  </span>
                  <button
                    onClick={() => submitVerdicts(h)}
                    disabled={busy === h.id}
                    className="btn btn-primary"
                    style={{ opacity: busy === h.id ? 0.6 : 1 }}
                  >
                    {busy === h.id ? "Recording…" : "Confirm receipt"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── In the building, awaiting a report ───────────────────────── */}
      <div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>
          🔬 In processing ({received.length})
        </h3>

        {received.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
            No tubes awaiting a report.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {received.map((s) => (
              <div key={s.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{s.barcode}</div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      {s.test_names?.length ? s.test_names.join(", ") : s.sample_type}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <input
                    value={reportUrls[s.id] || ""}
                    onChange={(e) => setReportUrls((p) => ({ ...p, [s.id]: e.target.value }))}
                    placeholder="Report URL (PDF)"
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
                    onClick={() => publishReport(s.id)}
                    disabled={busy === s.id || !(reportUrls[s.id] || "").trim()}
                    className="btn btn-primary"
                    style={{
                      opacity: busy === s.id || !(reportUrls[s.id] || "").trim() ? 0.6 : 1,
                    }}
                  >
                    {busy === s.id ? "Publishing…" : "Publish report"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const verdictBtn: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1.5px solid",
  fontWeight: 700,
  fontSize: "0.78rem",
  cursor: "pointer",
  height: "fit-content",
};
