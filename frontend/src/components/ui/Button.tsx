"use client";

import { forwardRef, memo } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: Variant;
  size?: Size;
  /** Renders a busy state and blocks the click. Keeps the label — a spinner
      alone tells the user nothing about what is happening. */
  loading?: boolean;
  /** Square target for a bare icon. Requires `aria-label` — enforced below. */
  iconOnly?: boolean;
}

export const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, iconOnly = false,
    className = "", disabled, children, ...rest },
  ref
) {
  // An icon-only button with no accessible name is inert to a screen reader.
  // The type cannot express "aria-label required when iconOnly", so this is
  // caught in development instead — silently shipping one is worse.
  if (process.env.NODE_ENV !== "production" && iconOnly && !rest["aria-label"]) {
    console.warn("Button: iconOnly requires an aria-label.", rest);
  }

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
}));
