"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { Bell, LogOut, User, LayoutDashboard } from "./icons";
import { Button } from "./Button";
import { PatientNotificationCenter } from "@/app/components/PatientNotificationCenter";

/**
 * The one bar on app routes. Replaces the marketing utility bar + public navbar
 * + footer + chat widget, which the root layout previously wrapped around every
 * dashboard — so a phlebotomist on duty saw a "Vizag's #1 Healthcare Platform"
 * badge above their dispatch board and a Careers link below it.
 */
export function AppBar({ role, userName }: { role?: string; userName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [resolvedRole, setResolvedRole] = useState(role || "");
  const [resolvedUser, setResolvedUser] = useState(userName || "");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  const getDashboardRoute = () => {
    if (pathname?.includes("/dashboard/doctor")) return "/dashboard/doctor";
    if (pathname?.includes("/dashboard/phlebotomist")) return "/dashboard/phlebotomist";
    if (pathname?.includes("/dashboard/collection-point")) return "/dashboard/collection-point";
    if (pathname?.includes("/dashboard/organization")) return "/dashboard/organization";
    if (pathname?.includes("/dashboard/admin")) return "/dashboard/admin";
    if (pathname?.includes("/dashboard/patient")) return "/dashboard/patient";

    try {
      const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.role === "doctor") return "/dashboard/doctor";
        if (u.role === "phlebotomist") return "/dashboard/phlebotomist";
        if (u.role === "collection_point") return "/dashboard/collection-point";
        if (u.role === "organization") return "/dashboard/organization";
        if (u.role === "admin") return "/dashboard/admin";
      }
    } catch {}
    return "/dashboard/patient";
  };

  const handleBrandClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(getDashboardRoute());
  };

  useEffect(() => {
    if (role) {
      setResolvedRole(role);
      return;
    }

    try {
      if (pathname?.includes("/dashboard/doctor")) {
        setResolvedRole("Workstation Dashboard");
      } else if (pathname?.includes("/dashboard/organization")) {
        setResolvedRole("Organization Console");
      } else if (pathname?.includes("/dashboard/patient")) {
        setResolvedRole("Patient Portal");
      }

      const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (userStr) {
        const u = JSON.parse(userStr);
        if (!userName && u.full_name) {
          setResolvedUser(u.full_name);
        }
        if (!role && !pathname?.includes("/dashboard/doctor") && u.role) {
          setResolvedRole(`${u.role.charAt(0).toUpperCase() + u.role.slice(1)} Dashboard`);
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }, [role, userName, pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/auth/login");
  };

  const isPatientRoute = pathname?.includes("/dashboard/patient");

  return (
    <header className="cm-appbar">
      <a className="cm-appbar__brand" href={getDashboardRoute()} onClick={handleBrandClick}>
        CallMedex
      </a>
      {resolvedRole && <span className="cm-appbar__role">{resolvedRole}</span>}
      <span className="cm-appbar__spacer" />
      <div className="cm-appbar__notification-wrap">
        <Button
          variant="ghost"
          iconOnly
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          onClick={() => setIsNotificationsOpen(true)}
        >
          <Icon as={Bell} size={20} />
          {unreadCount > 0 && (
            <span className="cm-appbar__badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </div>

      <PatientNotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onUnreadCountChange={(count) => setUnreadCount(count)}
        role={resolvedRole}
      />

      {resolvedUser && (
        <span className="cm-appbar__user">
          <Icon as={User} size={16} />
          {resolvedUser}
        </span>
      )}
      <Button
        variant="ghost"
        className={`cm-appbar__patient-nav ${isPatientRoute ? "cm-appbar__patient-nav--active" : ""}`}
        onClick={() => router.push("/dashboard/patient")}
        aria-label="Patient Dashboard"
      >
        <Icon as={LayoutDashboard} size={16} />
        Patient Dashboard
      </Button>
      <Button variant="ghost" onClick={logout}>
        <Icon as={LogOut} size={16} />
        Log out
      </Button>
    </header>
  );
}

