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

import { useCallback, useEffect, useState } from "react";
import { Banner, Button, Field, Icon, Panel, Pill, TextInput } from "@/components/ui";
import { Camera } from "@/components/ui/icons";

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
            Daily attendance
          </h3>
        </div>
        <Pill tone={statusTone}>{statusLabel}</Pill>
      </div>

      {/* Four states, matching the Pill above exactly (same status === "missed"
          check, checked in the same order) — not a done/not-done binary. A
          late submission is not the same as no submission, and a swept
          "missed" row is not the same as still-pending: sweep_missed has
          already called WalletService.set_hold by the time this row can be
          in that state, so the hold is applied, not a future risk. */}
      <Banner tone={done ? "done" : state.status === "missed" ? "halted" : "waiting"}>
        {done
          ? "05:15 selfie verified — today's earnings are unlocked."
          : state.status === "missed"
            ? `The ${state.deadline} IST window closed without your attendance selfie. Today's payout is on hold — contact operations to have it reviewed.`
            : state.submitted && state.is_late
              ? `Selfie received after ${state.deadline} IST — logged as late. Operations will confirm whether today's payout is affected.`
              : `Live selfie with your ID and collection kit required by ${state.deadline} IST. Missing it holds today's payout — you can still take jobs and keep earning.`}
      </Banner>

      {state.on_hold && (
        <Banner tone="waiting">
          <strong>Payout paused.</strong> {state.hold_reason}. You can still take jobs and
          keep earning — only the transfer is on hold.
        </Banner>
      )}

      {msg && <Banner tone={msg.kind === "ok" ? "done" : "urgent"}>{msg.text}</Banner>}

      {!done && (
        <div className="cm-attendance__form">
          <Field label="Selfie image URL" id="attendance-selfie">
            <TextInput
              value={selfieUrl}
              onChange={(e) => setSelfieUrl(e.target.value)}
              placeholder="Selfie image URL"
            />
          </Field>
          <Button
            variant="primary"
            onClick={submit}
            loading={saving}
            disabled={!selfieUrl.trim()}
          >
            Submit
          </Button>
        </div>
      )}
    </Panel>
  );
}
