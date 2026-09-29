"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  CheckCheck,
  X,
  Calendar,
  Truck,
  Pill,
  Activity,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";

export type NotificationCategory = "all" | "visit" | "tracking" | "medication" | "biomarker";

export interface PatientNotification {
  id: string;
  title: string;
  message: string;
  category: "visit" | "tracking" | "medication" | "biomarker";
  time: string;
  timestamp: number;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  priority?: "urgent" | "high" | "normal";
}

interface RawNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  status?: string;
  created_at?: string;
}

const PROACTIVE_PATIENT_NOTIFICATIONS: PatientNotification[] = [
  {
    id: "proactive-visit-1",
    title: "Video Teleconsultation Confirmed",
    message:
      "Your assigned Consultant Cardiologist is ready for your follow-up consultation today at 04:30 PM. Digital consultation room is provisioned with high-definition audio/video.",
    category: "visit",
    time: "10 mins ago",
    timestamp: Date.now() - 10 * 60 * 1000,
    read: false,
    actionLabel: "Join Video Room",
    actionHref: "/consultation",
    priority: "urgent",
  },
  {
    id: "proactive-track-1",
    title: "Phlebotomist En Route (1.2 km away)",
    message:
      "Certified CallMedex Phlebotomist is en route with your pre-calibrated cold-chain collection kit (3.8°C verified). Please maintain 10-hour fasting for lipid evaluation.",
    category: "tracking",
    time: "24 mins ago",
    timestamp: Date.now() - 24 * 60 * 1000,
    read: false,
    actionLabel: "Track Sample Live",
    actionHref: "#sample-tracking",
    priority: "high",
  },
  {
    id: "proactive-med-1",
    title: "Smart Medication Dose Reminder",
    message:
      "Scheduled evening regimen: Metformin 500mg due at 09:00 PM. Take with a full glass of water after dinner. Adherence streak: 14 days active.",
    category: "medication",
    time: "1 hour ago",
    timestamp: Date.now() - 60 * 60 * 1000,
    read: false,
    actionLabel: "View Medicine Cabinet",
    actionHref: "#medicine-cabinet",
    priority: "normal",
  },
  {
    id: "proactive-bio-1",
    title: "Quarterly HbA1c Biomarker Assessment Due",
    message:
      "Your preventive cardiometabolic care plan recommends a 90-day HbA1c review to optimize insulin sensitivity targets. Doorstep sample collection is covered under your care plan.",
    category: "biomarker",
    time: "3 hours ago",
    timestamp: Date.now() - 3 * 3600 * 1000,
    read: true,
    actionLabel: "Schedule Home Test",
    actionHref: "/diagnostics",
    priority: "normal",
  },
  {
    id: "proactive-med-2",
    title: "Digital Prescription Refill Provisioned",
    message:
      "Dr. Latchireddi SA Naidu signed your cardiorespiratory refill. 1-click doorstep delivery with verified pharmaceutical dispensing is ready via Sri Visakha Medicals Visakhapatnam.",
    category: "medication",
    time: "Yesterday",
    timestamp: Date.now() - 24 * 3600 * 1000,
    read: true,
    actionLabel: "Order Doorstep Refill",
    actionHref: "/pharmacy",
    priority: "normal",
  },
];

const PROACTIVE_DOCTOR_NOTIFICATIONS: PatientNotification[] = [
  {
    id: "proactive-doc-1",
    title: "Virtual Teleconsultation Room Ready",
    message:
      "Your virtual consultation waiting room is provisioned with high-definition video and AI-assisted SOAP clinical charting. Check in when ready for patient intake.",
    category: "visit",
    time: "5 mins ago",
    timestamp: Date.now() - 5 * 60 * 1000,
    read: false,
    actionLabel: "Enter Workstation",
    actionHref: "/dashboard/doctor",
    priority: "urgent",
  },
  {
    id: "proactive-doc-2",
    title: "Walk-in Roster Synced — Visakha Multispeciality Clinics",
    message:
      "Affiliated clinic schedule confirmed: 12 weekly walk-in consultation blocks active (Mon–Sat 09:30–12:00, 19:00–21:00). Patient appointments are routed directly to reception OPD.",
    category: "tracking",
    time: "30 mins ago",
    timestamp: Date.now() - 30 * 60 * 1000,
    read: false,
    actionLabel: "Manage Practice Roster",
    actionHref: "/dashboard/doctor",
    priority: "high",
  },
  {
    id: "proactive-doc-3",
    title: "NMC Digital Verification Active",
    message:
      "Dr. Latchireddi Sa Naidu — Medical registration and credentials verified under NMC 2026 digital registry. Autonomous practice tariffs and BIS generic e-prescriptions active.",
    category: "biomarker",
    time: "2 hours ago",
    timestamp: Date.now() - 2 * 3600 * 1000,
    read: true,
    actionLabel: "View Credentials",
    actionHref: "/dashboard/doctor",
    priority: "normal",
  },
];

