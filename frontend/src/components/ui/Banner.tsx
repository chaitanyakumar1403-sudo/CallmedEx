"use client";

import { Icon } from "./Icon";
import { X } from "./icons";
import type { Tone } from "./Pill";

export function Banner({
  tone, children, onDismiss,
}: {
  tone: Tone;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    // `status` is a polite live region: it waits for the reader to be idle and
    // can be missed entirely mid-interaction. An urgent banner exists to be
    // acted on now, so it gets `alert` (assertive) instead.
    <div className={`cm-banner cm-banner--${tone}`} role={tone === "urgent" ? "alert" : "status"}>
      <div className="cm-banner__body">{children}</div>
      {onDismiss && (
        <button className="cm-banner__x" onClick={onDismiss} aria-label="Dismiss message">
          <Icon as={X} size={16} />
        </button>
      )}
    </div>
  );
}
