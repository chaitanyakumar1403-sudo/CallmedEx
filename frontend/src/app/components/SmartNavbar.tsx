"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCircle2, Clock, MapPin, DollarSign, X, Menu, User as UserIcon, LogOut } from "lucide-react";

interface UserData {
  full_name: string;
  role: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "booking" | "dispatch" | "payout";
  read: boolean;
}

export default function SmartNavbar() {
  const [user, setUser] = useState<UserData | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "n1",
      title: "New Teleconsultation Booked",
      message: "Priya Sharma (UHID-89412) booked a video consult for 10:30 AM.",
      time: "5m ago",
      type: "booking",
      read: false,
    },
    {
      id: "n2",
      title: "Doorstep Dispatch Update",
      message: "Phlebotomist assigned for home sample collection in MVP Colony.",
      time: "25m ago",
      type: "dispatch",
      read: false,
    },
    {
      id: "n3",
      title: "80% Net Payout Settled",
      message: "Bank settlement of ₹3,840 processed for today's completed consults.",
      time: "1h ago",
      type: "payout",
      read: true,
    },
  ]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, [pathname]);

  // Close mobile menu on page change
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowNotifications(false);
  }, [pathname]);

  // Click outside to close notification dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/auth/login";
  };

  const getDashboardLink = () => {
    if (!user) return "/";
    const slug = user.role === "processing_center" ? "processing-center" : user.role;
    return `/dashboard/${slug}`;
  };

  const roleLabel: Record<string, string> = {
    patient: "Patient",
    doctor: "Doctor",
    nurse: "Nurse",
    dietitian: "Dietitian",
    physiotherapist: "Physiotherapist",
    organization: "Organization",
    pharmacy: "Pharmacy",
    phlebotomist: "Phlebotomist",
    admin: "Admin",
    supervisor: "Supervisor",
    staff: "Staff",
    processing_center: "Diagnostic Centre",
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  return (
    <nav className="navbar" style={{ position: "relative" }}>
      <div className="container">
        <Link href={getDashboardLink()} className="navbar__logo" style={{ display: "flex", alignItems: "center" }}>
          <img src="/logo.png" alt="CallMedex Logo" style={{ height: "55px", width: "auto", objectFit: "contain" }} />
        </Link>
        <ul className="navbar__nav">
          <li><Link href="/about">About</Link></li>
          <li><Link href="/packages">Health Packages</Link></li>
          {(!user || user.role === "patient") && (
            <>
              <li><Link href="/diagnostics">Book a Test</Link></li>
              <li><Link href="/consultation">Consultation</Link></li>
              <li><Link href="/pharmacy">Pharmacy</Link></li>
            </>
          )}
        </ul>
        <div className="navbar__actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user ? (
            <>
              {/* Notification Bell with Live Unread Badge */}
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "8px",
                    padding: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#f8fafc",
                    position: "relative",
                    minWidth: "40px",
                    minHeight: "40px",
                  }}
                  aria-label="View notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        background: "var(--cm-urgent)",
                        color: "#ffffff",
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid #0f172a",
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Modal */}
                {showNotifications && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 10px)",
                      width: "340px",
                      background: "#ffffff",
                      borderRadius: "14px",
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)",
                      border: "1px solid var(--cm-line)",
                      zIndex: 100,
                      overflow: "hidden",
                      color: "var(--cm-ink)",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 16px",
                        background: "var(--cm-navy)",
                        color: "#ffffff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Notifications</span>
                        {unreadCount > 0 && (
                          <span
                            style={{
                              background: "var(--cm-urgent)",
                              color: "#ffffff",
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "999px",
                            }}
                          >
                            {unreadCount} New
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid var(--cm-line)",
                            background: n.read ? "#ffffff" : "var(--cm-surface-2)",
                            display: "flex",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              background:
                                n.type === "booking"
                                  ? "var(--cm-active-surface)"
                                  : n.type === "dispatch"
                                  ? "var(--cm-done-surface)"
                                  : "var(--cm-waiting-surface)",
                              color:
                                n.type === "booking"
                                  ? "var(--cm-active)"
                                  : n.type === "dispatch"
                                  ? "var(--cm-done)"
                                  : "var(--cm-waiting)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {n.type === "booking" ? (
                              <Clock size={16} />
                            ) : n.type === "dispatch" ? (
                              <MapPin size={16} />
                            ) : (
                              <DollarSign size={16} />
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)" }}>
                              {n.title}
                            </div>
                            <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", marginTop: 2, lineHeight: 1.4 }}>
                              {n.message}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--cm-ink-3)", marginTop: 4 }}>
                              {n.time}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        padding: "10px",
                        textAlign: "center",
                        background: "var(--cm-surface-2)",
                        borderTop: "1px solid var(--cm-line)",
                        fontSize: "var(--cm-text-xs)",
                      }}
                    >
                      <Link
                        href={getDashboardLink()}
                        style={{ color: "var(--cm-active)", fontWeight: 700, textDecoration: "none" }}
                      >
                        Go to {roleLabel[user.role] || "User"} Command Center
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <Link href={getDashboardLink()} className="cm-btn cm-btn--secondary cm-btn--sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.75rem", backgroundColor: "var(--cm-active)", color: "white", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                  {roleLabel[user.role] || user.role}
                </span>
                {user.full_name?.split(" ")[0] || "User"}
              </Link>
              <button onClick={handleLogout} className="cm-btn cm-btn--primary cm-btn--sm" style={{ backgroundColor: "var(--cm-urgent)", borderColor: "var(--cm-urgent)" }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="cm-btn cm-btn--secondary cm-btn--sm">Login</Link>
              <Link href="/auth/signup" className="cm-btn cm-btn--primary cm-btn--sm">Sign Up</Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          className="navbar__hamburger"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            background: "transparent",
            border: "none",
            color: "#ffffff",
            cursor: "pointer",
            padding: "8px",
            minWidth: "44px",
            minHeight: "44px",
            display: "grid",
            placeItems: "center",
          }}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Responsive Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--cm-surface)",
            borderBottom: "2px solid var(--cm-navy)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
            padding: "20px 24px",
            zIndex: 99,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              href="/about"
              style={{
                padding: "12px 14px",
                borderRadius: "var(--cm-radius-sm)",
                color: "var(--cm-ink)",
                fontWeight: 700,
                fontSize: "var(--cm-text-sm)",
                textDecoration: "none",
                background: "var(--cm-surface-2)",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
              }}
            >
              About CallMedex
            </Link>
            <Link
              href="/packages"
              style={{
                padding: "12px 14px",
                borderRadius: "var(--cm-radius-sm)",
                color: "var(--cm-ink)",
                fontWeight: 700,
                fontSize: "var(--cm-text-sm)",
                textDecoration: "none",
                background: "var(--cm-surface-2)",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
              }}
            >
              Health Packages
            </Link>
            {(!user || user.role === "patient") && (
              <>
                <Link
                  href="/diagnostics"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--cm-radius-sm)",
                    color: "var(--cm-ink)",
                    fontWeight: 700,
                    fontSize: "var(--cm-text-sm)",
                    textDecoration: "none",
                    background: "var(--cm-surface-2)",
                    minHeight: "44px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Book a Test (Diagnostics)
                </Link>
                <Link
                  href="/consultation"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--cm-radius-sm)",
                    color: "var(--cm-ink)",
                    fontWeight: 700,
                    fontSize: "var(--cm-text-sm)",
                    textDecoration: "none",
                    background: "var(--cm-surface-2)",
                    minHeight: "44px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Video Consultation
                </Link>
                <Link
                  href="/pharmacy"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--cm-radius-sm)",
                    color: "var(--cm-ink)",
                    fontWeight: 700,
                    fontSize: "var(--cm-text-sm)",
                    textDecoration: "none",
                    background: "var(--cm-surface-2)",
                    minHeight: "44px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Prescription Pharmacy
                </Link>
              </>
            )}

            <div style={{ borderTop: "1px solid var(--cm-line)", paddingTop: 16, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
              {user ? (
                <>
                  <Link
                    href={getDashboardLink()}
                    className="cm-btn cm-btn--primary cm-btn--lg"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Open {roleLabel[user.role] || "User"} Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="cm-btn cm-btn--secondary cm-btn--lg"
                    style={{ width: "100%", justifyContent: "center", color: "var(--cm-urgent)", borderColor: "var(--cm-urgent)" }}
                  >
                    <LogOut size={16} /> Logout ({user.full_name?.split(" ")[0]})
                  </button>
                </>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Link href="/auth/login" className="cm-btn cm-btn--secondary cm-btn--lg" style={{ justifyContent: "center" }}>
                    Login
                  </Link>
                  <Link href="/auth/signup" className="cm-btn cm-btn--primary cm-btn--lg" style={{ justifyContent: "center" }}>
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
