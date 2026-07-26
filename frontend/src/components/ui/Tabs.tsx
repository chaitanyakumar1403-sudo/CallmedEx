"use client";

import { useCallback, useRef } from "react";
import { Icon } from "./Icon";
import type { LucideIcon } from "./icons";

export interface DashTab {
  id: string;
  label: string;
  /**
   * `string` is the legacy emoji form. Six unconverted dashboards still pass it
   * across 39 tab definitions, and widening the type here is what lets Wave 1
   * finish without editing a single file outside its own scope. Strings are
   * accepted by the type and dropped at render, so the emoji disappear from
   * every tab strip immediately while the pages still compile.
   *
   * Wave 6 narrows this to `LucideIcon` once the last consumer is converted.
   */
  icon?: LucideIcon | string;
  /** Rendered as a badge. Draws the eye, so pass it only when it means something. */
  count?: number;
  /** Renders the count in red — for work that is waiting on this user. */
  alert?: boolean;
}

export function Tabs({
  tabs, activeTab, onTabChange, label,
}: {
  tabs: DashTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  label: string;
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

  if (tabs.length === 0) return null;

  return (
    <div className="cm-dash__tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            // DashboardShell renders only the active panel, so for every
            // unselected tab `panel-${tab.id}` names an element that does not
            // exist. Only the selected tab's panel is ever mounted.
            aria-controls={selected ? `panel-${tab.id}` : undefined}
            // Roving tabindex: the tablist is one tab stop, arrows move within.
            tabIndex={selected ? 0 : -1}
            className="cm-tab"
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon && typeof tab.icon !== "string" && <Icon as={tab.icon} size={16} />}
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
  );
}
