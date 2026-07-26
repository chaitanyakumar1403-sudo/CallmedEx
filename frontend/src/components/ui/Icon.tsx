import type { LucideIcon } from "./icons";

/**
 * Fixes size and stroke to token values so icons always match the weight of
 * adjacent type. Decorative by default — pass `label` only when the icon is
 * the sole carrier of meaning, which the design tries hard to avoid.
 */
export function Icon({
  as: Glyph,
  size = 16,
  label,
  className = "",
}: {
  as: LucideIcon;
  size?: 14 | 16 | 20 | 24;
  label?: string;
  className?: string;
}) {
  return (
    <Glyph
      size={size}
      strokeWidth={2}
      className={`cm-icon${className ? ` ${className}` : ""}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
