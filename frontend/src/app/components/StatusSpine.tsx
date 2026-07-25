"use client";

/**
 * StatusSpine — the one object every CallMedex journey is read through.
 *
 * A blood sample, a nurse dispatch and a lab report all travel an escalating
 * path. Before this, each surface invented its own way of showing that: a
 * coloured chip here, a status string there, a percentage bar somewhere else.
 * The patient, the phlebotomist and the lab technician were looking at the same
 * job through three different pictures.
 *
 * The spine is deliberately the same component in all three places. It encodes
 * real state — the dispatch and custody chains — rather than decorating, and it
 * never communicates by colour alone: every step carries a written label, the
 * current step carries a filled marker, and completed steps carry a tick.
 */

export type SpineState = "done" | "current" | "pending" | "urgent" | "halted";

export interface SpineStep {
  /** What the patient would call this step, not what the column is named. */
  label: string;
  /** Time, provider name, or reason. One short line. */
  meta?: string;
  state: SpineState;
}

/* ── Journey definitions ──────────────────────────────────────────────────
   Kept next to the component so a status added to the backend has one obvious
   place to be reflected, rather than being re-derived on each screen.        */

const SAMPLE_JOURNEY = [
  { key: "collected", label: "Sample collected" },
  { key: "in_transit", label: "On the way to the lab" },
  { key: "handover_requested", label: "Handed to the lab" },
  { key: "received", label: "Lab confirmed receipt" },
  { key: "processing", label: "Being processed" },
  { key: "report_ready", label: "Report ready" },
];

const DISPATCH_JOURNEY = [
  { key: "searching", label: "Finding a provider" },
  { key: "provider_notified", label: "Providers notified" },
  { key: "provider_accepted", label: "Accepted" },
  { key: "en_route", label: "On the way to you" },
  { key: "arrived", label: "Arrived" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];

/** Terminal states that stop a journey rather than advancing it. */
const HALTED: Record<string, string> = {
  rejected: "Rejected by the lab",
  cancelled: "Cancelled",
  no_provider: "No provider available",
  expired: "Expired",
};

function buildSteps(
  journey: { key: string; label: string }[],
  status: string,
  meta: Record<string, string> = {}
): SpineStep[] {
  if (HALTED[status]) {
    // A halted journey shows how far it got, then stops honestly rather than
    // leaving greyed-out future steps implying it might still continue.
    return [
      { label: HALTED[status], meta: meta[status], state: "halted" },
    ];
  }

  const at = journey.findIndex((s) => s.key === status);
  return journey.map((step, i) => ({
    label: step.label,
    meta: meta[step.key],
    state:
      at === -1 ? "pending" : i < at ? "done" : i === at ? "current" : "pending",
  }));
}

export function sampleSteps(status: string, meta?: Record<string, string>) {
  return buildSteps(SAMPLE_JOURNEY, status, meta);
}

export function dispatchSteps(status: string, meta?: Record<string, string>) {
  return buildSteps(DISPATCH_JOURNEY, status, meta);
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function StatusSpine({
  steps,
  urgent = false,
}: {
  steps: SpineStep[];
  urgent?: boolean;
}) {
  return (
    <ol className="cm-spine">
      {steps.map((step, i) => {
        // Urgency escalates the *current* step only — a finished step is not
        // urgent, and neither is one that has not started.
        const state =
          urgent && step.state === "current" ? "urgent" : step.state;
        return (
          <li key={`${step.label}-${i}`} className={`cm-spine__step cm-spine__step--${state}`}>
            <span className="cm-spine__dot" aria-hidden="true">
              {state === "done" ? "✓" : state === "halted" ? "!" : ""}
            </span>
            <span>
              <span className="cm-spine__label">{step.label}</span>
              {/* The state is written out for screen readers and for anyone who
                  cannot separate the hues. */}
              <span className="cm-sr">
                {state === "done"
                  ? " — completed"
                  : state === "current"
                  ? " — happening now"
                  : state === "urgent"
                  ? " — happening now, urgent"
                  : state === "halted"
                  ? " — stopped"
                  : " — not started"}
              </span>
              {step.meta && <span className="cm-spine__meta">{step.meta}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Inline counterpart ──────────────────────────────────────────────────── */

const PILL_STATE: Record<string, { cls: string; label: string }> = {
  collected:          { cls: "active",  label: "In hand" },
  in_transit:         { cls: "active",  label: "In transit" },
  handover_requested: { cls: "waiting", label: "Awaiting lab" },
  received:           { cls: "done",    label: "Received" },
  processing:         { cls: "active",  label: "Processing" },
  report_ready:       { cls: "done",    label: "Report ready" },
  rejected:           { cls: "halted",  label: "Rejected" },

  searching:          { cls: "waiting", label: "Finding provider" },
  provider_notified:  { cls: "waiting", label: "Notified" },
  provider_accepted:  { cls: "active",  label: "Accepted" },
  en_route:           { cls: "active",  label: "On the way" },
  arrived:            { cls: "active",  label: "Arrived" },
  in_progress:        { cls: "active",  label: "In progress" },
  completed:          { cls: "done",    label: "Completed" },
  cancelled:          { cls: "halted",  label: "Cancelled" },
  no_provider:        { cls: "halted",  label: "No provider" },
};

export function StatusPill({ status, urgent = false }: { status: string; urgent?: boolean }) {
  const entry = PILL_STATE[status] || { cls: "halted", label: status.replace(/_/g, " ") };
  const cls = urgent ? "urgent" : entry.cls;
  return (
    <span className={`cm-pill cm-pill--${cls}`}>
      {urgent && "URGENT · "}
      {entry.label}
    </span>
  );
}
