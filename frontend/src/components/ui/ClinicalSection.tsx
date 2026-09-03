"use client";

import React from "react";
import { Icon } from "./Icon";
import type { LucideIcon } from "./icons";

interface ClinicalSectionProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ClinicalSection({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
}: ClinicalSectionProps) {
  return (
    <section className={`cm-clinical-section ${className}`.trim()}>
      <header className="cm-clinical-section__head">
        <div className="cm-clinical-section__title-group">
          {icon && (
            <div className="cm-clinical-section__icon-box">
              <Icon as={icon} size={20} />
            </div>
          )}
          <div>
            <h2 className="cm-clinical-section__title">{title}</h2>
            {subtitle && (
              <p className="cm-clinical-section__subtitle">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </header>
      <div className="cm-clinical-section__body">{children}</div>
    </section>
  );
}
