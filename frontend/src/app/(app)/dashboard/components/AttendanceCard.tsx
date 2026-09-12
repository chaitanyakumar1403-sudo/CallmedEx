"use client";

/**
 * Daily attendance card — field providers.
 *
 * The MOUs require a live selfie with the collection kit before field duty, by
 * 05:15 IST. Missing it holds PAYMENT, not dispatch — so the copy here is
 * careful to say the payout is paused, never that work is blocked. A provider
 * who reads "you can't work" when they can will stop taking jobs, which costs
 * the patient.
 *
 * Attendance gates pay under the MOU, so the pending/late/verified state has
 * to be unmistakable: the requirement banner tracks the same three states as
 * the status Pill (not a done/not-done binary), and the copy — not just the
 * tone — changes with it, since a late submission read as "still missing" is
 * a false claim, not just an ambiguous colour.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { Banner, Button, Field, Icon, Panel, Pill, TextInput } from "@/components/ui";
import { Camera, CheckCircle2, ShieldCheck, RefreshCw } from "@/components/ui/icons";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

export default function AttendanceCard() {
  const [state, setState] = useState<any>(null);
  const [selfieUrl, setSelfieUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [mode, setMode] = useState<"camera" | "url">("camera");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setSelfieUrl(result);
        setPreviewUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

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
      setPreviewUrl("");
      await load();
    } catch {
      setMsg({ kind: "err", text: "Network error recording attendance." });
    } finally {
      setSaving(false);
    }
  }

  if (!state) return null;

  const done = state.submitted && !state.is_late;
  const statusTone = done ? "done" : state.status === "missed" ? "halted" : "waiting";
  const statusLabel = done
    ? "Recorded"
    : state.status === "missed"
      ? "Missed"
      : state.is_late
        ? "Late"
        : "Pending";

  return (
    <Panel>
      <div className="cm-attendance__head">
        <div>
          <h3 className="cm-attendance__title">
            <Icon as={Camera} size={20} />
            Field Attendance & Duty Verification
          </h3>
        </div>
        <Pill tone={statusTone}>{statusLabel}</Pill>
      </div>

      {done ? (
        <Banner tone="done">
          05:15 IST duty selfie verified. Today&apos;s field earnings and payouts are fully unlocked.
        </Banner>
      ) : state.status === "missed" ? (
        <Banner tone="halted">
          The {state.deadline} IST verification window closed. Today&apos;s payout is on hold — contact operations to have it reviewed. You can still accept dispatches and earn.
        </Banner>
      ) : state.submitted && state.is_late ? (
        <Banner tone="waiting">
          Selfie received after {state.deadline} IST — logged as late. Operations will confirm whether today&apos;s payout is affected.
        </Banner>
      ) : state.on_hold ? (
        <Banner tone="waiting">
          Payout paused ({state.hold_reason || "Daily attendance selfie required"}). Live selfie with your ID and collection kit required by {state.deadline} IST to release payout. You can still accept tasks.
        </Banner>
      ) : (
        <Banner tone="waiting">
          Live selfie with your ID card and sample collection kit required by {state.deadline} IST. Missing it holds today&apos;s payout — you can still take jobs and keep earning.
        </Banner>
      )}

      {msg && <Banner tone={msg.kind === "ok" ? "done" : "urgent"}>{msg.text}</Banner>}

      {!done && (
        <div className="cm-duty-attendance__body">
          {previewUrl ? (
            <div className="cm-duty-attendance__preview-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Attendance selfie preview"
                className="cm-duty-attendance__preview"
              />
              <div className="cm-duty-attendance__preview-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPreviewUrl("");
                    setSelfieUrl("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <Icon as={RefreshCw} size={14} /> Retake photo
                </Button>
                <Button
                  variant="primary"
                  onClick={submit}
                  loading={saving}
                >
                  <Icon as={ShieldCheck} size={16} /> Confirm & Unlock Payout
                </Button>
              </div>
            </div>
          ) : mode === "camera" ? (
            <div className="cm-duty-attendance__capture-zone" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileChange}
                className="tab-panel-hidden"
              />
              <div className="cm-duty-attendance__capture-content">
                <div className="cm-duty-attendance__camera-icon">
                  <Icon as={Camera} size={24} />
                </div>
                <div className="cm-duty-attendance__capture-text">
                  Take Live Duty Selfie with Collection Kit
                </div>
                <div className="cm-duty-attendance__capture-hint">
                  Tap here to open device camera or upload picture with ID &amp; kit
                </div>
              </div>
              <div className="cm-duty-attendance__mode-switch">
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode("url");
                  }}
                >
                  Or enter image URL manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="cm-attendance__form">
              <Field label="Selfie image URL" id="attendance-selfie" hint="Direct link to hosted selfie">
                <TextInput
                  value={selfieUrl}
                  onChange={(e) => setSelfieUrl(e.target.value)}
                  placeholder="https://..."
                />
              </Field>
              <div className="cm-attendance__form-actions">
                <Button
                  variant="ghost"
                  onClick={() => setMode("camera")}
                >
                  <Icon as={Camera} size={14} /> Use Camera
                </Button>
                <Button
                  variant="primary"
                  onClick={submit}
                  loading={saving}
                  disabled={!selfieUrl.trim()}
                >
                  Submit
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
