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
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })
    : children;

  return (
    <div className="cm-field">
      <label className="cm-field__label" htmlFor={id}>
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
