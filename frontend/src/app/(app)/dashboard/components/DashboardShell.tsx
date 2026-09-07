"use client";

/**
 * DashboardShell — one chrome for all fifteen dashboards.
 *
 * The tablist and header now come from the shared primitives, so a change to
 * either lands everywhere at once. `role` no longer selects a colour: the eight
 * role accents are gone and every dashboard is navy, which frees the whole
 * colour budget for status.
 */

import { useCallback, useRef } from "react";
import { PageHeader, Tabs, Icon } from "@/components/ui";
import type { DashTab } from "@/components/ui";

export type { DashTab };

export type DashRole =
  | "patient" | "doctor" | "phlebotomist" | "nurse"
  | "organization" | "pharmacy" | "admin" | "staff"
  | "processing_center" | "dietitian" | "physiotherapist"
  | "dentist";

/* Desk-bound roles get the frosted treatment. */
const GLASS_ROLES = new Set([
  "doctor", "dentist", "dietitian", "physiotherapist", "nurse",
  "phlebotomist", "organization", "processing_center", "pharmacy",
  "staff", "admin", "patient"
]);

export default function DashboardShell({
  role, title, subtitle, aside, tabs, activeTab, onTabChange, children,
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

  const onNavKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!tabs || tabs.length === 0) return;
      const i = tabs.findIndex((t) => t.id === activeTab);
      if (i === -1) return;
      let next = i;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
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

  const isProviderWithTabs = role !== "patient" && Boolean(tabs && tabs.length > 0);

  return (
    <div
      className={`cm-dash ${isProviderWithTabs ? "cm-dash--provider" : ""}`}
      data-role={role}
      data-surface={GLASS_ROLES.has(role) ? "glass" : undefined}
    >
      <PageHeader title={title} subtitle={subtitle} actions={aside} />

      {/* Patient or fallback with top tabs */}
      {!isProviderWithTabs && tabs && tabs.length > 0 && (
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} label={`${title} sections`} />
      )}

      {isProviderWithTabs ? (
        <div className="cm-provider-layout">
          {/* Left-Aligned Sticky Glassmorphic Navigation Widget */}
          <aside className="cm-provider-sidebar" aria-label={`${title} Navigation`}>
            <div className="cm-provider-nav-widget">
              <div className="cm-provider-nav-header">
                <div className="cm-provider-nav-badge">
                  <span className="cm-provider-nav-dot" />
                  <span>WORKSPACE</span>
                </div>
                <span className="cm-provider-nav-count">{tabs.length} sections</span>
              </div>

              <nav
                className="cm-provider-nav-list"
                role="tablist"
                aria-label={`${title} sections`}
                onKeyDown={onNavKeyDown}
              >
                {tabs.map((tab) => {
                  const selected = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tab.id] = el;
                      }}
                      role="tab"
                      id={`tab-${tab.id}`}
                      aria-selected={selected}
                      aria-controls={selected ? `panel-${tab.id}` : undefined}
                      tabIndex={selected ? 0 : -1}
                      className={`cm-provider-nav-item ${selected ? "cm-provider-nav-item--active" : ""}`}
                      onClick={() => onTabChange(tab.id)}
                    >
                      <div className="cm-provider-nav-item__left">
                        {tab.icon && typeof tab.icon !== "string" && (
                          <span className="cm-provider-nav-item__icon">
                            <Icon as={tab.icon} size={16} />
                          </span>
                        )}
                        <span className="cm-provider-nav-item__label">{tab.label}</span>
                      </div>
                      {typeof tab.count === "number" && tab.count > 0 && (
                        <span
                          className={`cm-provider-nav-item__count ${
                            tab.alert ? "cm-provider-nav-item__count--alert" : ""
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Console Status Footer */}
              <div className="cm-provider-nav-footer">
                <div className="cm-provider-nav-footer-status">
                  <span className="cm-provider-status-dot" />
                  <span>Clinical Console Active</span>
                </div>
                <div className="cm-provider-nav-footer-legal">
                  <span>CallMedex Command Network · ABDM Verified</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Main Content Panel */}
          <main
            className="cm-provider-content"
            role={activeTab ? "tabpanel" : undefined}
            id={activeTab ? `panel-${activeTab}` : undefined}
            aria-labelledby={activeTab ? `tab-${activeTab}` : undefined}
          >
            {children}
          </main>
        </div>
      ) : (
        <div
          className="cm-dash__body"
          role={activeTab ? "tabpanel" : undefined}
          id={activeTab ? `panel-${activeTab}` : undefined}
          aria-labelledby={activeTab ? `tab-${activeTab}` : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* SkeletonRows is the only symbol anything imports from this file besides the
   default export — phlebotomist, nurse and supervisor all use it for their
   loading state. */
export { SkeletonRows } from "@/components/ui";
