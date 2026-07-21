"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface UserData {
  full_name: string;
  role: string;
}

export default function SmartNavbar() {
  const [user, setUser] = useState<UserData | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { setUser(null); }
    }
  }, [pathname]); // Re-check on every page navigation

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/auth/login";
  };

  const getDashboardLink = () => {
    if (!user) return "/";
    return `/dashboard/${user.role}`;
  };

  const roleLabel: Record<string, string> = {
    patient: "Patient",
    doctor: "Doctor",
    organization: "Organization",
    phlebotomist: "Phlebotomist",
    admin: "Admin",
    supervisor: "Supervisor",
    staff: "Staff",
  };

  return (
    <nav className="navbar">
      <div className="container">
        <a href={getDashboardLink()} className="navbar__logo" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="CallMedex Logo" style={{ height: '55px', width: 'auto', objectFit: 'contain' }} />
        </a>
        <ul className="navbar__nav">
          <li><a href="/about">About</a></li>
          {(!user || user.role === "patient") && (
            <>
              <li><a href="/search">Find Hospitals</a></li>
              <li><a href="/health-packages">Health Packages</a></li>
              <li><a href="/diagnostics">Diagnostics</a></li>
              <li><a href="/consultation">Consultation</a></li>
              <li><a href="/pharmacy">Pharmacy</a></li>
            </>
          )}
        </ul>
        <div className="navbar__actions">
          {user ? (
            <>
              <a href={getDashboardLink()} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.75rem', backgroundColor: '#38a169', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                  {roleLabel[user.role] || user.role}
                </span>
                {user.full_name.split(' ')[0]}
              </a>
              <button onClick={handleLogout} className="btn btn-primary btn-sm" style={{ backgroundColor: '#e53e3e', borderColor: '#e53e3e' }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <a href="/auth/login" className="btn btn-secondary btn-sm">Login</a>
              <a href="/auth/signup" className="btn btn-primary btn-sm">Sign Up</a>
            </>
          )}
        </div>
        <button className="navbar__hamburger" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
}
