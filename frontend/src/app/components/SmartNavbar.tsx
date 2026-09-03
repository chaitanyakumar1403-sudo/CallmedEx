"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { Bell, CheckCircle2, Clock, MapPin, DollarSign, X } from "lucide-react";

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
    <nav className="navbar">
      <div className="container">
        <a href={getDashboardLink()} className="navbar__logo" style={{ display: "flex", alignItems: "center" }}>
          <img src="/logo.png" alt="CallMedex Logo" style={{ height: "55px", width: "auto", objectFit: "contain" }} />
        </a>
        <ul className="navbar__nav">
          <li><a href="/about">About</a></li>
          <li><a href="/packages">Health Packages</a></li>
          {(!user || user.role === "patient") && (
            <>
              <li><a href="/diagnostics">Book a Test</a></li>
              <li><a href="/consultation">Consultation</a></li>
              <li><a href="/pharmacy">Pharmacy</a></li>
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
                        background: "#ef4444",
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
                      border: "1px solid #e2e8f0",
                      zIndex: 100,
                      overflow: "hidden",
                      color: "#0f172a",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 16px",
                        background: "#0f172a",
                        color: "#ffffff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                        Notifications ({unreadCount} new)
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#38bdf8",
                            fontSize: "0.74rem",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div style={{ maxHeight: "320px", overflowY: "auto", padding: "8px 0" }}>
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: "10px 16px",
                            borderBottom: "1px solid #f1f5f9",
                            background: n.read ? "#ffffff" : "#f0f9ff",
                            display: "flex",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <div
                            style={{
                              marginTop: 2,
                              padding: 6,
                              borderRadius: "6px",
                              background:
                                n.type === "booking"
                                  ? "#e0f2fe"
                                  : n.type === "dispatch"
                                  ? "#fee2e2"
                                  : "#dcfce7",
                              color:
                                n.type === "booking"
                                  ? "#0284c7"
                                  : n.type === "dispatch"
                                  ? "#ef4444"
                                  : "#16a34a",
                            }}
                          >
                            {n.type === "booking" ? (
                              <Clock size={14} />
                            ) : n.type === "dispatch" ? (
                              <MapPin size={14} />
                            ) : (
                              <DollarSign size={14} />
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#0f172a" }}>
                              {n.title}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 2, lineHeight: 1.4 }}>
                              {n.message}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>
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
                        background: "#f8fafc",
                        borderTop: "1px solid #e2e8f0",
                        fontSize: "0.78rem",
                      }}
                    >
                      <a
                        href={getDashboardLink()}
                        style={{ color: "#0284c7", fontWeight: 700, textDecoration: "none" }}
                      >
                        Go to {roleLabel[user.role] || "User"} Command Center
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <a href={getDashboardLink()} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.75rem", backgroundColor: "#0284c7", color: "white", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                  {roleLabel[user.role] || user.role}
                </span>
                {user.full_name?.split(" ")[0] || "User"}
              </a>
              <button onClick={handleLogout} className="btn btn-primary btn-sm" style={{ backgroundColor: "#ef4444", borderColor: "#ef4444" }}>
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
