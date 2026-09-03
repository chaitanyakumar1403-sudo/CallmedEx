"use client";

import React from "react";

export interface TimelineStep {
  id: string;
  label: string;
  desc?: string;
  time?: string;
  status: "done" | "active" | "waiting";
}

interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function Timeline({ steps, className = "" }: TimelineProps) {
  return (
    <div className={`cm-clinical-timeline ${className}`.trim()}>
      {steps.map((step) => {
        const stepClass =
          step.status === "active"
            ? "cm-clinical-timeline__step--active"
            : step.status === "done"
            ? "cm-clinical-timeline__step--done"
            : "cm-clinical-timeline__step--waiting";

        return (
          <div
            key={step.id}
            className={`cm-clinical-timeline__step ${stepClass}`}
          >
            <div className="cm-clinical-timeline__dot" />
            <div className="cm-clinical-timeline__content">
              <span className="cm-clinical-timeline__label">{step.label}</span>
              {step.desc && (
                <span className="cm-clinical-timeline__desc">{step.desc}</span>
              )}
              {step.time && (
                <span className="cm-clinical-timeline__time">{step.time}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
