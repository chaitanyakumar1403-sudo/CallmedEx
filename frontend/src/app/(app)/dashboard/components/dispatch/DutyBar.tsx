"use client";

import { Button, Icon, Pill, Stat, StatGrid } from "@/components/ui";
import { ClipboardList, CheckCircle2, Wallet, Power } from "@/components/ui/icons";

/**
 * Replaces a hardcoded slate gradient slab that sat on a light page with no
 * relation to any token. Duty state is the single most important thing on this
 * screen, so it reads as a labelled status plus a primary action — not as a
 * block of colour.
 */
export function DutyBar({
  title, onDuty, dutyLoading, gpsLive,
  activeCount, completedToday, earnings, earningsRate,
  onToggle, onShowAllTasks,
}: {
  /**
   * Rendered as an <h2> above the duty head. Passed only by non-embedded
   * callers (doctor, pharmacy), which have no other heading inside their
   * tabpanel — dropping it removed the region from heading navigation
   * entirely. Embedded callers omit it; DashboardShell supplies their <h1>.
   */
  title?: string;
  onDuty: boolean;
  dutyLoading: boolean;
  gpsLive: boolean;
  activeCount: number;
  completedToday: number;
  earnings: number;
  earningsRate: number;
  onToggle: () => void;
  onShowAllTasks: () => void;
}) {
  return (
    <section className={`cm-duty${onDuty ? " cm-duty--on" : ""}`} aria-label="Duty status">
      {title && <h2 className="cm-duty__title-h">{title}</h2>}
      <div className="cm-duty__head">
        <span className="cm-duty__icon"><Icon as={Power} size={20} /></span>
        <div className="cm-duty__text">
          <p className="cm-duty__title">
            {onDuty ? "You are On Duty" : "You are Off Duty"}
          </p>
          <p className="cm-duty__sub">
            {onDuty
              ? "Receiving field requests in your area"
              : "You will not receive new field requests"}
          </p>
        </div>
        {onDuty && gpsLive && <Pill tone="active">GPS live</Pill>}
        <Button
          variant={onDuty ? "danger" : "primary"}
          onClick={onToggle}
          loading={dutyLoading}
        >
          {onDuty ? "Go Off Duty" : "Go On Duty"}
        </Button>
      </div>

      <StatGrid>
        <Stat
          label="Active tasks"
          value={activeCount}
          meta={activeCount === 0 ? "nothing assigned yet" : "tap to see all"}
          icon={ClipboardList}
          tone={activeCount > 0 ? "active" : "default"}
          onClick={onShowAllTasks}
        />
        <Stat label="Done today" value={completedToday} icon={CheckCircle2}
              tone={completedToday > 0 ? "done" : "default"} />
        <Stat label="Today's earnings" value={`₹${earnings}`}
              meta={`₹${earningsRate} per completed job`} icon={Wallet} />
      </StatGrid>
    </section>
  );
}
