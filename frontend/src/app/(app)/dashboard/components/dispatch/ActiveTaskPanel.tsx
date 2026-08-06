"use client";

import { Button, Field, Icon, TextInput } from "@/components/ui";
import { Clock, FlaskConical, MapPin, Navigation, Stethoscope } from "@/components/ui/icons";
import StatusSpine, { StatusPill, dispatchSteps } from "@/app/components/StatusSpine";
import type { DispatchTask } from "../ProviderDispatchTracker";
import { TaskNotes } from "./TaskNotes";
import { serviceLabel } from "./serviceLabel";

/**
 * "arrived" is deliberately absent — that status renders the OTP block
 * instead of a progression button, same as before this file existed.
 */
const STATUS_NEXT: Record<string, { label: string; next: string }> = {
  provider_accepted: { label: "Start Route", next: "en_route" },
  en_route: { label: "Mark Arrived", next: "arrived" },
  in_progress: { label: "Mark Complete", next: "completed" },
};

/** Format slot_start into a human-readable string for the active task view. */
function formatSlotLabel(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Scheduled for today at ${time}`;
    const date = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return `Scheduled for ${date} at ${time}`;
  } catch {
    return null;
  }
}

/**
 * The only two provider types that reach the role-specific handover action
 * below (lab handover for phlebotomist, vitals for nurse). `providerType` on
 * the parent tracker stays a bare `string` — doctor and pharmacy_delivery
 * dispatch through it too — but the branch this component owns is only ever
 * this pair, so the type documents that instead of leaving it implicit.
 */
export type ActiveTaskProviderType = "phlebotomist" | "nurse";

/**
 * The job a field worker is on right now: where, the custody journey via
 * StatusSpine, one-tap turn-by-turn navigation, the role-specific handover
 * action, and — the safety-critical bit — patient OTP verification before a
 * collection is confirmed against the right person.
 *
 * Pure presentation. `onAdvance` and `onVerifyOtp` are the same
 * handleUpdateStatus / handleVerifyOtp calls the parent always made; this
 * component only decides what to render, never what gets submitted.
 */
export function ActiveTaskPanel({
  task, otp, onOtpChange, actionLoading, onAdvance, onVerifyOtp, onOpenVitals, onOpenLab, providerType,
}: {
  task: DispatchTask;
  otp: string;
  onOtpChange: (value: string) => void;
  actionLoading: string;
  onAdvance: (taskId: string, next: string) => void;
  onVerifyOtp: (taskId: string) => void;
  onOpenVitals: () => void;
  onOpenLab: () => void;
  providerType: ActiveTaskProviderType;
}) {
  const next = STATUS_NEXT[task.status];
  const slotLabel = formatSlotLabel(task.slot_start);
  // Derived from the `otp` prop, not local state, so the panel stays pure —
  // this is only an inline hint. The real 6-digit gate that blocks submission
  // still lives in the parent's handleVerifyOtp, unchanged.
  const otpError =
    otp.length > 0 && otp.length < 6 ? "Enter all 6 digits from the patient" : undefined;

  return (
    <section className="cm-active" aria-label="Active task">
      <div className="cm-active__head">
        <h3 className="cm-active__title">
          <Icon as={Navigation} size={20} />
          Active task
        </h3>
        <StatusPill status={task.status} />
      </div>

      <div className="cm-active__body">
        <p className="cm-active__address">
          <Icon as={MapPin} size={16} />
          {task.patient_address}
        </p>
        {slotLabel && (
          <p className="cm-active__slot">
            <Icon as={Clock} size={16} />
            {slotLabel}
          </p>
        )}
        <p className="cm-active__meta">
          {task.estimated_distance_km != null && `${task.estimated_distance_km.toFixed(1)} km away · `}
          {serviceLabel(task.service_type)}
        </p>
        {task.notes && <TaskNotes notes={task.notes} heading="Requirements:" />}
      </div>

      <div className="cm-active__spine">
        <StatusSpine steps={dispatchSteps(task.status)} />
      </div>

      <div className="cm-active__nav">
        <a
          className="cm-btn cm-btn--secondary"
          href={`https://www.google.com/maps/dir/?api=1&destination=${task.patient_lat},${task.patient_lng}`}
          target="_blank"
          rel="noreferrer"
        >
          <Icon as={Navigation} size={16} />
          Google Maps
        </a>
        <a
          className="cm-btn cm-btn--secondary"
          href={`https://waze.com/ul?ll=${task.patient_lat},${task.patient_lng}&navigate=yes`}
          target="_blank"
          rel="noreferrer"
        >
          <Icon as={Navigation} size={16} />
          Waze
        </a>
      </div>

      {task.status === "in_progress" && (providerType === "phlebotomist" || providerType === "nurse") && (
        <div className="cm-active__task-actions">
          {providerType === "phlebotomist" && (
            <Button variant="secondary" onClick={onOpenLab}>
              <Icon as={FlaskConical} size={16} />
              Sample Handover to Lab Hub
            </Button>
          )}
          {providerType === "nurse" && (
            <Button variant="secondary" onClick={onOpenVitals}>
              <Icon as={Stethoscope} size={16} />
              Upload Vitals & Clinical Note
            </Button>
          )}
        </div>
      )}

      {task.status === "arrived" ? (
        <div className="cm-active__otp">
          <p className="cm-active__otp-title">Verify Patient OTP</p>
          <Field
            label="Patient OTP"
            id={`otp-${task.id}`}
            hint="Ask the patient for the 6-digit code sent to their phone"
            error={otpError}
          >
            <TextInput
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => onOtpChange(e.target.value)}
            />
          </Field>
          <Button
            variant="primary"
            className="cm-active__verify"
            onClick={() => onVerifyOtp(task.id)}
            loading={actionLoading === "verify_otp"}
          >
            Verify OTP
          </Button>
        </div>
      ) : (
        next && (
          <Button
            variant="primary"
            className="cm-active__advance"
            onClick={() => onAdvance(task.id, next.next)}
            loading={actionLoading === task.id + next.next}
          >
            {next.label}
          </Button>
        )
      )}
    </section>
  );
}
