"use client";

/**
 * Sample Collection Panel — phlebotomist
 *
 * Clinical-grade specimen collection, vacutainer labeling,
 * and cold-chain batch handover workflow.
 */

import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "../../../components/StatusSpine";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { Icon, Button } from "@/components/ui";
import {
  Building2,
  MapPin,
  TestTube,
  Package,
  Clock,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  QrCode,
  ShieldCheck,
  Check,
  Plus,
} from "@/components/ui/icons";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

const SAMPLE_TYPES = ["blood", "urine", "stool", "swab", "sputum", "other"];

const VACUTAINER_PRESETS = [
  {
    label: "EDTA Lavender",
    dotColor: "#9b59b6",
    container: "EDTA purple-top",
    sample: "blood",
    tests: "CBC, HbA1c, ESR",
  },
  {
    label: "SST Gold / Serum",
    dotColor: "#f59e0b",
    container: "SST gold-top gel",
    sample: "blood",
    tests: "LFT, KFT, Lipid Profile, Thyroid",
  },
  {
    label: "Fluoride Grey",
    dotColor: "#64748b",
    container: "Fluoride grey-top",
    sample: "blood",
    tests: "Fasting Blood Sugar, PPBS",
  },
  {
    label: "Citrate Light Blue",
    dotColor: "#0ea5e9",
    container: "Citrate light blue-top",
    sample: "blood",
    tests: "PT/INR, Coagulation",
  },
  {
    label: "Plain Red",
    dotColor: "#ef4444",
    container: "Plain red-top clot activator",
    sample: "blood",
    tests: "Serum Immunology, Crossmatch",
  },
  {
    label: "Sterile Urine Cup",
    dotColor: "#eab308",
    container: "Sterile specimen container (50mL)",
    sample: "urine",
    tests: "Complete Urine Analysis",
  },
];

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

  // Barcode scanner modal
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);

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

      const list: any[] = taskData.tasks || [];
      list.sort((a, b) => {
        const ua = a.priority === "urgent" ? 0 : 1;
        const ub = b.priority === "urgent" ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });
      setTasks(list);
      if (list.length > 0 && !activeTask) {
        setActiveTask(list[0]);
      }
      setSamples(sampleData.samples || []);
    } catch (e) {
      setMsg({ kind: "err", text: "Could not load your runs. Check your connection." });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, activeTask]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const inHand = samples.filter(
    (s) => s.status === "collected" || s.status === "in_transit"
  );
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const applyPreset = (p: typeof VACUTAINER_PRESETS[0]) => {
    setContainerType(p.container);
    setSampleType(p.sample);
    if (!testNames.trim()) {
      setTestNames(p.tests);
    }
  };

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
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading specimen console…</div>;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {msg && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            fontWeight: 600,
            background: msg.kind === "ok" ? "#dcfce7" : "#fee2e2",
            color: msg.kind === "ok" ? "#166534" : "#991b1b",
            border: `1px solid ${msg.kind === "ok" ? "#86efac" : "#fca5a5"}`,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icon as={msg.kind === "ok" ? CheckCircle2 : AlertTriangle} size={20} />
          <span>{msg.text}</span>
        </div>
      )}

      {/* ── Linked lab ───────────────────────────────────────────────── */}
      <div className="card cm-lab-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon as={Building2} size={20} /> Primary Diagnostic Hub
          </h3>
          <span className="cm-phlebo-badge">Specimen Logistics</span>
        </div>
        <p style={{ margin: "6px 0 14px 0", fontSize: "0.86rem", color: "#64748b" }}>
          Default accredited diagnostic center for cold-chain sample batching and pathology processing.
        </p>

        {invitations.map((inv) => (
          <div
            key={inv.id}
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#eff6ff",
              border: "1.5px solid #93c5fd",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 800, color: "#1e3a8a", fontSize: "0.95rem" }}>
              {inv.org_name} invited you to join their phlebotomy team
            </div>
            {inv.message && (
              <div style={{ fontSize: "0.85rem", color: "#1e40af", marginTop: 4 }}>
                &ldquo;{inv.message}&rdquo;
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                onClick={() => respondToInvite(inv.id, true)}
                disabled={savingLab}
                className="btn btn-primary"
                style={{ padding: "8px 20px", fontSize: "0.85rem" }}
              >
                Accept & Link Hub
              </button>
              <button
                onClick={() => respondToInvite(inv.id, false)}
                disabled={savingLab}
                style={{
                  padding: "8px 18px",
                  fontSize: "0.85rem",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "#475569",
                }}
              >
                Decline
              </button>
            </div>
          </div>
        ))}

        {homeLab.id ? (
          <div className="cm-lab-status-banner cm-lab-status-banner--connected">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon as={ShieldCheck} size={24} />
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                  Verified Partner: {homeLab.name}
                </div>
                <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>
                  Active NABL/NABH accredited diagnostic network affiliate
                </div>
              </div>
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 9999 }}>
              Connected
            </span>
          </div>
        ) : pendingApplications.length > 0 ? (
          <div className="cm-lab-status-banner cm-lab-status-banner--pending">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon as={Clock} size={20} />
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>
                  Affiliation Pending: {pendingApplications[0].org_name}
                </div>
                <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                  Waiting on laboratory director approval. Batches will automatically route here once confirmed.
                </div>
              </div>
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: 9999 }}>
              In Review
            </span>
          </div>
        ) : (
          <div>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#475569",
                fontSize: "0.86rem",
                marginBottom: 12,
              }}
            >
              Not attached to a home laboratory yet. Select a certified diagnostic center in your service zone to establish specimen drop-off affiliation.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                onChange={(e) => requestToJoin(e.target.value)}
                disabled={savingLab || labs.length === 0}
                defaultValue=""
                style={{
                  ...inputStyle,
                  flex: 1,
                  minWidth: 260,
                  marginTop: 0,
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <option value="">— Request Affiliation with Diagnostic Centre —</option>
                {labs.map((l) => (
                  <option key={l.user_id} value={l.user_id}>
                    {l.organization_name || l.name}
                    {l.city ? ` — ${l.city}` : ""}
                  </option>
                ))}
              </select>
              {savingLab && <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Sending request…</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── Active collection runs ───────────────────────────────────── */}
      <div className="card" style={{ padding: 22, borderRadius: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon as={MapPin} size={20} /> Assigned Collection Runs ({tasks.length})
          </h3>
          <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
            Select a run to register specimen tubes
          </span>
        </div>

        {tasks.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
            No active runs assigned. Accepted dispatch tasks will appear here.
          </div>
        ) : (
          <div className="cm-phlebo-run-grid">
            {tasks.map((t) => {
              const urgent = t.priority === "urgent";
              const chosen = activeTask?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveTask(t)}
                  className={`cm-phlebo-run-card ${chosen ? "cm-phlebo-run-card--selected" : ""}`}
                >
                  <div className="cm-phlebo-run-card__header">
                    <div>
                      <div className="cm-phlebo-run-card__name">
                        {(t.service_subtype || t.service_type || "Home Collection").replace(/_/g, " ")}
                      </div>
                      <div className="cm-phlebo-run-card__addr">
                        {t.patient_address || "Patient home address"}
                      </div>
                    </div>
                    <StatusPill status={t.status} urgent={urgent} />
                  </div>

                  <div className="cm-phlebo-run-card__footer">
                    <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b", fontWeight: 600 }}>
                      ID: {t.booking_id ? `#${t.booking_id.slice(0, 8)}` : `#${t.id?.slice(0, 8)}`}
                    </span>
                    <span className={`cm-phlebo-run-card__pill ${chosen ? "cm-phlebo-run-card__pill--selected" : ""}`}>
                      {chosen ? (
                        <>
                          <Icon as={Check} size={14} /> Active Target
                        </>
                      ) : (
                        "Select Run"
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Register a collected tube ──────────────────────────────────── */}
      <div className="card" style={{ padding: 22, borderRadius: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon as={TestTube} size={20} /> Register &amp; Label Specimen Tube
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
              {activeTask
                ? `Recording tubes for: ${(activeTask.service_subtype || activeTask.service_type || "Home collection").replace(/_/g, " ")}`
                : "Select an active run from the cards above first."}
            </p>
          </div>
          {activeTask && (
            <span style={{ fontSize: "0.78rem", fontWeight: 700, background: "#e0f2fe", color: "#0369a1", padding: "4px 12px", borderRadius: 9999 }}>
              Booking: #{activeTask.booking_id?.slice(0, 8) || activeTask.id?.slice(0, 8)}
            </span>
          )}
        </div>

        {/* 1-Click Vacutainer Presets */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon as={Sparkles} size={14} /> Quick Vacutainer Presets (1-Tap Auto-fill)
          </div>
          <div className="cm-vacutainer-presets">
            {VACUTAINER_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="cm-vacutainer-pill"
                onClick={() => applyPreset(preset)}
                title={`Auto-fill ${preset.container} for ${preset.tests}`}
              >
                <span className="cm-vacutainer-dot" style={{ background: preset.dotColor }} />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form fields */}
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 6 }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>Tube Barcode</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or leave blank for auto-mint"
                style={{ ...inputStyle, marginTop: 0, flex: 1, fontFamily: "monospace" }}
              />
              <button
                type="button"
                onClick={() => setBarcodeScannerOpen(true)}
                title="Scan barcode with camera"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  background: "#f8fafc",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0f172a",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon as={Camera} size={20} />
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>Sample Type</label>
            <select
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value)}
              style={{ ...inputStyle, marginTop: 4, textTransform: "capitalize", background: "#fff" }}
            >
              {SAMPLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>Container / Vacutainer Cap</label>
            <input
              value={containerType}
              onChange={(e) => setContainerType(e.target.value)}
              placeholder="e.g. EDTA purple-top, SST gold"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>Requested Tests</label>
            <input
              value={testNames}
              onChange={(e) => setTestNames(e.target.value)}
              placeholder="e.g. CBC, HbA1c, Lipid Profile"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="primary"
            onClick={registerSample}
            disabled={saving || !activeTask}
            loading={saving}
          >
            <Icon as={Plus} size={16} /> Register &amp; Mint Specimen Tube
          </Button>
        </div>
      </div>

      {/* ── Manifest + handover ──────────────────────────────────────── */}
      <div className="card" style={{ padding: 22, borderRadius: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon as={Package} size={20} /> Cold-Chain Specimen Carrier ({inHand.length})
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
              Tubes awaiting digital and physical batch handover to the diagnostic laboratory.
            </p>
          </div>
          {selectedIds.length > 0 && (
            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0284c7", background: "#f0f9ff", border: "1px solid #bae6fd", padding: "4px 12px", borderRadius: 9999 }}>
              {selectedIds.length} of {inHand.length} Selected
            </span>
          )}
        </div>

        {inHand.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", background: "#f8fafc", borderRadius: 14, border: "1px dashed #cbd5e1" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", color: "#0284c7" }}>
              <Icon as={Package} size={24} />
            </div>
            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
              Cold-Chain Carrier Bag is Empty
            </div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
              Registered doorstep tubes will accumulate here until you submit the batch to your partner lab.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10 }}>
              {inHand.map((s) => {
                const isChecked = !!selected[s.id];
                return (
                  <label
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: 14,
                      borderRadius: 12,
                      border: isChecked ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                      cursor: "pointer",
                      background: isChecked ? "#f0f9ff" : "#ffffff",
                      transition: "all 0.15s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => setSelected({ ...selected, [s.id]: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: "#0284c7" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, fontFamily: "monospace", color: "#0f172a", fontSize: "0.95rem" }}>
                          {s.barcode}
                        </span>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, color: "#475569" }}>
                          {s.sample_type}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 4 }}>
                        {s.container_type ? `${s.container_type}` : "Standard Tube"}
                        {s.test_names?.length ? ` • ${s.test_names.join(", ")}` : ""}
                      </div>
                    </div>
                    <StatusPill status={s.status} />
                  </label>
                );
              })}
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 260, marginTop: 0, background: "#fff" }}
              >
                <option value="">
                  {homeLab.name ? `Destination: Primary Hub (${homeLab.name})` : "Choose destination laboratory"}
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
              <Button
                variant="primary"
                onClick={submitHandover}
                disabled={
                  submitting ||
                  selectedIds.length === 0 ||
                  (!destination && !homeLab.id)
                }
                loading={submitting}
              >
                <Icon as={Send} size={16} /> Handover {selectedIds.length || 0} Specimen(s) to Lab
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── Recent history ───────────────────────────────────────────── */}
      {samples.length > inHand.length && (
        <div className="card" style={{ padding: 22, borderRadius: 18 }}>
          <h3 style={{ margin: "0 0 14px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon as={Clock} size={20} /> Verified Handover Log (Last 15 Specimen Batches)
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
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
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#334155" }}>{s.barcode}</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {s.rejection_reason && (
                      <span style={{ fontSize: "0.78rem", color: "#991b1b", fontWeight: 600 }}>{s.rejection_reason}</span>
                    )}
                    <StatusPill status={s.status} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Barcode scanner modal ──────────────────────────────── */}
      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onScan={(code) => {
          setBarcode(code);
          setBarcodeScannerOpen(false);
        }}
        title="Scan Tube Barcode"
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1.5px solid #cbd5e1",
  fontSize: "0.9rem",
  marginTop: 4,
  outline: "none",
  transition: "all 0.15s ease",
};
