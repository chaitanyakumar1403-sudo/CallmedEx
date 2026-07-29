"use client";

/**
 * DoorstepScanPanel — Phlebotomist doorstep tube validation & add-on tests
 *
 * At the patient's door, the phlebo:
 *   1. Sees which tubes to draw for this booking
 *   2. Scans each tube barcode to validate type matches expected
 *   3. If mismatch → red warning with "Acknowledge & Proceed" or "Re-scan"
 *   4. Can add extra tests at the doorstep via the home services catalog
 */

import { useCallback, useEffect, useState } from "react";
import { Modal, Button, Banner } from "@/components/ui";
import { Icon } from "@/components/ui";
import {
  ScanLine, CheckCircle2, AlertTriangle, Plus, TestTube, XCircle, Camera,
} from "@/components/ui/icons";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { phleboAPI } from "@/lib/api";

const TUBE_COLOURS: Record<string, string> = {
  lavender: "#9b59b6", gold: "#f39c12", blue: "#3498db",
  grey: "#95a5a6", red: "#e74c3c", green: "#2ecc71", yellow: "#f1c40f",
};

function capToHex(cap: string): string {
  return TUBE_COLOURS[(cap || "").toLowerCase().trim()] || "#64748b";
}

export default function DoorstepScanPanel({ bookingId }: { bookingId: string }) {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Scan state per sample
  const [scanInputs, setScanInputs] = useState<Record<string, string>>({});
  const [scanResults, setScanResults] = useState<Record<string, any>>({});
  const [scannedBarcodes, setScannedBarcodes] = useState<Record<string, string>>({});

  // Barcode scanner modal state
  const [barcodeScanSampleId, setBarcodeScanSampleId] = useState<string | null>(null);

  // Add-on modal
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Mismatch modal
  const [mismatchSample, setMismatchSample] = useState<any>(null);
  const [mismatchResult, setMismatchResult] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const data = await phleboAPI.getBookingSamples(bookingId);
      setSamples(data.samples || []);
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to load tubes" });
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  async function scanTube(sample: any, barcodeOverride?: string) {
    const scannedCode = (scanInputs[sample.id] || "").trim();
    if (!scannedCode) return;

    setBusy(sample.id);
    setMsg(null);
    try {
      const barcode = barcodeOverride || scannedBarcodes[sample.id] || undefined;
      const result = await phleboAPI.scanTube(sample.id, scannedCode, barcode);
      setScanResults(prev => ({ ...prev, [sample.id]: result }));

      if (result.barcode_bound && barcode) {
        // Store the scanned barcode for display
        setScannedBarcodes(prev => ({ ...prev, [sample.id]: barcode }));
      }

      if (!result.match) {
        setMismatchSample(sample);
        setMismatchResult(result);
      } else {
        const label = result.barcode_bound
          ? `✓ ${result.barcode} — type matches.`
          : `✓ ${sample.barcode || "Tube"} — type matches.`;
        setMsg({ kind: "ok", text: label });
      }
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Scan failed" });
    } finally {
      setBusy(null);
    }
  }

  async function ackMismatch() {
    if (!mismatchSample) return;
    setBusy(mismatchSample.id);
    try {
      await phleboAPI.ackMismatch(mismatchSample.id);
      setScanResults(prev => ({
        ...prev,
        [mismatchSample.id]: { ...prev[mismatchSample.id], acknowledged: true },
      }));
      setMsg({ kind: "ok", text: "Mismatch acknowledged. Proceed with caution." });
      setMismatchSample(null);
      setMismatchResult(null);
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to acknowledge" });
    } finally {
      setBusy(null);
    }
  }

  async function openAddonModal() {
    setShowAddonModal(true);
    setCatalogLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/home-services", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCatalog(data.services || []);
    } catch {
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function addTest(serviceId: string) {
    setBusy("addon");
    setMsg(null);
    try {
      const result = await phleboAPI.addDoorstepTest(bookingId, serviceId);
      setMsg({ kind: "ok", text: result.message || "Test added." });
      setShowAddonModal(false);
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to add test" });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Loading tubes…</div>;
  }

  const filteredCatalog = catalog.filter(s =>
    !catalogSearch || (s.name || "").toLowerCase().includes(catalogSearch.toLowerCase())
    || (s.code || "").toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
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

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10,
      }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
          <Icon as={ScanLine} size={16} /> Doorstep Tube Verification
        </h3>
        <Button variant="secondary" onClick={openAddonModal}>
          <Icon as={Plus} size={14} /> Add Test
        </Button>
      </div>

      {/* ── Tube list ────────────────────────────────────────────── */}
      {samples.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
          No tubes for this booking.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {samples.map((s) => {
            const result = scanResults[s.id];
            const scanned = result?.match || result?.acknowledged;
            const mismatch = result && !result.match && !result.acknowledged;

            return (
              <div
                key={s.id}
                className="card"
                style={{
                  padding: 16,
                  borderLeft: `4px solid ${
                    scanned ? "#16a34a"
                    : mismatch ? "#dc2626"
                    : "#e2e8f0"
                  }`,
                }}
              >
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", gap: 12, flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: capToHex(s.expected_cap_colour),
                        border: "2px solid #fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      }} />
                      <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>
                        {s.expected_tube_name || s.expected_tube_type_code}
                      </span>
                      {s.expected_cap_colour && (
                        <span style={{
                          fontSize: "0.75rem", color: "#64748b",
                          textTransform: "capitalize",
                        }}>
                          ({s.expected_cap_colour} cap)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
                      {s.barcode && (
                        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                          {s.barcode}
                        </span>
                      )}
                      {s.subject_name && <span> • {s.subject_name}</span>}
                      {(s.test_names || []).length > 0 && (
                        <span> • {s.test_names.join(", ")}</span>
                      )}
                    </div>
                  </div>

                  {scanned ? (
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4,
                      color: result.acknowledged ? "#f59e0b" : "#16a34a",
                      fontWeight: 700, fontSize: "0.85rem",
                    }}>
                      <Icon as={result.acknowledged ? AlertTriangle : CheckCircle2} size={16} />
                      {result.acknowledged ? "Acknowledged" : "Verified"}
                    </span>
                  ) : mismatch ? (
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4,
                      color: "#dc2626", fontWeight: 700, fontSize: "0.85rem",
                    }}>
                      <Icon as={XCircle} size={16} /> Mismatch
                    </span>
                  ) : null}
                </div>

                {/* Scan input */}
                {!scanned && (
                  <div style={{
                    display: "flex", gap: 8, marginTop: 12, alignItems: "center",
                  }}>
                    <input
                      value={scanInputs[s.id] || ""}
                      onChange={(e) => setScanInputs(prev => ({
                        ...prev, [s.id]: e.target.value,
                      }))}
                      onKeyDown={(e) => { if (e.key === "Enter") scanTube(s); }}
                      placeholder="Scan tube type code…"
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 8,
                        border: "1.5px solid #cbd5e1", fontFamily: "monospace",
                        fontSize: "0.9rem",
                      }}
                    />
                    <button
                      onClick={() => setBarcodeScanSampleId(s.id)}
                      title="Scan barcode sticker"
                      style={{
                        padding: "10px 12px", borderRadius: 8,
                        border: "1px solid #cbd5e1", background: "#fff",
                        cursor: "pointer", display: "flex", alignItems: "center",
                        lineHeight: 1,
                      }}
                    >
                      <Icon as={Camera} size={16} />
                    </button>
                    <Button
                      variant="primary"
                      onClick={() => scanTube(s)}
                      disabled={busy === s.id || !(scanInputs[s.id] || "").trim()}
                    >
                      {busy === s.id ? "…" : "Scan"}
                    </Button>
                  </div>
                )}

                {/* Bound barcode display */}
                {scanned && scannedBarcodes[s.id] && (
                  <div style={{
                    marginTop: 8, display: "flex", alignItems: "center", gap: 6,
                    fontSize: "0.8rem", color: "#166534",
                  }}>
                    <Icon as={CheckCircle2} size={14} />
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                      {scannedBarcodes[s.id]}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Mismatch warning modal ───────────────────────────────── */}
      <Modal
        open={!!mismatchSample}
        onClose={() => { setMismatchSample(null); setMismatchResult(null); }}
        title="⚠️ Tube Type Mismatch"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button
              variant="secondary"
              onClick={() => { setMismatchSample(null); setMismatchResult(null); }}
            >
              Re-scan
            </Button>
            <Button
              variant="primary"
              onClick={ackMismatch}
              disabled={busy === mismatchSample?.id}
            >
              {busy === mismatchSample?.id ? "…" : "Acknowledge & Proceed"}
            </Button>
          </div>
        }
      >
        {mismatchResult && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{
              padding: 16, borderRadius: 10,
              background: "#fef2f2", border: "1px solid #fca5a5",
              color: "#991b1b", fontWeight: 600, fontSize: "0.95rem",
            }}>
              {mismatchResult.warning}
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
            }}>
              <div style={{
                padding: 16, borderRadius: 10,
                background: "#f0fdf4", border: "1px solid #86efac",
                textAlign: "center",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", margin: "0 auto 8px",
                  background: capToHex(mismatchResult.expected_colour),
                  border: "3px solid #fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }} />
                <div style={{ fontWeight: 700, color: "#166534" }}>Expected</div>
                <div style={{ fontSize: "0.9rem" }}>
                  {mismatchResult.expected_name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#166534" }}>
                  {mismatchResult.expected_colour}
                </div>
              </div>

              <div style={{
                padding: 16, borderRadius: 10,
                background: "#fef2f2", border: "1px solid #fca5a5",
                textAlign: "center",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", margin: "0 auto 8px",
                  background: capToHex(mismatchResult.scanned_colour),
                  border: "3px solid #fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }} />
                <div style={{ fontWeight: 700, color: "#991b1b" }}>Scanned</div>
                <div style={{ fontSize: "0.9rem" }}>
                  {mismatchResult.scanned_name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#991b1b" }}>
                  {mismatchResult.scanned_colour}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add test modal ───────────────────────────────────────── */}
      <Modal
        open={showAddonModal}
        onClose={() => setShowAddonModal(false)}
        title="Add Test at Doorstep"
      >
        <input
          value={catalogSearch}
          onChange={(e) => setCatalogSearch(e.target.value)}
          placeholder="Search tests…"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 8,
            border: "1px solid #cbd5e1", fontSize: "0.9rem",
            marginBottom: 14,
          }}
        />
        {catalogLoading ? (
          <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>Loading…</div>
        ) : filteredCatalog.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>No tests found.</div>
        ) : (
          <div style={{ display: "grid", gap: 6, maxHeight: 360, overflow: "auto" }}>
            {filteredCatalog.map(svc => (
              <button
                key={svc.id}
                onClick={() => addTest(svc.id)}
                disabled={busy === "addon"}
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "12px 14px",
                  borderRadius: 8, border: "1px solid #e2e8f0",
                  background: "#fff", cursor: "pointer",
                  textAlign: "left", width: "100%",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>
                    {svc.name}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    {svc.code} • ₹{svc.price || svc.base_price || 0}
                  </div>
                </div>
                <Icon as={Plus} size={16} />
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Barcode scanner modal ──────────────────────────────── */}
      <BarcodeScannerModal
        open={!!barcodeScanSampleId}
        onClose={() => setBarcodeScanSampleId(null)}
        onScan={(code) => {
          if (barcodeScanSampleId) {
            setScannedBarcodes(prev => ({ ...prev, [barcodeScanSampleId]: code }));
            // Find the sample and trigger scan with barcode
            const sample = samples.find(s => s.id === barcodeScanSampleId);
            if (sample) {
              scanTube(sample, code);
            }
          }
          setBarcodeScanSampleId(null);
        }}
        title="Scan tube barcode sticker"
      />
    </div>
  );
}