const PROACTIVE_ORG_NOTIFICATIONS: PatientNotification[] = [
  {
    id: "proactive-org-1",
    title: "Affiliated Doctor Schedule Synced",
    message:
      "Dr. Latchireddi Sa Naidu (Cardiology) has 12 active weekly walk-in consultation blocks registered for your facility reception OPD.",
    category: "visit",
    time: "15 mins ago",
    timestamp: Date.now() - 15 * 60 * 1000,
    read: false,
    actionLabel: "View Linked Doctors",
    actionHref: "/dashboard/organization",
    priority: "high",
  },
  {
    id: "proactive-org-2",
    title: "Facility Scope & Services Active",
    message:
      "Your clinical services and walk-in consultation tariffs are live on CallMedex patient discovery network.",
    category: "tracking",
    time: "1 hour ago",
    timestamp: Date.now() - 60 * 60 * 1000,
    read: true,
    actionLabel: "Review Services",
    actionHref: "/dashboard/organization",
    priority: "normal",
  },
];

const PROACTIVE_PC_NOTIFICATIONS: PatientNotification[] = [
  {
    id: "proactive-pc-1",
    title: "Specimen In Transit (Barcode CMX-882194)",
    message:
      "Certified Field Phlebotomist is en route to intake desk with fasting venous blood sample (Visakhapatnam, 3.8°C verified cold box). Expected arrival in ~20 mins.",
    category: "tracking",
    time: "10 mins ago",
    timestamp: Date.now() - 10 * 60 * 1000,
    read: false,
    actionLabel: "Open Intake Desk",
    actionHref: "/dashboard/processing-center?tab=intake",
    priority: "urgent",
  },
  {
    id: "proactive-pc-2",
    title: "New Home Collection Booking Accepted",
    message:
      "Patient booked Complete Blood Count & Fasting Lipid Profile in Visakhapatnam. Assigned on-duty phlebotomist confirmed doorstep collection block for today.",
    category: "visit",
    time: "25 mins ago",
    timestamp: Date.now() - 25 * 60 * 1000,
    read: false,
    actionLabel: "View Laboratory Queue",
    actionHref: "/dashboard/processing-center?tab=queue",
    priority: "high",
  },
  {
    id: "proactive-pc-3",
    title: "Intake 5-Point Quality Check Queue",
    message:
      "Incoming sample tubes awaiting barcode scan, hemolysis check, label integrity, and temperature confirmation before batch registration.",
    category: "biomarker",
    time: "45 mins ago",
    timestamp: Date.now() - 45 * 60 * 1000,
    read: false,
    actionLabel: "Verify Intake Samples",
    actionHref: "/dashboard/processing-center?tab=intake",
    priority: "normal",
  },
  {
    id: "proactive-pc-4",
    title: "Analyzer Interface & LIMS Bridge Synced",
    message:
      "Kriya AI / MediAssist LIMS integration channel online. Ready for batch result ingestion, report verification, and patient delivery.",
    category: "medication",
    time: "2 hours ago",
    timestamp: Date.now() - 2 * 3600 * 1000,
    read: true,
    actionLabel: "Lab Testing & Reports",
    actionHref: "/dashboard/processing-center?tab=testing",
    priority: "normal",
  },
];


