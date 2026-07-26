"use client";

/**
 * DashboardShell — one chrome for all fifteen dashboards.
 *
 * The tablist and header now come from the shared primitives, so a change to
 * either lands everywhere at once. `role` no longer selects a colour: the eight
 * role accents are gone and every dashboard is navy, which frees the whole
 * colour budget for status.
 */

import { PageHeader, Tabs } from "@/components/ui";
import type { DashTab } from "@/components/ui";

export type { DashTab };

export type DashRole =
  | "patient" | "doctor" | "phlebotomist" | "nurse"
  | "organization" | "pharmacy" | "admin" | "staff";

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
  return (
    <div className="cm-dash" data-role={role}>
      <PageHeader title={title} subtitle={subtitle} actions={aside} />
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange}
            label={`${title} sections`} />
      <div
        className="cm-dash__body"
        role={activeTab ? "tabpanel" : undefined}
        id={activeTab ? `panel-${activeTab}` : undefined}
        aria-labelledby={activeTab ? `tab-${activeTab}` : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/* SkeletonRows is the only symbol anything imports from this file besides the
   default export — phlebotomist, nurse and supervisor all use it for their
   loading state. `Panel`, `EmptyState` and `StatCard` were exported here too but
   have zero consumers, so they are dropped rather than re-exported. */
export { SkeletonRows } from "@/components/ui";
