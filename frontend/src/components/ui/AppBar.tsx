"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Bell, LogOut, User } from "./icons";
import { Button } from "./Button";

/**
 * The one bar on app routes. Replaces the marketing utility bar + public navbar
 * + footer + chat widget, which the root layout previously wrapped around every
 * dashboard — so a phlebotomist on duty saw a "Vizag's #1 Healthcare Platform"
 * badge above their dispatch board and a Careers link below it.
 */
export function AppBar({ role, userName }: { role: string; userName?: string }) {
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/auth/login");
  };

  return (
    <header className="cm-appbar">
      <a className="cm-appbar__brand" href="/">CallMedex</a>
      <span className="cm-appbar__role">{role}</span>
      <span className="cm-appbar__spacer" />
      <Button variant="ghost" iconOnly aria-label="Notifications">
        <Icon as={Bell} size={20} />
      </Button>
      {userName && (
        <span className="cm-appbar__user">
          <Icon as={User} size={16} />
          {userName}
        </span>
      )}
      <Button variant="ghost" onClick={logout}>
        <Icon as={LogOut} size={16} />
        Log out
      </Button>
    </header>
  );
}
