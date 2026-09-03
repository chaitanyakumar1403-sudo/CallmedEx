"use client";

/**
 * PCIntakePanel — Scan & Intake Verification Screen
 *
 * Barcode scanner UI for lab tech to execute the 5-point quality check:
 *   tube_received, barcode_match, tube_type_correct, label_present, quality_acceptable
 *
 * Rejection modal with standard codes (broken_tube, hemolyzed, etc.).
 */

import { useCallback, useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";
import { Icon } from "@/components/ui";
import {
  ScanLine, ShieldCheck, Camera, Ban, CheckCircle2, XCircle, RefreshCw,
  AlertTriangle, Droplets, TrendingDown, Tag, FileText
} from "@/components/ui/icons";
import { pcAPI } from "@/lib/api";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

const REJECTION_CODES = [
  { code: "broken_tube", label: "Broken tube", icon: AlertTriangle },
  { code: "hemolyzed", label: "Hemolyzed", icon: Droplets },
  { code: "leaking_tube", label: "Leaking tube", icon: Droplets },
  { code: "insufficient_sample", label: "Insufficient sample", icon: TrendingDown },
  { code: "wrong_tube", label: "Wrong tube type", icon: RefreshCw },
  { code: "barcode_missing", label: "Barcode missing", icon: XCircle },
  { code: "label_missing", label: "Label missing", icon: Tag },
  { code: "other", label: "Other", icon: FileText },
];

const TUBE_COLOURS: Record<string, string> = {
  lavender: "#9b59b6", gold: "#f39c12", blue: "#3498db",
  grey: "#95a5a6", red: "#e74c3c", green: "#2ecc71", yellow: "#f1c40f",
};

function capToHex(cap: string): string {
  return TUBE_COLOURS[(cap || "").toLowerCase().trim()] || "#64748b";
}

type CheckKey = "tube_received" | "barcode_match" | "tube_type_correct" | "label_present" | "quality_acceptable";

const CHECK_LABELS: { key: CheckKey; label: string; desc: string }[] = [
  { key: "tube_received", label: "Tube Received", desc: "Physical tube is present in the batch" },
  { key: "barcode_match", label: "Barcode Match", desc: "Scanned barcode matches the label on the tube" },
  { key: "tube_type_correct", label: "Tube Type Correct", desc: "Tube colour/type matches the expected type" },
  { key: "label_present", label: "Label Present", desc: "Patient label is present and readable" },
  { key: "quality_acceptable", label: "Sample Quality", desc: "No hemolysis, clotting, or contamination" },
];

export default function PCIntakePanel() {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Scan
  const [scanInput, setScanInput] = useState("");
  const [scannedSample, setScannedSample] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [serverVerified, setServerVerified] = useState(false);

  // 5-point check
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    tube_received: false, barcode_match: false, tube_type_correct: false,
    label_present: false, quality_acceptable: false,
  });

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectCode, setRejectCode] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectSampleId, setRejectSampleId] = useState("");

  // View filter
  const [filter, setFilter] = useState<"received" | "verified" | "rejected">("received");

  const load = useCallback(async () => {
    try {
      const data = await pcAPI.getSamples(filter);
      setSamples(data.samples || []);
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to load samples" });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function resetScan() {
    setScanInput("");
    setScannedSample(null);
    setServerVerified(false);
    setChecks({
      tube_received: false, barcode_match: false, tube_type_correct: false,
      label_present: false, quality_acceptable: false,
    });
  }

  async function handleScanWithCode(code: string) {
    setBusy(true);
    setMsg(null);
    setServerVerified(false);
    try {
      // First try server-side by-barcode lookup
      const sample = await pcAPI.getSampleByBarcode(code);
      setScannedSample(sample);
      setServerVerified(true);
      setChecks(prev => ({ ...prev, tube_received: true, barcode_match: true }));
    } catch (_serverErr: any) {
      // Server 404 — fall back to client-side match against received list
      try {
        const allData = await pcAPI.getSamples("received");
        const found = (allData.samples || []).find(
          (s: any) => (s.barcode || "").toUpperCase() === code.trim().toUpperCase()
        );
        if (!found) {
          setMsg({
            kind: "err",
            text: `No sample found with barcode "${code}" at this centre.`,
          });
          return;
        }
        setScannedSample(found);
        setChecks(prev => ({ ...prev, tube_received: true }));
      } catch (e: any) {
        setMsg({ kind: "err", text: e.message || "Scan failed" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleScan() {
    if (!scanInput.trim()) return;
    await handleScanWithCode(scanInput.trim());
  }

  async function handleCameraScan(code: string) {
    setScanInput(code);
    await handleScanWithCode(code);
  }

  async function submitVerification() {
    if (!scannedSample) return;
    setBusy(true);
    setMsg(null);
    try {
      await pcAPI.verifySample(scannedSample.id, checks);
      setMsg({ kind: "ok", text: `Sample ${scannedSample.barcode} verified ✓` });
      resetScan();
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Verification failed" });
    } finally {
      setBusy(false);
    }
  }

  function openRejectModal(sampleId: string) {
    setRejectSampleId(sampleId);
    setRejectCode("");
    setRejectNotes("");
    setShowRejectModal(true);
  }

  async function submitRejection() {
    if (!rejectSampleId || !rejectCode) return;
    setBusy(true);
    setMsg(null);
    try {
      await pcAPI.rejectSample(rejectSampleId, rejectCode, rejectNotes);
      setMsg({ kind: "ok", text: "Sample rejected." });
      setShowRejectModal(false);
      resetScan();
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Rejection failed" });
    } finally {
      setBusy(false);
    }
  }

  const allChecked = Object.values(checks).every(Boolean);

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

      {/* ── Barcode scanner ──────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", color: "#0f172a" }}>
          <Icon as={ScanLine} size={16} /> Scan & Verify Sample
        </h3>
        <p style={{ margin: "0 0 14px 0", fontSize: "0.85rem", color: "#64748b" }}>
          Scan or type a barcode to begin the 5-point quality check.
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }}
            placeholder="Scan barcode here…"
            autoFocus
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10,
              border: "2px solid #1a2b4a", fontSize: "1rem",
              fontFamily: "monospace", fontWeight: 700,
            }}
          />
          <Button variant="primary" onClick={handleScan} disabled={busy || !scanInput.trim()}>
            {busy ? "Scanning…" : "Scan"}
          </Button>
          <Button variant="secondary" onClick={() => setShowScanner(true)} disabled={busy}>
            <Icon as={Camera} size={14} /> Camera
          </Button>
          {scannedSample && (
            <Button variant="secondary" onClick={resetScan}>
              <Icon as={RefreshCw} size={14} /> Clear
            </Button>
          )}
        </div>

        <BarcodeScannerModal
          open={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleCameraScan}
          title="Scan tube barcode"
        />
      </div>

      {/* ── 5-point checklist ────────────────────────────────────── */}
      {scannedSample && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", gap: 16, flexWrap: "wrap",
            marginBottom: 16,
          }}>
            <div>
              <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "1.2rem", color: "#0f172a" }}>
                {scannedSample.barcode}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: 4 }}>
                {scannedSample.subject_name && <span>{scannedSample.subject_name} • </span>}
                {scannedSample.expected_tube_name}
              </div>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 999,
              background: "#f1f5f9", border: "1px solid #e2e8f0",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: capToHex(scannedSample.expected_cap_colour),
                border: "2px solid #fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              }} />
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                Expected: {scannedSample.expected_tube_name}
              </span>
            </div>
          </div>

          <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "#0f172a" }}>
            <Icon as={ShieldCheck} size={16} /> 5-Point Quality Check
          </h4>

          <div style={{ display: "grid", gap: 8 }}>
            {CHECK_LABELS.map(({ key, label, desc }) => (
              <label
                key={key}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderRadius: 10,
                  border: `1.5px solid ${checks[key] ? "#16a34a" : "#e2e8f0"}`,
                  background: checks[key] ? "#f0fdf4" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={checks[key]}
                  onChange={(e) => setChecks(prev => ({ ...prev, [key]: e.target.checked }))}
                  style={{
                    width: 20, height: 20, accentColor: "#16a34a",
                    cursor: "pointer",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: checks[key] ? "#166534" : "#0f172a" }}>
                    {checks[key] ? "✓ " : ""}{label}
                    {key === "barcode_match" && serverVerified && (
                      <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#16a34a", marginLeft: 6 }}>
                        Verified by scan ✓
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div style={{
            display: "flex", gap: 10, marginTop: 16,
            justifyContent: "flex-end",
          }}>
            <Button
              variant="secondary"
              onClick={() => openRejectModal(scannedSample.id)}
              disabled={busy}
            >
              <Icon as={Ban} size={14} /> Reject
            </Button>
            <Button
              variant="primary"
              onClick={submitVerification}
              disabled={busy || !allChecked}
            >
              <Icon as={ShieldCheck} size={14} /> {busy ? "Verifying…" : "Verify Sample"}
            </Button>
          </div>

          {!allChecked && (
            <div style={{
              fontSize: "0.82rem", color: "#f59e0b", marginTop: 8,
              textAlign: "right",
            }}>
              Complete all 5 checks to verify, or reject with a reason.
            </div>
          )}
        </div>
      )}

      {/* ── Sample list ──────────────────────────────────────────── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10,
        }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#0f172a" }}>
            Samples ({samples.length})
          </h3>
          <div style={{ display: "flex", gap: 6 }}>
            {(["received", "verified", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setLoading(true); }}
                style={{
                  padding: "5px 14px", borderRadius: 999,
                  border: "1px solid #e2e8f0", fontSize: "0.78rem",
                  fontWeight: 700, cursor: "pointer",
                  background: filter === f ? "#1a2b4a" : "#fff",
                  color: filter === f ? "#fff" : "#475569",
                  transition: "all 0.15s",
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
            Loading…
          </div>
        ) : samples.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
            No {filter} samples.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {samples.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "10px 14px",
                  borderRadius: 8, background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: capToHex(s.expected_cap_colour),
                    border: "1px solid #fff",
                    boxShadow: "0 0 2px rgba(0,0,0,0.15)",
                  }} />
                  <div>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem" }}>
                      {s.barcode || "No barcode"}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "#64748b", marginLeft: 8 }}>
                      {s.expected_tube_name}
                      {s.subject_name ? ` • ${s.subject_name}` : ""}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {s.rejection_code && (
                    <span style={{ fontSize: "0.75rem", color: "#991b1b" }}>
                      {s.rejection_code.replace(/_/g, " ")}
                    </span>
                  )}
                  <span style={{
                    padding: "3px 10px", borderRadius: 999,
                    fontSize: "0.72rem", fontWeight: 700,
                    background: s.status === "verified" ? "#dcfce7"
                      : s.status === "rejected" ? "#fee2e2" : "#fef3c7",
                    color: s.status === "verified" ? "#166534"
                      : s.status === "rejected" ? "#991b1b" : "#92400e",
                  }}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Rejection modal ──────────────────────────────────────── */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Sample"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitRejection}
              disabled={!rejectCode || busy}
            >
              {busy ? "Rejecting…" : "Confirm Rejection"}
            </Button>
          </div>
        }
      >
        <p style={{ margin: "0 0 14px 0", fontSize: "0.9rem", color: "#475569" }}>
          Select a rejection reason:
        </p>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          {REJECTION_CODES.map((r) => {
            const IconComp = r.icon;
            return (
              <button
                key={r.code}
                onClick={() => setRejectCode(r.code)}
                style={{
                  padding: "10px 14px", borderRadius: 10,
                  border: `1.5px solid ${rejectCode === r.code ? "#dc2626" : "#e2e8f0"}`,
                  background: rejectCode === r.code ? "#fef2f2" : "#fff",
                  color: rejectCode === r.code ? "#991b1b" : "#475569",
                  fontWeight: 600, fontSize: "0.85rem",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconComp size={16} />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
        <textarea
          value={rejectNotes}
          onChange={(e) => setRejectNotes(e.target.value)}
          placeholder="Additional notes (optional)"
          rows={2}
          style={{
            width: "100%", marginTop: 14, padding: "10px 12px",
            borderRadius: 8, border: "1px solid #cbd5e1",
            fontSize: "0.85rem", resize: "vertical",
          }}
        />
      </Modal>
    </div>
  );
}