function relativeTime(iso?: string): string {
  if (!iso) return "recently";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const KNOWN_ROLES = new Set([
  "patient", "doctor", "dentist", "dietitian", "physiotherapist", "nurse",
  "phlebotomist", "pharmacy", "organization", "staff", "admin", "supervisor",
  "processing_center", "collection_point",
]);
/* Roles that keep the bespoke alert copy + proactive demo feeds above. */
const LEGACY_ROLES = new Set(["patient", "doctor", "organization", "processing_center"]);

function normalizeRole(raw: string): string {
  const r = raw.toLowerCase().trim().replace(/-/g, "_");
  return KNOWN_ROLES.has(r) ? r : "";
}

function roleFromLabel(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("processing") || r.includes("center") || r.includes("lab")) return "processing_center";
  if (r.includes("doctor") || r.includes("workstation")) return "doctor";
  if (r.includes("organization") || r.includes("console")) return "organization";
  if (r.includes("patient") || r.includes("portal")) return "patient";
  for (const k of KNOWN_ROLES) if (r.includes(k)) return k;
  return "";
}

function mapRawNotification(row: RawNotification, neutral = false): PatientNotification {
  const data = row.data || {};
  let category: PatientNotification["category"] = "visit";
  let actionLabel = "View Details";
  let actionHref: string | undefined = undefined;

  if (data.dispatch_id || String(row.title).toLowerCase().includes("sample") || String(row.title).toLowerCase().includes("phlebotomist")) {
    category = "tracking";
    actionLabel = "Track Phlebotomist";
    actionHref = "#sample-tracking";
  } else if (String(row.title).toLowerCase().includes("medication") || String(row.title).toLowerCase().includes("dose") || String(row.title).toLowerCase().includes("refill")) {
    category = "medication";
    actionLabel = "Open Medicine Cabinet";
    actionHref = "#medicine-cabinet";
  } else if (String(row.title).toLowerCase().includes("biomarker") || String(row.title).toLowerCase().includes("lab") || String(row.title).toLowerCase().includes("test")) {
    category = "biomarker";
    actionLabel = "Review Biomarkers";
    actionHref = "/diagnostics";
  } else {
    category = "visit";
    actionLabel = "Join Room";
    actionHref = "/consultation";
  }

  // Other roles (phlebotomist, nurse, ...) must not get patient-only CTAs.
  if (neutral) {
    actionHref = undefined;
    actionLabel = "";
  }

  return {
    id: row.id,
    title: row.title,
    message: row.body,
    category,
    time: relativeTime(row.created_at),
    timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    read: row.status === "read",
    actionLabel: actionLabel || undefined,
    actionHref,
    priority: "normal",
  };
}

interface PatientNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  role?: string;
}

