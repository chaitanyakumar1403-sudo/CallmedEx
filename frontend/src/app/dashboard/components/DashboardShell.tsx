"use client";

/**
 * DashboardShell — one chrome for all sixteen dashboards.
 *
 * Each dashboard previously built its own header with an inline gradient and
 * its own tab strip, so they read as sixteen products rather than one. The
 * shell fixes the structure and spends the difference on a single accent token
 * per role.
 *
 * The tabs are a real ARIA tablist with arrow-key navigation. The previous
 * `tab-pill-btn` markup was a row of plain buttons: a screen reader announced
 * eight unrelated buttons with no indication that they were alternatives, or
 * which one was showing.
 */

import { useCallback, useRef } from "react";

export interface DashTab {
  id: string;
  label: string;
  icon?: string;
  /** Rendered as a badge. Draws the eye, so pass it only when it means something. */
  count?: number;
  /** Renders the count in red — for work that is waiting on this user. */
  alert?: boolean;
}

export type DashRole =
  | "patient" | "doctor" | "phlebotomist" | "nurse"
  | "organization" | "pharmacy" | "admin" | "staff";

export default function DashboardShell({
  role,
  title,
  subtitle,
  aside,
  tabs,
  activeTab,
  onTabChange,
  children,
}: {
  role: DashRole;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  tabs: DashTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
}) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Left/Right move between tabs, Home/End jump to the ends — what a tablist is
  // expected to do. Without it a keyboard user must tab through every panel to
  // reach the next section.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const i = tabs.findIndex((t) => t.id === activeTab);
      if (i === -1) return;
      let next = i;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else return;
      e.preventDefault();
      const id = tabs[next].id;
      onTabChange(id);
      tabRefs.current[id]?.focus();
    },
    [tabs, activeTab, onTabChange]
  );

  return (
    <div className="cm-dash" data-role={role}>
      <header className="cm-dash__head">
        <div className="cm-dash__head-inner">
          <div>
            <h1 className="cm-dash__title">{title}</h1>
            {subtitle && <p className="cm-dash__sub">{subtitle}</p>}
          </div>
          {aside && <div className="cm-dash__aside">{aside}</div>}
        </div>
      </header>

      {tabs.length > 0 && (
        <div className="cm-dash__tabs" role="tablist" aria-label={`${title} sections`} onKeyDown={onKeyDown}>
          {tabs.map((tab) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el; }}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                // Roving tabindex: the tablist is one tab stop, arrows move within.
                tabIndex={selected ? 0 : -1}
                className="cm-tab"
                onClick={() => onTabChange(tab.id)}
              >
                {tab.icon && <span aria-hidden="true">{tab.icon} </span>}
                {tab.label}
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className={`cm-tab__count${tab.alert ? " cm-tab__count--alert" : ""}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="cm-dash__body"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Primitives ──────────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  meta,
  urgent = false,
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  urgent?: boolean;
}) {
  return (
    <div className={`cm-stat${urgent ? " cm-stat--urgent" : ""}`}>
      <div className="cm-stat__label">{label}</div>
      <div className="cm-stat__value">{value}</div>
      {meta && <div className="cm-stat__meta">{meta}</div>}
    </div>
  );
}

export function Panel({
  title,
  note,
  children,
  style,
}: {
  title?: string;
  note?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section className="cm-panel" style={style}>
      {title && <h2 className="cm-panel__title">{title}</h2>}
      {note && <p className="cm-panel__note">{note}</p>}
      {children}
    </section>
  );
}

/**
 * An empty screen is an invitation to act. It names what will appear here and,
 * where there is one, offers the action that fills it — rather than apologising
 * or leaving a bare "No data".
 */
export function EmptyState({
  icon = "📭",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="cm-empty">
      <div className="cm-empty__icon" aria-hidden="true">{icon}</div>
      <p className="cm-empty__title">{title}</p>
      {body && <p className="cm-empty__body">{body}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/** Skeletons mirror the shape of what is loading, so the layout stops jumping. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="cm-sr">Loading</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cm-skeleton cm-skeleton--card" style={{ marginBottom: 12 }} />
      ))}
    </div>
  );
}
