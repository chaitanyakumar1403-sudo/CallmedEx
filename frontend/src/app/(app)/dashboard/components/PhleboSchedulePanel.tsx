"use client";

import { useEffect, useState } from "react";
import { phleboAPI } from "@/lib/api";
import {
  Calendar,
  CalendarCheck2,
  CalendarOff,
  Clock,
  Clock3,
  MapPin,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

interface RosterEntry {
  roster_date: string;
  status: string;
}

function getNext14Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function dayLabel(dateStr: string): { short: string; day: string; isToday: boolean; isPast: boolean; month: string } {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = d.getTime() === today.getTime();
  const isPast = d.getTime() < today.getTime();
  const weekday = d.toLocaleDateString("en", { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString("en", { month: "short" });
  const dayNum = d.getDate().toString();
  return { short: weekday, day: dayNum, isToday, isPast, month };
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    sublabel: string;
    icon: any;
    color: string;
    bg: string;
    border: string;
    pillBg: string;
    pillText: string;
  }
> = {
  available: {
    label: "Full Day Duty",
    sublabel: "Available for regular doorstep dispatches and morning slots",
    icon: Check,
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    pillBg: "#dcfce7",
    pillText: "#15803d",
  },
  off: {
    label: "Planned Leave",
    sublabel: "Roster off; advance dispatches will be auto-reassigned",
    icon: X,
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    pillBg: "#fee2e2",
    pillText: "#b91c1c",
  },
  half_day: {
    label: "Half-Day Duty",
    sublabel: "Partial slot availability; processing center limits workload",
    icon: Clock,
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    pillBg: "#fef3c7",
    pillText: "#b45309",
  },
};

export default function PhleboSchedulePanel() {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [todayJobs, setTodayJobs] = useState<any[]>([]);
  const [tomorrowJobs, setTomorrowJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [declining, setDeclining] = useState<string | null>(null);

  const days = getNext14Days();
  const fromDate = days[0];
  const toDate = days[days.length - 1];

  const fetchRoster = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/phlebo/roster?from_date=${fromDate}&to_date=${toDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoster(data.roster || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    setJobsLoading(true);
    try {
      const [resToday, resTomorrow] = await Promise.all([
        phleboAPI.getJobs(days[0]).catch(() => ({ jobs: [] })),
        phleboAPI.getJobs(days[1]).catch(() => ({ jobs: [] })),
      ]);
      setTodayJobs((resToday as any).jobs || []);
      setTomorrowJobs((resTomorrow as any).jobs || []);
    } catch {
      // silent
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
    fetchJobs();
  }, []);

  const handleDecline = async (dispatchId: string) => {
    if (!confirm("Are you sure you want to decline this job? It may impact your acceptance rate.")) return;
    setDeclining(dispatchId);
    try {
      const res = await phleboAPI.declineJob(dispatchId);
      alert((res as any).message || "Job declined successfully.");
      fetchJobs();
    } catch (e: any) {
      alert(e.message || "Failed to decline job.");
    } finally {
      setDeclining(null);
    }
  };

  const getStatus = (date: string): string => {
    const entry = roster.find((r) => r.roster_date === date);
    return entry?.status || "available";
  };

  const setDayStatus = async (date: string, status: string) => {
    const token = getToken();
    if (!token) return;

    // Check if setting leave within 2 days — warn about reassignment
    const targetDate = new Date(date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isNearLeave = (status === "off" || status === "half_day") && diffDays <= 1;

    if (isNearLeave) {
      const msg =
        diffDays === 0
          ? "Notice: You are setting today as a leave day. Any existing doorstep dispatches will be reassigned immediately to ensure patient coverage. Proceed?"
          : "Notice: You are setting tomorrow as a leave day. Advance bookings will be reassigned. Proceed?";
      if (!confirm(msg)) return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/phlebo/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date, status }),
      });
      const data = res.ok ? await res.json() : {};
      if (res.ok) {
        await fetchRoster();
        if (data.warning) {
          alert(data.warning);
        } else if (data.reassigned?.length > 0) {
          alert(`${data.reassigned.length} booking(s) reassigned to ensure on-time patient collection.`);
        }
      } else {
        alert(data.detail || "Failed to update availability.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSaving(false);
      setSelectedDate(null);
    }
  };

  const availableCount = days.filter((d) => getStatus(d) === "available").length;
  const leaveCount = days.filter((d) => getStatus(d) === "off").length;
  const halfDayCount = days.filter((d) => getStatus(d) === "half_day").length;

  if (loading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid #e2e8f0", borderTopColor: "#0284c7",
          animation: "spin 0.8s linear infinite", margin: "0 auto 16px"
        }} />
        <p style={{ fontWeight: 600 }}>Loading 14-day schedule and shift allocations...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ─── Summary Metric KPI Strip ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {/* Available / Full Duty */}
        <div style={{
          padding: "18px 20px", borderRadius: 14, background: "#ffffff",
          border: "1px solid #bbf7d0", boxShadow: "0 2px 8px rgba(34, 197, 94, 0.08)",
          display: "flex", alignItems: "center", gap: 16
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: "#f0fdf4", border: "1.5px solid #86efac",
            color: "#16a34a", display: "grid", placeItems: "center", flexShrink: 0
          }}>
            <CalendarCheck2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>
              {availableCount}
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534", marginTop: 4 }}>
              Full Duty Days
            </div>
            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Active for sample collections</div>
          </div>
        </div>

        {/* Leave Days */}
        <div style={{
          padding: "18px 20px", borderRadius: 14, background: "#ffffff",
          border: "1px solid #fecaca", boxShadow: "0 2px 8px rgba(239, 68, 68, 0.08)",
          display: "flex", alignItems: "center", gap: 16
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: "#fef2f2", border: "1.5px solid #fca5a5",
            color: "#dc2626", display: "grid", placeItems: "center", flexShrink: 0
          }}>
            <CalendarOff size={24} />
          </div>
          <div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#b91c1c", lineHeight: 1 }}>
              {leaveCount}
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#991b1b", marginTop: 4 }}>
              Planned Leave
            </div>
            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Roster holiday allocation</div>
          </div>
        </div>

        {/* Half Days */}
        <div style={{
          padding: "18px 20px", borderRadius: 14, background: "#ffffff",
          border: "1px solid #fde68a", boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)",
          display: "flex", alignItems: "center", gap: 16
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: "#fffbeb", border: "1.5px solid #fcd34d",
            color: "#d97706", display: "grid", placeItems: "center", flexShrink: 0
          }}>
            <Clock3 size={24} />
          </div>
          <div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#b45309", lineHeight: 1 }}>
              {halfDayCount}
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#92400e", marginTop: 4 }}>
              Half-Day Shifts
            </div>
            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Partial slot schedule</div>
          </div>
        </div>
      </div>

      {/* ─── Assigned Jobs Panels (if any) ─── */}
      {(todayJobs.length > 0 || tomorrowJobs.length > 0) && (
        <div style={{
          background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14,
          padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Briefcase size={18} color="#0284c7" />
            <h3 style={{ margin: 0, color: "#0f172a", fontSize: "1rem", fontWeight: 800 }}>
              Assigned Doorstep Collection Jobs
            </h3>
          </div>

          {jobsLoading ? (
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Loading schedule tasks...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {todayJobs.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.5px" }}>
                    Today&apos;s Run
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {todayJobs.map((job: any) => (
                      <div
                        key={job.dispatch_id}
                        style={{
                          border: "1px solid #e2e8f0", borderRadius: 10, padding: 14,
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: "#f8fafc", flexWrap: "wrap", gap: 10
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#0f172a" }}>
                            {job.service_subtype || "Home Blood Collection"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                            <MapPin size={13} color="#0284c7" /> {job.patient_address || "Address confidential"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <Clock size={13} color="#16a34a" /> {job.scheduled_time || "Morning Slot"}
                          </div>
                        </div>

                        {job.status === "pending_provider_acceptance" && (
                          <button
                            type="button"
                            onClick={() => handleDecline(job.dispatch_id)}
                            disabled={declining === job.dispatch_id}
                            style={{
                              padding: "6px 14px", borderRadius: 8, border: "1px solid #fecaca",
                              background: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: "0.8rem",
                              cursor: declining === job.dispatch_id ? "not-allowed" : "pointer"
                            }}
                          >
                            {declining === job.dispatch_id ? "Declining..." : "Decline Job"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tomorrowJobs.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.5px" }}>
                    Tomorrow&apos;s Run
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {tomorrowJobs.map((job: any) => (
                      <div
                        key={job.dispatch_id}
                        style={{
                          border: "1px solid #e2e8f0", borderRadius: 10, padding: 14,
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: "#f8fafc", flexWrap: "wrap", gap: 10
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#0f172a" }}>
                            {job.service_subtype || "Home Blood Collection"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                            <MapPin size={13} color="#0284c7" /> {job.patient_address || "Address confidential"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <Clock size={13} color="#16a34a" /> {job.scheduled_time || "Morning Slot"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── 14 Days Interactive Calendar Grid ─── */}
      <div style={{
        background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14,
        padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={18} color="#0284c7" />
              <h3 style={{ margin: 0, color: "#0f172a", fontSize: "1.05rem", fontWeight: 800 }}>
                Next 14 Days Shift Schedule
              </h3>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Click on any day to modify your availability. Processing center dispatchers sync with your active schedule in real-time.
            </p>
          </div>
        </div>

        {/* 7-Column Modern Calendar Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: 10
        }}>
          {days.map((date) => {
            const { short, day, isToday, isPast, month } = dayLabel(date);
            const status = getStatus(date);
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available;
            const isSelected = selectedDate === date;
            const StatusIcon = cfg.icon;

            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  if (!isPast) setSelectedDate(isSelected ? null : date);
                }}
                disabled={isPast}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 8px",
                  borderRadius: 12,
                  border: isSelected
                    ? "2px solid #0284c7"
                    : isToday
                    ? "2px solid #0f172a"
                    : `1px solid ${cfg.border}`,
                  backgroundColor: isPast ? "#f8fafc" : isSelected ? "#f0f9ff" : cfg.bg,
                  cursor: isPast ? "not-allowed" : "pointer",
                  opacity: isPast ? 0.45 : 1,
                  transition: "all 0.15s ease",
                  minHeight: 90,
                  boxShadow: isSelected
                    ? "0 0 0 3px rgba(2, 132, 199, 0.2)"
                    : isToday
                    ? "0 2px 6px rgba(15, 23, 42, 0.1)"
                    : "none",
                }}
              >
                {/* Header: Weekday & Month */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700 }}>
                    {short}
                  </span>
                  {isToday && (
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 800, background: "#0f172a",
                      color: "white", padding: "1px 5px", borderRadius: 4
                    }}>
                      TODAY
                    </span>
                  )}
                </div>

                {/* Day Numeral */}
                <div style={{
                  fontSize: "1.45rem", fontWeight: 800,
                  color: isToday ? "#0f172a" : "#1e293b",
                  lineHeight: 1, margin: "6px 0"
                }}>
                  {day}
                </div>

                {/* Status Pill with Lucide Icon */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: "0.68rem", fontWeight: 700,
                  padding: "2px 7px", borderRadius: 12,
                  background: cfg.pillBg, color: cfg.pillText,
                  lineHeight: 1.2
                }}>
                  <StatusIcon size={10} strokeWidth={2.5} />
                  {status === "available" ? "Duty" : status === "off" ? "Leave" : "Half Day"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Interactive Shift Setting Drawer ─── */}
      {selectedDate && (
        <div style={{
          background: "#ffffff", border: "2px solid #0284c7", borderRadius: 14,
          padding: 24, boxShadow: "0 10px 25px -5px rgba(2, 132, 199, 0.15)",
          animation: "fadeIn 0.2s ease-out"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Update Roster Shift
              </span>
              <h4 style={{ margin: "2px 0 0", color: "#0f172a", fontSize: "1.1rem", fontWeight: 800 }}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              style={{
                background: "#f1f5f9", border: "none", borderRadius: 8,
                width: 32, height: 32, display: "grid", placeItems: "center",
                color: "#64748b", cursor: "pointer"
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const isActive = getStatus(selectedDate) === key;
              const StatusIcon = cfg.icon;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDayStatus(selectedDate, key)}
                  disabled={saving}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "16px",
                    borderRadius: 12,
                    border: isActive ? `2px solid ${cfg.color}` : "1.5px solid #e2e8f0",
                    background: isActive ? cfg.bg : "#ffffff",
                    cursor: saving ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    boxShadow: isActive ? `0 4px 12px ${cfg.pillBg}` : "none",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: cfg.pillBg, color: cfg.color,
                    display: "grid", placeItems: "center", flexShrink: 0
                  }}>
                    <StatusIcon size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#0f172a" }}>
                      {cfg.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>
                      {cfg.sublabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {saving && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "#0284c7", fontSize: "0.82rem", fontWeight: 600 }}>
              <span style={{
                width: 14, height: 14, border: "2px solid #0284c7",
                borderTopColor: "transparent", borderRadius: "50%",
                display: "inline-block", animation: "spin 0.8s linear infinite"
              }} />
              Updating phlebotomist roster in CallMedex central dispatch...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
