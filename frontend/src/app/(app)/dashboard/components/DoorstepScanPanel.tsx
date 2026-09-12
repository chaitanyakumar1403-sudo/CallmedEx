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
import { Modal, Button } from "@/components/ui";
import { Icon } from "@/components/ui";
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Plus,
  TestTube,
  XCircle,
  Camera,
  ShieldCheck,
  Package,
  Search,
  Check,
  Sparkles,
} from "@/components/ui/icons";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { phleboAPI } from "@/lib/api";

const TUBE_COLOURS: Record<string, { bg: string; glow: string; name: string }> = {
  lavender: { bg: "#9b59b6", glow: "rgba(155, 89, 182, 0.4)", name: "Lavender" },
  gold: { bg: "#f39c12", glow: "rgba(243, 156, 18, 0.4)", name: "Gold / SST" },
  blue: { bg: "#3498db", glow: "rgba(52, 152, 219, 0.4)", name: "Light Blue" },
  grey: { bg: "#95a5a6", glow: "rgba(149, 165, 166, 0.4)", name: "Grey" },
  red: { bg: "#e74c3c", glow: "rgba(231, 76, 60, 0.4)", name: "Plain Red" },
  green: { bg: "#2ecc71", glow: "rgba(46, 204, 113, 0.4)", name: "Green" },
  yellow: { bg: "#f1c40f", glow: "rgba(241, 196, 15, 0.4)", name: "Yellow" },
};

