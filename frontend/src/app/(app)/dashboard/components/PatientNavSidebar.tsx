"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package, FlaskConical, Stethoscope, Pill, Box,
  Sparkles, Zap, ScanLine, Smile, Users, Calendar, ChevronRight,
  Clock, Compass, ShieldCheck, Home, Globe, ShieldAlert
} from "@/components/ui/icons";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  type: "anchor" | "route";
  target: string;
  badge?: string;
}

const DASHBOARD_SECTIONS: NavItem[] = [
  {
    id: "interactive-twin",
    label: "Interactive 3D Twin",
    icon: Box,
    type: "anchor",
    target: "#interactive-twin",
    badge: "3D",
  },
  {
    id: "health-advisor",
    label: "Health Advisor",
    icon: Sparkles,
    type: "anchor",
    target: "#health-advisor",
  },
  {
    id: "medicine-cabinet",
    label: "Medicine Cabinet",
    icon: Clock,
    type: "anchor",
    target: "#medicine-cabinet",
  },
  {
    id: "family-circle",
    label: "Family Care Circle",
    icon: Users,
    type: "anchor",
    target: "#family-circle",
  },
  {
    id: "recent-bookings",
    label: "Recent Bookings",
    icon: Calendar,
    type: "anchor",
    target: "#recent-bookings",
  },
  {
    id: "account-settings",
    label: "Account & Privacy",
    icon: ShieldCheck,
    type: "anchor",
    target: "#account-settings",
  },
];

const CARE_SERVICES = [
  {
    label: "Health Packages",
    href: "/packages",
    icon: Package,
  },
  {
    label: "Book a Test",
    href: "/diagnostics",
    icon: FlaskConical,
  },
  {
    label: "Consultation",
    href: "/consultation",
    icon: Stethoscope,
  },
  {
    label: "NRI Consultation",
    href: "/nri-consultation",
    icon: Globe,
  },
  {
    label: "Online Pharmacy",
    href: "/pharmacy",
    icon: Pill,
  },
  {
    label: "Home Services",
    href: "/home-services",
    icon: Home,
  },
];

interface PatientNavSidebarProps {
  onOpenDeleteAccount?: () => void;
}

export default function PatientNavSidebar({ onOpenDeleteAccount }: PatientNavSidebarProps = {}) {
  const [activeSection, setActiveSection] = useState<string>("quick-actions");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      for (const item of DASHBOARD_SECTIONS) {
        if (item.type === "anchor") {
          const el = document.getElementById(item.id);
          if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPos >= top && scrollPos < top + height) {
              setActiveSection(item.id);
              break;
            }
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSmoothScroll = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const navOffset = 85;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveSection(id);
    }
  };

  const totalSections = DASHBOARD_SECTIONS.length;

  return (
    <aside className="cm-provider-sidebar" aria-label="My Portal Navigation">
      <div className="cm-provider-nav-widget cm-patient-sidebar-widget">
        {/* Workspace Brand Header */}
        <div className="cm-provider-nav-header">
          <div className="cm-provider-nav-badge">
            <span className="cm-provider-nav-dot" />
            <span>MY PORTAL</span>
          </div>
          <span className="cm-provider-nav-count">{totalSections} sections</span>
        </div>

        {/* Group 1: Care Services Navigation */}
        <div className="cm-provider-nav-section-title">
          <Compass size={12} />
          <span>CARE SERVICES</span>
        </div>
        <div className="cm-provider-nav-list" style={{ flex: "0 0 auto", marginBottom: 12 }}>
          {CARE_SERVICES.map((route) => {
            const IconComponent = route.icon;
            return (
              <Link
                key={route.href}
                href={route.href}
                className="cm-provider-nav-item"
              >
                <div className="cm-provider-nav-item__left">
                  <span className="cm-provider-nav-item__icon">
                    <IconComponent size={16} />
                  </span>
                  <span className="cm-provider-nav-item__label">{route.label}</span>
                </div>
                <ChevronRight size={13} style={{ color: "#64748b" }} />
              </Link>
            );
          })}
        </div>

        {/* Group 2: In-Page Dashboard Teleport */}
        <div className="cm-provider-nav-section-title">
          <Zap size={12} />
          <span>DASHBOARD SECTIONS</span>
        </div>
        <nav
          className="cm-provider-nav-list"
          role="tablist"
          aria-label="Dashboard sections"
        >
          {DASHBOARD_SECTIONS.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={item.target}
                onClick={(e) => handleSmoothScroll(e, item.id)}
                className={`cm-provider-nav-item ${isActive ? "cm-provider-nav-item--active" : ""}`}
                aria-current={isActive ? "true" : undefined}
              >
                <div className="cm-provider-nav-item__left">
                  <span className="cm-provider-nav-item__icon">
                    <IconComponent size={16} />
                  </span>
                  <span className="cm-provider-nav-item__label">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="cm-provider-nav-item__count">{item.badge}</span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Account Deletion Quick Action */}
        {onOpenDeleteAccount && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <button
              type="button"
              onClick={onOpenDeleteAccount}
              className="cm-provider-nav-item cm-provider-nav-item--danger"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 8,
                padding: "8px 10px",
                color: "#f87171",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
              title="Permanently delete your CallMedex account"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={15} style={{ color: "#ef4444" }} />
                <span>Delete Account</span>
              </div>
              <ChevronRight size={13} style={{ color: "#f87171" }} />
            </button>
          </div>
        )}

        {/* Console Status Footer */}
        <div className="cm-provider-nav-footer">
          <div className="cm-provider-nav-footer-status">
            <span className="cm-provider-status-dot" />
            <span>Patient Care Portal Active</span>
          </div>
          <div className="cm-provider-nav-footer-legal">
            <span>NABL &amp; ICMR Certified · ABDM M1/M2/M3</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
