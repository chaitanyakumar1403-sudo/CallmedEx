"use client";

import { cloneElement, isValidElement } from "react";

export function Field({
  label, id, hint, error, required, children,
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  // A child may already carry its own id or aria-describedby — a composite
  // widget that describes itself, for instance. Overwriting either silently
  // drops a real association, so the child wins on id and both lists merge.
  const childProps = (children.props ?? {}) as Record<string, unknown>;
  const controlId = typeof childProps.id === "string" ? childProps.id : id;
  const childDescribedBy =
    typeof childProps["aria-describedby"] === "string"
      ? childProps["aria-describedby"]
      : undefined;

  const hintId = hint ? `${controlId}-hint` : undefined;
  const errId = error ? `${controlId}-err` : undefined;
  const describedBy =
    [childDescribedBy, hintId, errId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })
    : children;

  return (
    <div className="cm-field">
      <label className="cm-field__label" htmlFor={controlId}>
        {label}
        {required && <span className="cm-field__req" aria-hidden="true"> *</span>}
      </label>
      {hint && <p className="cm-field__hint" id={hintId}>{hint}</p>}
      {control}
      {error && <p className="cm-field__err" id={errId} role="alert">{error}</p>}
    </div>
  );
}

export function TextInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "style">) {
  return <input {...props} className="cm-input" />;
}

export function Select(props: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "style">) {
  return <select {...props} className="cm-input cm-input--select" />;
}

export function TextArea(props: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "style">) {
  return <textarea {...props} className="cm-input cm-input--area" />;
}