function getCapMeta(cap: string) {
  const key = (cap || "").toLowerCase().trim();
  return TUBE_COLOURS[key] || { bg: "#64748b", glow: "rgba(100, 116, 139, 0.3)", name: cap || "Standard" };
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
  const [collectionStatus, setCollectionStatus] = useState<Record<string, boolean>>({});

  // Barcode scanner modal state
  const [barcodeScanSampleId, setBarcodeScanSampleId] = useState<string | null>(null);

  // Add-on modal
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogPackages, setCatalogPackages] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Mismatch modal
  const [mismatchSample, setMismatchSample] = useState<any>(null);
  const [mismatchResult, setMismatchResult] = useState<any>(null);

  // Barcode-to-patient safety check (verify-barcode)
  const [barcodeCheckBusy, setBarcodeCheckBusy] = useState(false);

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
        setScannedBarcodes(prev => ({ ...prev, [sample.id]: barcode }));
      }

      if (!result.match) {
        setMismatchSample(sample);
        setMismatchResult(result);
      } else {
        const label = result.barcode_bound
          ? `✓ ${barcode} — verified and matches requested test tube.`
          : `✓ ${sample.barcode || "Tube"} — cap color and specimen match.`;
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

  async function confirmCollection(sample: any) {
    const barcode = scannedBarcodes[sample.id] || sample.barcode;
    if (!barcode) {
      setMsg({ kind: "err", text: "No barcode available to confirm collection." });
      return;
    }
    setBusy(sample.id);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (e) {
          console.warn("GPS capture failed", e);
        }
      }

      await phleboAPI.confirmCollection({
        sample_id: sample.id,
        barcode,
        lat,
        lng,
        device_model: navigator.userAgent,
        os_version: navigator.platform,
        app_version: process.env.NEXT_PUBLIC_APP_VERSION || "web",
      });

      setCollectionStatus(prev => ({ ...prev, [sample.id]: true }));
      setMsg({ kind: "ok", text: `✓ Collection confirmed and locked for ${barcode}. GPS coordinates stamped.` });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to confirm collection." });
    } finally {
      setBusy(null);
    }
  }

  async function openAddonModal() {
    setShowAddonModal(true);
    setCatalogLoading(true);
    try {
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API}/api/phlebo/doorstep-catalog`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCatalog(data.services || []);
      setCatalogPackages(data.packages || []);
    } catch {
      setCatalog([]);
      setCatalogPackages([]);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function addTest(serviceId: string) {
    setBusy("addon");
    setMsg(null);
    try {
      const result = await phleboAPI.addDoorstepTest(bookingId, serviceId);
      setMsg({ kind: "ok", text: result.message || "Doorstep test added to booking." });
      setShowAddonModal(false);
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed to add test" });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading specimen validation bay…</div>;
  }

  const filteredCatalog = catalog.filter(s =>
    !catalogSearch || (s.name || "").toLowerCase().includes(catalogSearch.toLowerCase())
    || (s.code || "").toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const filteredPackages = catalogPackages.filter(p =>
    !catalogSearch || (p.name || "").toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {msg && (
        <div style={{
          padding: "14px 18px", borderRadius: 12, fontWeight: 600,
          background: msg.kind === "ok" ? "#dcfce7" : "#fee2e2",
          color: msg.kind === "ok" ? "#166534" : "#991b1b",
          border: `1px solid ${msg.kind === "ok" ? "#86efac" : "#fca5a5"}`,
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}>
          <Icon as={msg.kind === "ok" ? CheckCircle2 : AlertTriangle} size={20} />
          <span>{msg.text}</span>
        </div>
      )}

      {/* ── Console Header ───────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 12,
        padding: "16px 20px", background: "#ffffff",
        borderRadius: 16, border: "1px solid #e2e8f0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon as={ScanLine} size={20} /> Doorstep Specimen Verification
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
            Booking ID: <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0284c7" }}>#{bookingId.slice(0, 12)}</span> • {samples.length} Tube(s) Required
          </p>
        </div>
        <Button variant="secondary" onClick={openAddonModal}>
          <Icon as={Plus} size={16} /> Add Extra Test at Doorstep
        </Button>
      </div>

      {/* ── Tube list ────────────────────────────────────────────── */}
      {samples.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "#64748b", borderRadius: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", color: "#64748b" }}>
            <Icon as={TestTube} size={24} />
          </div>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>No specimen tubes specified for this booking</div>
          <div style={{ fontSize: "0.85rem", marginTop: 4 }}>Add tests at doorstep using the button above if required.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {samples.map((s) => {
            const result = scanResults[s.id];
            const scanned = result?.match || result?.acknowledged;
            const mismatch = result && !result.match && !result.acknowledged;
            const isCollected = collectionStatus[s.id] || s.status === 'collected';
            const cap = getCapMeta(s.expected_cap_colour);

            return (
              <div
                key={s.id}
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 16,
                  border: isCollected
                    ? "1.5px solid #86efac"
                    : scanned
                    ? "1.5px solid #7dd3fc"
                    : mismatch
                    ? "1.5px solid #fca5a5"
                    : "1px solid #e2e8f0",
                  background: isCollected
                    ? "#f0fdf4"
                    : scanned
                    ? "#f0f9ff"
                    : mismatch
                    ? "#fef2f2"
                    : "#ffffff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", gap: 12, flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: cap.bg,
                        border: "2.5px solid #fff",
                        boxShadow: `0 2px 8px ${cap.glow}`,
                      }} />
                      <span style={{ fontWeight: 800, fontSize: "1.02rem", color: "#0f172a" }}>
                        {s.expected_tube_name || s.expected_tube_type_code}
                      </span>
                      {s.expected_cap_colour && (
                        <span style={{
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: "#f1f5f9",
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}>
                          {cap.name}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: "0.84rem", color: "#475569", marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      {s.barcode && (
                        <span style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          background: "#e2e8f0",
                          padding: "2px 8px",
                          borderRadius: 4,
                          color: "#1e293b",
                        }}>
                          {s.barcode}
                        </span>
                      )}
                      {s.subject_name && (
                        <span style={{ fontWeight: 600, color: "#334155" }}>
                          Patient: {s.subject_name}
                        </span>
                      )}
                    </div>

                    {(s.test_names || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {s.test_names.map((test: string) => (
                          <span
                            key={test}
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              padding: "2px 8px",
                              borderRadius: 6,
                              color: "#334155",
                            }}
                          >
                            {test}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {isCollected ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "#dcfce7", color: "#166534",
                      padding: "6px 14px", borderRadius: 9999,
                      fontWeight: 800, fontSize: "0.82rem",
                      boxShadow: "0 2px 6px rgba(22, 101, 52, 0.15)",
                    }}>
                      <Icon as={ShieldCheck} size={16} /> Collected &amp; Locked ✓
                    </span>
                  ) : scanned ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: result?.acknowledged ? "#fef3c7" : "#e0f2fe",
                      color: result?.acknowledged ? "#92400e" : "#0369a1",
                      padding: "6px 14px", borderRadius: 9999,
                      fontWeight: 800, fontSize: "0.82rem",
                    }}>
                      <Icon as={result?.acknowledged ? AlertTriangle : CheckCircle2} size={16} />
                      {result?.acknowledged ? "Acknowledged" : "Cap Verified ✓"}
                    </span>
                  ) : mismatch ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "#fee2e2", color: "#991b1b",
                      padding: "6px 14px", borderRadius: 9999,
                      fontWeight: 800, fontSize: "0.82rem",
                    }}>
                      <Icon as={XCircle} size={16} /> Cap Mismatch
                    </span>
                  ) : (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "#f1f5f9", color: "#64748b",
                      padding: "6px 14px", borderRadius: 9999,
                      fontWeight: 700, fontSize: "0.82rem",
                    }}>
                      Awaiting Scan
                    </span>
                  )}
                </div>

                {/* Scan input */}
                {!scanned && !isCollected && (
                  <div style={{
                    display: "flex", gap: 10, marginTop: 14, alignItems: "center",
                  }}>
                    <input
                      value={scanInputs[s.id] || ""}
                      onChange={(e) => setScanInputs(prev => ({
                        ...prev, [s.id]: e.target.value,
                      }))}
                      onKeyDown={(e) => { if (e.key === "Enter") scanTube(s); }}
                      placeholder="Scan or type tube barcode sticker…"
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 10,
                        border: "1.5px solid #cbd5e1", fontFamily: "monospace",
                        fontSize: "0.9rem", outline: "none", background: "#fff",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setBarcodeScanSampleId(s.id)}
                      disabled={barcodeCheckBusy}
                      title="Scan barcode sticker with camera"
                      style={{
                        padding: "10px 14px", borderRadius: 10,
                        border: "1.5px solid #cbd5e1", background: "#ffffff",
                        cursor: barcodeCheckBusy ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                        fontWeight: 600, color: "#334155",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Icon as={Camera} size={16} />
                      <span style={{ fontSize: "0.82rem" }}>Camera</span>
                    </button>
                    <Button
                      variant="primary"
                      onClick={() => scanTube(s)}
                      disabled={busy === s.id || !(scanInputs[s.id] || "").trim()}
                    >
                      {busy === s.id ? "Verifying…" : "Verify Tube"}
                    </Button>
                  </div>
                )}

                {/* Bound barcode display */}
                {scanned && scannedBarcodes[s.id] && (
                  <div style={{
                    marginTop: 10, display: "flex", alignItems: "center", gap: 8,
                    fontSize: "0.84rem", color: "#166534", fontWeight: 700,
                  }}>
                    <Icon as={CheckCircle2} size={16} />
                    <span>Barcode Assigned:</span>
                    <span style={{ fontFamily: "monospace", background: "#dcfce7", padding: "2px 8px", borderRadius: 4 }}>
                      {scannedBarcodes[s.id]}
                    </span>
                  </div>
                )}
                
                {/* Confirm Collection Button */}
                {scanned && !isCollected && (
                  <div style={{ marginTop: 14 }}>
                    <Button
                      variant="primary"
                      onClick={() => confirmCollection(s)}
                      disabled={busy === s.id}
                      className="w-full"
                    >
                      <Icon as={ShieldCheck} size={16} />
                      {busy === s.id ? "Recording GPS & Lock…" : "Confirm Doorstep Draw & Geotag"}
                    </Button>
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
        title="Tube Cap Color Mismatch"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button
              variant="secondary"
              onClick={() => { setMismatchSample(null); setMismatchResult(null); }}
            >
              Re-scan with Correct Tube
            </Button>
            <Button
              variant="primary"
              onClick={ackMismatch}
              disabled={busy === mismatchSample?.id}
            >
              {busy === mismatchSample?.id ? "Processing…" : "Acknowledge & Proceed"}
            </Button>
          </div>
        }
      >
        {mismatchResult && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{
              padding: 16, borderRadius: 12,
              background: "#fef2f2", border: "1px solid #fca5a5",
              color: "#991b1b", fontWeight: 600, fontSize: "0.95rem",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <Icon as={AlertTriangle} size={20} />
              <div>{mismatchResult.warning}</div>
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
            }}>
              <div style={{
                padding: 16, borderRadius: 12,
                background: "#f0fdf4", border: "1px solid #86efac",
                textAlign: "center",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", margin: "0 auto 8px",
                  background: getCapMeta(mismatchResult.expected_colour).bg,
                  border: "3px solid #fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }} />
                <div style={{ fontWeight: 800, color: "#166534", fontSize: "0.88rem" }}>EXPECTED</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                  {mismatchResult.expected_name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#166534", textTransform: "capitalize", marginTop: 2 }}>
                  {mismatchResult.expected_colour} cap
                </div>
              </div>

              <div style={{
                padding: 16, borderRadius: 12,
                background: "#fef2f2", border: "1px solid #fca5a5",
                textAlign: "center",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", margin: "0 auto 8px",
                  background: getCapMeta(mismatchResult.scanned_colour).bg,
                  border: "3px solid #fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }} />
                <div style={{ fontWeight: 800, color: "#991b1b", fontSize: "0.88rem" }}>SCANNED</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                  {mismatchResult.scanned_name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#991b1b", textTransform: "capitalize", marginTop: 2 }}>
                  {mismatchResult.scanned_colour} cap
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
        title="Add Diagnostic Test at Doorstep"
      >
        <div style={{ position: "relative", marginBottom: 14 }}>
          <input
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Search tests or health packages…"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1.5px solid #cbd5e1", fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>

        {catalogLoading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Loading test catalog…</div>
        ) : filteredCatalog.length === 0 && filteredPackages.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>No matching tests found.</div>
        ) : (
          <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto", paddingRight: 4 }}>
            {/* Health Packages */}
            {filteredPackages.length > 0 && (
              <>
                <div style={{ fontWeight: 800, color: "#6b21a8", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.05em", padding: "6px 0 2px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon as={Package} size={14} /> Comprehensive Packages
                </div>
                {filteredPackages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => addTest(pkg.id)}
                    disabled={busy === "addon"}
                    style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "14px 16px",
                      borderRadius: 12, border: "1px solid #e9d5ff",
                      background: "#faf5ff", cursor: "pointer",
                      textAlign: "left", width: "100%",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.92rem" }}>
                        {pkg.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#7c3aed", marginTop: 3 }}>
                        {(pkg.tests_included || []).join(" • ")}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 4 }}>
                        {pkg.mrp ? <span style={{ textDecoration: "line-through", marginRight: 8 }}>₹{pkg.mrp}</span> : null}
                        <span style={{ fontWeight: 800, color: "#059669", fontSize: "0.95rem" }}>₹{pkg.price || 0}</span>
                      </div>
                    </div>
                    <span style={{ background: "#ede9fe", color: "#7c3aed", padding: "6px 12px", borderRadius: 8, fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon as={Plus} size={14} /> Add
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Individual Tests */}
            {filteredCatalog.length > 0 && (
              <div style={{ fontWeight: 800, color: "#0369a1", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 0 2px", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon as={TestTube} size={14} /> Individual Pathology Tests
              </div>
            )}
            {filteredCatalog.map(svc => (
              <button
                key={svc.id}
                onClick={() => addTest(svc.id)}
                disabled={busy === "addon"}
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "12px 16px",
                  borderRadius: 12, border: "1px solid #e2e8f0",
                  background: "#ffffff", cursor: "pointer",
                  textAlign: "left", width: "100%",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>
                    {svc.name}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                    Code: {svc.code} • <span style={{ fontWeight: 700, color: "#059669" }}>₹{svc.price || svc.base_price || 0}</span>
                  </div>
                </div>
                <span style={{ background: "#f1f5f9", color: "#334155", padding: "6px 12px", borderRadius: 8, fontWeight: 700, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon as={Plus} size={14} /> Add
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Barcode scanner modal ──────────────────────────────── */}
      <BarcodeScannerModal
        open={!!barcodeScanSampleId}
        onClose={() => setBarcodeScanSampleId(null)}
        onScan={async (code) => {
          const sampleId = barcodeScanSampleId;
          setBarcodeScanSampleId(null);
          const sample = samples.find(s => s.id === sampleId);
          if (!sample) return;

          setBarcodeCheckBusy(true);
          setMsg(null);
          try {
            const check = await phleboAPI.verifyBarcode({
              barcode: code,
              sample_id: sample.id,
              booking_id: bookingId,
            });
            if (!check.valid) {
              setMsg({
                kind: "err",
                text: check.message || "This barcode failed the patient-safety check.",
              });
              return;
            }
            setScannedBarcodes(prev => ({ ...prev, [sample.id]: code }));
            await scanTube(sample, code);
          } catch (e: any) {
            setMsg({ kind: "err", text: e.message || "Barcode verification failed." });
          } finally {
            setBarcodeCheckBusy(false);
          }
        }}
        title="Scan Tube Barcode Sticker"
      />
    </div>
  );
}
