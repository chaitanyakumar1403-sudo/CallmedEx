"use client";

import { Icon } from "./Icon";
import type { LucideIcon } from "./icons";

/**
 * `meta` is where the number gets its meaning. "0" tells a phlebotomist
 * nothing; "0 of 8 assigned" tells them where they stand.
 */
export function Stat({
  label, value, meta, icon, tone = "default", onClick,
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  icon?: LucideIcon;
  tone?: "default" | "urgent" | "active" | "done";
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="cm-stat__label">
        {icon && <Icon as={icon} size={14} />}
        {label}
      </span>
      <span className="cm-stat__value">{value}</span>
      {meta && <span className="cm-stat__meta">{meta}</span>}
    </>
  );
  const cls = `cm-stat cm-stat--${tone}`;

  return onClick ? (
    <button type="button" className={`${cls} cm-stat--btn`} onClick={onClick}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="cm-stats">{children}</div>;
}
