"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { Bell, LogOut, User } from "./icons";
import { Button } from "./Button";

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

  return (
    <header className="cm-appbar">
      <a className="cm-appbar__brand" href="/">CallMedex</a>
      {resolvedRole && <span className="cm-appbar__role">{resolvedRole}</span>}
      <span className="cm-appbar__spacer" />
      <Button variant="ghost" iconOnly aria-label="Notifications">
        <Icon as={Bell} size={20} />
      </Button>
      {resolvedUser && (
        <span className="cm-appbar__user">
          <Icon as={User} size={16} />
          {resolvedUser}
        </span>
      )}
      <Button variant="ghost" onClick={logout}>
        <Icon as={LogOut} size={16} />
        Log out
      </Button>
    </header>
  );
}

