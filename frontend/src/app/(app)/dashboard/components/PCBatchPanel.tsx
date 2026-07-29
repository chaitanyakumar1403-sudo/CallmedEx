"use client";

/**
 * PCBatchPanel — Batch Creation & Courier Manifest
 *
 * Groups verified samples into sealed batches for external reference lab pickup.
 * Batch lifecycle: open → sealed (immutable) → sent_to_lab (terminal).
 */

import { useCallback, useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";
import { Icon } from "@/components/ui";
import { Boxes, Plus, Truck, Package, CheckCircle2, FileText } from "@/components/ui/icons";
import { pcAPI } from "@/lib/api";

export default function PCBatchPanel() {
  const [batches, setBatches] = useState<any[]>([]);
  const [unbatched, setUnbatched] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Add to batch
  const [selectedSamples, setSelectedSamples] = useState<Record<string, boolean>>({});
  const [targetBatchId, setTargetBatchId] = useState("");

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendBatchId, setSendBatchId] = useState("");
  const [courierRef, setCourierRef] = useState("");

  // Upload result
  const [uploadSampleId, setUploadSampleId] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadedIds, setUploadedIds] = useState<Record<string, boolean>>({});

  // Seal confirm
  const [showSealConfirm, setShowSealConfirm] = useState(false);
  const [sealBatchId, setSealBatchId] = useState("");

  const load = useCallback(async () => {
    try {
      const [batchData, sampleData] = await Promise.all([
        pcAPI.listBatches(),
        pcAPI.getSamples("verified"),
      ]);
      setBatches(batchData.batches || []);
      // Verified samples not yet in a batch
      const inBatch = new Set<string>();
      for (const b of batchData.batches || []) {
        for (const s of b.samples || []) {
          inBatch.add(s.id);
        }
      }
      setUnbatched(
        (sampleData.samples || []).filter((s: any) => !s.batch_id && !inBatch.has(s.id))
      );
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to load batches" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createBatch() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await pcAPI.createBatch();
      setMsg({ kind: "ok", text: result.message || `Batch ${result.batch_code} created.` });
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to create batch" });
    } finally {
      setBusy(false);
    }
  }

  async function addSelectedToBatch() {
    if (!targetBatchId) return;
    const ids = Object.keys(selectedSamples).filter(k => selectedSamples[k]);
    if (ids.length === 0) return;

    setBusy(true);
    setMsg(null);
    let added = 0;
    for (const sampleId of ids) {
      try {
        await pcAPI.addToBatch(targetBatchId, sampleId);
        added++;
      } catch (e: any) {
        setMsg({ kind: "err", text: e.message || `Failed to add sample` });
      }
    }
    if (added > 0) {
      setMsg({ kind: "ok", text: `${added} sample(s) added to batch.` });
    }
    setSelectedSamples({});
    setBusy(false);
    await load();
  }

  async function sealBatch() {
    if (!sealBatchId) return;
    setBusy(true);
    setMsg(null);
    try {
      await pcAPI.sealBatch(sealBatchId);
      setMsg({ kind: "ok", text: "Batch sealed. It is now immutable." });
      setShowSealConfirm(false);
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to seal batch" });
    } finally {
      setBusy(false);
    }
  }

  async function sendBatch() {
    if (!sendBatchId) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await pcAPI.sendBatch(sendBatchId, courierRef);
      setMsg({ kind: "ok", text: result.message || "Batch sent to reference lab." });
      setShowSendModal(false);
      setCourierRef("");
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to send batch" });
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadResult() {
    if (!uploadSampleId || !uploadUrl.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await pcAPI.publishReport(uploadSampleId, uploadUrl.trim());
      setMsg({ kind: "ok", text: "Report sent to patient ✓" });
      setUploadedIds(prev => ({ ...prev, [uploadSampleId]: true }));
      setUploadSampleId("");
      setUploadUrl("");
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to upload report" });
    } finally {
      setBusy(false);
    }
  }

  const openBatches = batches.filter(b => b.status === "open");
  const sealedBatches = batches.filter(b => b.status === "sealed");
  const sentBatches = batches.filter(b => b.status === "sent_to_lab");
  const selectedIds = Object.keys(selectedSamples).filter(k => selectedSamples[k]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading batches…</div>;
  }

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

      {/* ── Unbatched verified samples ───────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10,
        }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
            <Icon as={CheckCircle2} size={16} /> Verified — Ready to Batch ({unbatched.length})
          </h3>
          <Button variant="primary" onClick={createBatch} disabled={busy}>
            <Icon as={Plus} size={14} /> New Batch
          </Button>
        </div>

        {unbatched.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0 }}>
            No verified samples waiting to be batched.
          </p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 6 }}>
              {unbatched.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: selectedSamples[s.id] ? "#f0f9ff" : "#f8fafc",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedSamples[s.id]}
                    onChange={(e) => setSelectedSamples(prev => ({
                      ...prev, [s.id]: e.target.checked,
                    }))}
                    style={{ cursor: "pointer" }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.88rem" }}>
                      {s.barcode || "—"}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "#64748b", marginLeft: 8 }}>
                      {s.expected_tube_name}
                      {s.subject_name ? ` • ${s.subject_name}` : ""}
                    </span>
                  </div>
                  {!s.report_url && !uploadedIds[s.id] && (
                    <button
                      onClick={() => {
                        setUploadSampleId(s.id);
                        setUploadUrl("");
                      }}
                      style={{
                        padding: "4px 12px", borderRadius: 6, border: "1px solid #16a34a",
                        background: "#f0fdf4", color: "#166534", fontSize: "0.75rem",
                        fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      <Icon as={FileText} size={14} /> Upload Result
                    </button>
                  )}
                  {uploadedIds[s.id] && (
                    <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 600 }}>
                      Report sent ✓
                    </span>
                  )}
                </div>
              ))}
            </div>

            {selectedIds.length > 0 && openBatches.length > 0 && (
              <div style={{
                display: "flex", gap: 10, marginTop: 14,
                alignItems: "center", flexWrap: "wrap",
              }}>
                <select
                  value={targetBatchId}
                  onChange={(e) => setTargetBatchId(e.target.value)}
                  style={{
                    flex: 1, minWidth: 200, padding: "10px 12px",
                    borderRadius: 8, border: "1px solid #cbd5e1",
                    fontSize: "0.88rem",
                  }}
                >
                  <option value="">— Select open batch —</option>
                  {openBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code} ({b.sample_count || 0} samples)
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  onClick={addSelectedToBatch}
                  disabled={!targetBatchId || busy}
                >
                  Add {selectedIds.length} to Batch
                </Button>
              </div>
            )}

            {selectedIds.length > 0 && openBatches.length === 0 && (
              <div style={{
                marginTop: 14, padding: "10px 14px", borderRadius: 8,
                background: "#fffbeb", border: "1px solid #fcd34d",
                color: "#92400e", fontSize: "0.85rem",
              }}>
                Create a new batch first, then add selected samples.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Open batches ─────────────────────────────────────────── */}
      {openBatches.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 14px 0", fontSize: "1.05rem" }}>
            <Icon as={Boxes} size={16} /> Open Batches
          </h3>
          <div style={{ display: "grid", gap: 12 }}>
            {openBatches.map(b => (
              <div
                key={b.id}
                style={{
                  padding: 16, borderRadius: 10,
                  border: "1px solid #e2e8f0", background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontFamily: "monospace", color: "#0f172a" }}>
                      {b.batch_code}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                      {b.actual_sample_count || b.sample_count || 0} sample(s)
                      {b.created_at ? ` • Created ${new Date(b.created_at).toLocaleString("en-IN")}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => { setSealBatchId(b.id); setShowSealConfirm(true); }}
                    disabled={busy || (b.actual_sample_count || b.sample_count || 0) === 0}
                  >
                    <Icon as={Package} size={14} /> Seal Batch
                  </Button>
                </div>
                {(b.samples || []).length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {b.samples.map((s: any) => (
                      <span
                        key={s.id}
                        style={{
                          padding: "3px 10px", borderRadius: 999,
                          background: "#f0f9ff", border: "1px solid #bfdbfe",
                          fontSize: "0.75rem", fontFamily: "monospace", fontWeight: 600,
                        }}
                      >
                        {s.barcode || "—"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sealed batches (ready to send) ────────────────────────── */}
      {sealedBatches.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 14px 0", fontSize: "1.05rem" }}>
            <Icon as={Package} size={16} /> Sealed — Ready for Pickup
          </h3>
          <div style={{ display: "grid", gap: 12 }}>
            {sealedBatches.map(b => (
              <div
                key={b.id}
                style={{
                  padding: 16, borderRadius: 10,
                  border: "1px solid #86efac", background: "#f0fdf4",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontFamily: "monospace", color: "#166534" }}>
                      {b.batch_code}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#166534", marginTop: 2 }}>
                      {b.actual_sample_count || b.sample_count || 0} sample(s)
                      {b.sealed_at ? ` • Sealed ${new Date(b.sealed_at).toLocaleString("en-IN")}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => { setSendBatchId(b.id); setShowSendModal(true); }}
                    disabled={busy}
                  >
                    <Icon as={Truck} size={14} /> Send to Lab
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sent batches (history) ────────────────────────────────── */}
      {sentBatches.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 14px 0", fontSize: "1.05rem", color: "#64748b" }}>
            <Icon as={Truck} size={16} /> Sent to Reference Lab
          </h3>
          <div style={{ display: "grid", gap: 6 }}>
            {sentBatches.slice(0, 10).map(b => (
              <div
                key={b.id}
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "10px 14px",
                  borderRadius: 8, background: "#f8fafc",
                }}
              >
                <div>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.88rem" }}>
                    {b.batch_code}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#64748b", marginLeft: 10 }}>
                    {b.actual_sample_count || b.sample_count || 0} samples
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  {b.sent_at ? new Date(b.sent_at).toLocaleString("en-IN") : ""}
                  {b.courier_reference ? ` • ${b.courier_reference}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Seal confirmation modal ──────────────────────────────── */}
      <Modal
        open={showSealConfirm}
        onClose={() => setShowSealConfirm(false)}
        title="Seal Batch?"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setShowSealConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={sealBatch} disabled={busy}>
              {busy ? "Sealing…" : "Seal Batch"}
            </Button>
          </div>
        }
      >
        <p style={{ color: "#475569" }}>
          Once sealed, no more samples can be added to this batch. This action cannot be undone.
        </p>
      </Modal>

      {/* ── Send to lab modal ────────────────────────────────────── */}
      <Modal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Send to Reference Lab"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setShowSendModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={sendBatch} disabled={busy}>
              {busy ? "Sending…" : "Confirm Send"}
            </Button>
          </div>
        }
      >
        <p style={{ color: "#475569", margin: "0 0 14px 0" }}>
          All samples in this batch will be marked as sent to the reference lab.
        </p>
        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
          Courier Reference (optional)
        </label>
        <input
          value={courierRef}
          onChange={(e) => setCourierRef(e.target.value)}
          placeholder="e.g. AWB number, courier name"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid #cbd5e1", fontSize: "0.9rem", marginTop: 4,
          }}
        />
      </Modal>

      {/* ── Upload result inline form ─────────────────────────────── */}
      {uploadSampleId && (
        <div className="card" style={{
          padding: 20, border: "1.5px solid #16a34a",
          background: "#f0fdf4",
        }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", color: "#166534" }}>
            <Icon as={FileText} size={16} /> Upload Report Result
          </h4>
          <p style={{ margin: "0 0 12px 0", fontSize: "0.82rem", color: "#475569" }}>
            Paste the report URL for this sample. The patient will be notified.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={uploadUrl}
              onChange={(e) => setUploadUrl(e.target.value)}
              placeholder="https://reports.example.com/CMX-…"
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 8,
                border: "1px solid #86efac", fontSize: "0.9rem",
              }}
            />
            <Button
              variant="primary"
              onClick={handleUploadResult}
              disabled={busy || !uploadUrl.trim()}
            >
              {busy ? "Uploading…" : "Publish Report"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setUploadSampleId("");
                setUploadUrl("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
