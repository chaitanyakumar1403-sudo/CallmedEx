export type Tone = "urgent" | "active" | "done" | "waiting" | "halted";

/**
 * The label is required, not optional. Roughly 1 in 12 Indian men has a colour
 * vision deficiency, and a phlebotomist in direct sun loses hue discrimination
 * regardless of eyesight — so the word carries the meaning and the colour only
 * reinforces it.
 */
export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`cm-pill cm-pill--${tone}`}>{children}</span>;
}
