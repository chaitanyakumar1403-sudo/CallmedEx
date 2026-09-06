"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package, FlaskConical, Stethoscope, Pill, Activity, Box,
  Sparkles, Zap, ScanLine, Smile, Users, Calendar, ChevronRight,
  Clock, HeartPulse, Compass, ShieldCheck
} from "@/components/ui/icons";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  type: "anchor" | "route";
  target: string;
  badge?: string;
  accentClass: string;
}

const NAV_ITEMS: NavItem[] = [
  // ── In-Page Sections (Smooth Teleport) ──
  {
    id: "sample-tracking",
    label: "Sample Tracking",
    icon: Activity,
    type: "anchor",
    target: "#sample-tracking",
    badge: "Live",
    accentClass: "cm-nav-item--sky",
  },
  {
    id: "interactive-twin",
    label: "Interactive 3D Twin",
    icon: Box,
    type: "anchor",
    target: "#interactive-twin",
    badge: "3D",
    accentClass: "cm-nav-item--cyan",
  },
  {
    id: "ai-health-advisor",
    label: "AI Health Advisor",
    icon: Sparkles,
    type: "anchor",
    target: "#ai-health-advisor",
    badge: "AI",
    accentClass: "cm-nav-item--indigo",
  },
  {
    id: "medicine-cabinet",
    label: "Medicine Cabinet",
    icon: Clock,
    type: "anchor",
    target: "#medicine-cabinet",
    accentClass: "cm-nav-item--teal",
  },
  {
    id: "quick-actions",
    label: "Quick Actions",
    icon: Zap,
    type: "anchor",
    target: "#quick-actions",
    accentClass: "cm-nav-item--blue",
  },
  {
    id: "radiology-diagnostics",
    label: "Radiology & Scans",
    icon: ScanLine,
    type: "anchor",
    target: "#radiology-diagnostics",
    accentClass: "cm-nav-item--navy",
  },
  {
    id: "dental-clinics",
    label: "Dental & Oral Care",
    icon: Smile,
    type: "anchor",
    target: "#dental-clinics",
    badge: "Walk-in",
    accentClass: "cm-nav-item--ocean",
  },
  {
    id: "family-circle",
    label: "Family Care Circle",
    icon: Users,
    type: "anchor",
    target: "#family-circle",
    accentClass: "cm-nav-item--slate",
  },
  {
    id: "recent-bookings",
    label: "Recent Bookings",
    icon: Calendar,
    type: "anchor",
    target: "#recent-bookings",
    accentClass: "cm-nav-item--steel",
  },
];

const SERVICE_ROUTES = [
  {
    label: "Health Packages",
    href: "/packages",
    icon: Package,
    accentClass: "cm-nav-item--sky",
  },
  {
    label: "Book a Test",
    href: "/diagnostics",
    icon: FlaskConical,
    accentClass: "cm-nav-item--cyan",
  },
  {
    label: "Consultation",
    href: "/consultation",
    icon: Stethoscope,
    accentClass: "cm-nav-item--indigo",
  },
  {
    label: "Online Pharmacy",
    href: "/pharmacy",
    icon: Pill,
    accentClass: "cm-nav-item--teal",
  },
];

export default function PatientNavSidebar() {
  const [activeSection, setActiveSection] = useState<string>("sample-tracking");
  const [collapsedMobile, setCollapsedMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      for (const item of NAV_ITEMS) {
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

  return (
    <nav className="cm-patient-sidebar-widget" aria-label="Patient Dashboard Navigator">
      {/* Widget Header with CallMedex Branding */}
      <div className="cm-sidebar-header">
        <div className="cm-sidebar-brand-badge">
          <div className="cm-brand-3d-pulse-container" title="CallMedex Care Pulse">
            <Clinical3DIcon name="care-pulse" size={24} className="cm-brand-3d-icon-base" />
            <div className="cm-brand-3d-icon-ping" aria-hidden="true">
              <Clinical3DIcon name="care-pulse" size={24} />
            </div>
          </div>
          <span className="cm-sidebar-brand-text">CallMedex Care</span>
        </div>
        <span className="cm-sidebar-tagline">Quick Navigator</span>
      </div>

      {/* Group 1: Direct Services Navigation */}
      <div className="cm-sidebar-group">
        <div className="cm-sidebar-group-title">
          <Compass size={13} />
          <span>Care Services</span>
        </div>
        <div className="cm-sidebar-nav-list">
          {SERVICE_ROUTES.map((route) => {
            const IconComponent = route.icon;
            return (
              <Link
                key={route.href}
                href={route.href}
                className={`cm-sidebar-nav-btn ${route.accentClass}`}
              >
                <span className="cm-sidebar-nav-icon">
                  <IconComponent size={16} />
                </span>
                <span className="cm-sidebar-nav-label">{route.label}</span>
                <ChevronRight size={13} className="cm-sidebar-nav-arrow" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="cm-sidebar-divider" />

      {/* Group 2: Dashboard Sections Jump */}
      <div className="cm-sidebar-group">
        <div className="cm-sidebar-group-title">
          <Activity size={13} />
          <span>Dashboard Sections</span>
        </div>
        <div className="cm-sidebar-nav-list">
          {NAV_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={item.target}
                onClick={(e) => handleSmoothScroll(e, item.id)}
                className={`cm-sidebar-nav-btn ${item.accentClass} ${isActive ? "cm-sidebar-nav-btn--active" : ""}`}
                aria-current={isActive ? "true" : undefined}
              >
                <span className="cm-sidebar-nav-icon">
                  <IconComponent size={16} />
                </span>
                <span className="cm-sidebar-nav-label">{item.label}</span>
                {item.badge && (
                  <span className="cm-sidebar-nav-badge">{item.badge}</span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      {/* Patient Security Footer Badge */}
      <div className="cm-sidebar-security-badge">
        <ShieldCheck size={14} />
        <span>NABL &amp; ICMR Certified Care</span>
      </div>
    </nav>
  );
}