export function PatientNotificationCenter({
  isOpen,
  onClose,
  onUnreadCountChange,
  role,
}: PatientNotificationCenterProps) {
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const detectedRole = (() => {
    // 1. /dashboard/<segment>  2. stored user.role  3. role prop  4. patient
    const seg = /^\/dashboard\/([^/?#]+)/.exec(pathname || "")?.[1] || "";
    const fromPath = normalizeRole(seg);
    if (fromPath) return fromPath;
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      const fromUser = normalizeRole(String(u.role || ""));
      if (fromUser) return fromUser;
    } catch {
      // ignore
    }
    return roleFromLabel(role || "") || "patient";
  })();
  const isLegacyRole = LEGACY_ROLES.has(detectedRole);
  const ownDashboard =
    detectedRole === "processing_center"
      ? "/dashboard/processing-center"
      : `/dashboard/${detectedRole.replace(/_/g, "-")}`;

  // Lock page scroll while the sheet is open; restore whatever was there.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Fetch notifications or populate realistic proactive notifications
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const storedReadIds = JSON.parse(localStorage.getItem("cm_read_notifications") || "[]");
        let fetchedItems: PatientNotification[] = [];

        try {
          const res = await api.get<{ notifications: RawNotification[] }>(
            "/communications/notifications?limit=30"
          );
          if (res && res.notifications && res.notifications.length > 0) {
            fetchedItems = res.notifications.map((r) => mapRawNotification(r, !isLegacyRole));
          }
        } catch {
          // Backend offline or user unauthenticated: fallback to proactive clinical alerts
        }

        if (cancelled) return;

        // Role-based filtering to eliminate cross-role pollution
        let roleFiltered = fetchedItems;
        if (detectedRole === "doctor") {
          roleFiltered = fetchedItems.filter(
            (item) =>
              item.category !== "tracking" &&
              !item.title.toLowerCase().includes("medication dose") &&
              !item.title.toLowerCase().includes("phlebotomist") &&
              !item.message.toLowerCase().includes("metformin") &&
              !item.message.toLowerCase().includes("fasting")
          );
        } else if (detectedRole === "organization") {
          roleFiltered = fetchedItems.filter(
            (item) =>
              !item.title.toLowerCase().includes("medication dose") &&
              !item.title.toLowerCase().includes("phlebotomist") &&
              !item.message.toLowerCase().includes("metformin")
          );
        } else if (detectedRole === "processing_center") {
          roleFiltered = fetchedItems.filter(
            (item) =>
              !item.title.toLowerCase().includes("teleconsultation") &&
              !item.title.toLowerCase().includes("medication dose") &&
              !item.title.toLowerCase().includes("opd") &&
              !item.message.toLowerCase().includes("metformin")
          );
        }

        const proactiveList =
          detectedRole === "processing_center"
            ? PROACTIVE_PC_NOTIFICATIONS
            : detectedRole === "doctor"
            ? PROACTIVE_DOCTOR_NOTIFICATIONS
            : detectedRole === "organization"
            ? PROACTIVE_ORG_NOTIFICATIONS
            : detectedRole === "patient"
            ? PROACTIVE_PATIENT_NOTIFICATIONS
            : [];

        // Merge with role-appropriate proactive alerts
        const allItems = [...roleFiltered];
        for (const item of proactiveList) {
          if (!allItems.some((existing) => existing.id === item.id)) {
            allItems.push(item);
          }
        }


        // Apply local read overrides
        const finalItems = allItems.map((item) => ({
          ...item,
          read: item.read || storedReadIds.includes(item.id),
        }));

        setNotifications(finalItems);
        const unread = finalItems.filter((n) => !n.read).length;
        if (onUnreadCountChange) {
          onUnreadCountChange(unread);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (isOpen) {
      load();
    } else {
      // Background count check
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, onUnreadCountChange, detectedRole, isLegacyRole]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    if (onUnreadCountChange) onUnreadCountChange(0);

    const readIds = updated.map((n) => n.id);
    localStorage.setItem("cm_read_notifications", JSON.stringify(readIds));

    try {
      await api.post("/communications/notifications/read-all");
    } catch {
      // Non-blocking sync
    }
  };

  // Toggle single notification read
  const handleToggleRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = notifications.map((n) => {
      if (n.id === id) {
        return { ...n, read: !n.read };
      }
      return n;
    });
    setNotifications(updated);
    const unread = updated.filter((n) => !n.read).length;
    if (onUnreadCountChange) onUnreadCountChange(unread);

    const storedReadIds: string[] = JSON.parse(localStorage.getItem("cm_read_notifications") || "[]");
    const target = updated.find((n) => n.id === id);
    if (target?.read) {
      if (!storedReadIds.includes(id)) storedReadIds.push(id);
      try {
        await api.post(`/communications/notifications/${id}/read`);
      } catch {
        // Non-blocking
      }
    } else {
      const idx = storedReadIds.indexOf(id);
      if (idx > -1) storedReadIds.splice(idx, 1);
    }
    localStorage.setItem("cm_read_notifications", JSON.stringify(storedReadIds));
  };

  // Handle CTA Action Click
  const handleActionClick = (actionHref?: string) => {
    if (!actionHref) return;
    onClose();

    if (actionHref.startsWith("#")) {
      const targetId = actionHref.substring(1);
      const targetElem = document.getElementById(targetId);
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // If not on the patient dashboard, navigate with hash (patient only)
        if (detectedRole === "patient") router.push(`/dashboard/patient${actionHref}`);
      }
    } else {
      router.push(actionHref);
    }
  };

  if (!isOpen || !mounted) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (activeCategory === "all") return true;
    return item.category === activeCategory;
  });

  const unreadTotal = notifications.filter((n) => !n.read).length;

  const getCategoryIcon = (category: PatientNotification["category"]) => {
    switch (category) {
      case "visit":
        return <Calendar size={18} />;
      case "tracking":
        return <Truck size={18} />;
      case "medication":
        return <Pill size={18} />;
      case "biomarker":
        return <Activity size={18} />;
      default:
        return <Bell size={18} />;
    }
  };

  return createPortal(
    <div
      className="cm-notification-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cm-notification-title"
    >
      <div className="cm-notification-panel" ref={modalRef}>
        <span className="cm-notification-grab" aria-hidden="true" />
        {/* Specular Ambient Glow Banner */}
        <div className="cm-notification-header">
          <div className="cm-notification-header__title-group">
            <div className="cm-notification-header__icon-bubble">
              <Bell size={20} />
              {unreadTotal > 0 && <span className="cm-notification-header__pulse-dot" />}
            </div>
            <div>
              <h2 id="cm-notification-title" className="cm-notification-header__title">
                {detectedRole === "processing_center"
                  ? "Diagnostic Processing Centre Operations"
                  : detectedRole === "doctor"
                  ? "Doctor Clinical Alert & Roster Center"
                  : detectedRole === "organization"
                  ? "Organization Operations Center"
                  : detectedRole === "patient"
                  ? "Patient Notification Center"
                  : "Notifications"}
              </h2>
              <p className="cm-notification-header__subtitle">
                {detectedRole === "processing_center"
                  ? "Lab specimen intake alerts, transit telemetry, batch manifests & quality verification"
                  : detectedRole === "doctor"
                  ? "Practice queue alerts, consultation requests, roster sync & clinical updates"
                  : detectedRole === "organization"
                  ? "Facility bookings, affiliated doctor availability & diagnostic queues"
                  : detectedRole === "patient"
                  ? "Clinical care alerts, cold-chain tracking, and proactive reminders"
                  : "Alerts and updates for your workspace"}
              </p>
            </div>
          </div>

          <div className="cm-notification-header__actions">
            {unreadTotal > 0 && (
              <button
                type="button"
                className="cm-notification-btn-text"
                onClick={handleMarkAllRead}
                aria-label="Mark all notifications as read"
              >
                <CheckCheck size={16} />
                <span className="cm-notification-btn-text__label">Mark all read</span>
              </button>
            )}
            <button
              type="button"
              className="cm-notification-btn-close"
              onClick={onClose}
              aria-label="Close notification center"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <div className="cm-notification-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            className={`cm-notification-tab ${activeCategory === "all" ? "cm-notification-tab--active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All Alerts
            {unreadTotal > 0 && <span className="cm-notification-pill">{unreadTotal}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "visit"}
            className={`cm-notification-tab ${activeCategory === "visit" ? "cm-notification-tab--active" : ""}`}
            onClick={() => setActiveCategory("visit")}
          >
            <Calendar size={14} />
            {detectedRole === "processing_center" ? "City Bookings" : detectedRole === "doctor" ? "Consultations" : detectedRole === "organization" ? "Appointments" : detectedRole === "patient" ? "Visits & Consults" : "Appointments"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "tracking"}
            className={`cm-notification-tab ${activeCategory === "tracking" ? "cm-notification-tab--active" : ""}`}
            onClick={() => setActiveCategory("tracking")}
          >
            <Truck size={14} />
            {detectedRole === "processing_center" ? "Transit & Intake" : detectedRole === "doctor" ? "Roster Sync" : detectedRole === "organization" ? "Doctor Roster" : detectedRole === "patient" ? "Sample Tracking" : "Tracking"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "medication"}
            className={`cm-notification-tab ${activeCategory === "medication" ? "cm-notification-tab--active" : ""}`}
            onClick={() => setActiveCategory("medication")}
          >
            <Pill size={14} />
            {detectedRole === "processing_center" ? "Batches & LIMS" : detectedRole === "doctor" ? "e-Prescriptions" : detectedRole === "organization" ? "Services" : detectedRole === "patient" ? "Medications" : "Orders & Rx"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "biomarker"}
            className={`cm-notification-tab ${activeCategory === "biomarker" ? "cm-notification-tab--active" : ""}`}
            onClick={() => setActiveCategory("biomarker")}
          >
            <Activity size={14} />
            {detectedRole === "processing_center" ? "QA & Reports" : detectedRole === "doctor" ? "Credentials" : detectedRole === "organization" ? "Facility" : detectedRole === "patient" ? "Biomarkers & Care" : "Updates"}
          </button>
        </div>

        {/* Notification Stream */}
        <div className="cm-notification-list">
          {filteredNotifications.length === 0 ? (
            <div className="cm-notification-empty">
              <div className="cm-notification-empty__icon">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="cm-notification-empty__title">All caught up!</h3>
              <p className="cm-notification-empty__text">
                {detectedRole === "doctor"
                  ? "No pending practice alerts in this category. Your consultation queue and credentials are up to date."
                  : detectedRole === "organization"
                  ? "No active alerts in this category. Facility schedules and appointments are up to date."
                  : detectedRole === "patient"
                  ? "No active notifications in this category. Your appointments, prescriptions, and health records are up to date."
                  : "No notifications in this category right now."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`cm-notification-card ${!n.read ? "cm-notification-card--unread" : ""} cm-notification-card--${n.category}`}
              >
                <div className="cm-notification-card__left">
                  <div className={`cm-notification-card__icon cm-notification-card__icon--${n.category}`}>
                    {getCategoryIcon(n.category)}
                  </div>
                </div>

                <div className="cm-notification-card__content">
                  <div className="cm-notification-card__top">
                    <div className="cm-notification-card__title-row">
                      <span className="cm-notification-card__title">{n.title}</span>
                      {!n.read && <span className="cm-notification-badge-new">NEW</span>}
                    </div>
                    <span className="cm-notification-card__time">
                      <Clock size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                      {n.time}
                    </span>
                  </div>

                  <p className="cm-notification-card__message">{n.message}</p>

                  <div className="cm-notification-card__bottom">
                    {n.actionLabel && n.actionHref && (
                      <button
                        type="button"
                        className="cm-notification-cta-btn"
                        onClick={() => handleActionClick(n.actionHref)}
                      >
                        <span>{n.actionLabel}</span>
                        <ArrowRight size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="cm-notification-toggle-read"
                      onClick={(e) => handleToggleRead(n.id, e)}
                    >
                      {n.read ? "Mark as unread" : "Mark as read"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Quick Action Bar */}
        <div className="cm-notification-footer">
          <div className="cm-notification-footer__telemetry">
            <Sparkles size={14} />
            <span>
              {detectedRole === "processing_center"
                ? "LIMS Telemetry — Specimen Intake, Barcodes & Diagnostic Pipeline Active"
                : detectedRole === "doctor"
                ? "Workstation Telemetry — Real-time Practice Queue & NMC e-Rx Active"
                : detectedRole === "organization"
                ? "Operations Telemetry — Reception OPD & Walk-in Queue Active"
                : detectedRole === "patient"
                ? "AI Care Engine — Continuous Health Guardian Active"
                : "Live updates active for your workspace"}
            </span>
          </div>
          <button
            type="button"
            className="cm-notification-footer__btn"
            onClick={() => {
              if (detectedRole === "processing_center") {
                handleActionClick("/dashboard/processing-center");
              } else if (detectedRole === "doctor") {
                handleActionClick("/dashboard/doctor");
              } else if (detectedRole === "organization") {
                handleActionClick("/dashboard/organization");
              } else if (detectedRole === "patient") {
                handleActionClick("#sample-tracking");
              } else {
                handleActionClick(ownDashboard);
              }
            }}
          >
            <span>
              {detectedRole === "processing_center"
                ? "Processing Console"
                : detectedRole === "doctor"
                ? "Open Workstation"
                : detectedRole === "organization"
                ? "Manage Roster"
                : detectedRole === "patient"
                ? "Track Phlebotomist"
                : "Open Dashboard"}
            </span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default PatientNotificationCenter;
