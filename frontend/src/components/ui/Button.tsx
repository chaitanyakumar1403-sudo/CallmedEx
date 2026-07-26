"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: Variant;
  size?: Size;
  /** Renders a busy state and blocks the click. Keeps the label — a spinner
      alone tells the user nothing about what is happening. */
  loading?: boolean;
  /** Square target for a bare icon. Requires `aria-label`. */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, iconOnly = false,
    className = "", disabled, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={[
        "cm-btn",
        `cm-btn--${variant}`,
        `cm-btn--${size}`,
        iconOnly ? "cm-btn--icon" : "",
        className,
      ].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
});
