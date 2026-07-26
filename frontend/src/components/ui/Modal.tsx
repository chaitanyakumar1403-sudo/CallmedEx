"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { X } from "./icons";

/**
 * Must list everything the browser will stop on, not just form controls. The
 * boundary check only fires when focus is on the first or last item, so an
 * element the browser tabs to but this selector misses lets focus walk past
 * the edge and out of the dialog. `AIVoiceIntakeModal` in particular will
 * carry media controls once it is converted.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable]:not([contenteditable="false"])',
  'audio[controls]',
  'video[controls]',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * The five hand-rolled overlays this replaces each trapped nothing: Tab walked
 * straight out of the dialog into the page behind it, and Esc did nothing.
 */
export function Modal({
  open, onClose, title, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="cm-modal-title" ref={ref}>
        <div className="cm-modal__head">
          <h2 className="cm-modal__title" id="cm-modal-title">{title}</h2>
          <button className="cm-modal__x" onClick={onClose} aria-label="Close dialog">
            <Icon as={X} size={20} />
          </button>
        </div>
        <div className="cm-modal__body">{children}</div>
        {footer && <div className="cm-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
