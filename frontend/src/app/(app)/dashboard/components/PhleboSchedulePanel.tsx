"use client";

import { useEffect, useState } from "react";
import { phleboAPI } from "@/lib/api";
import { Button, Icon } from "@/components/ui";
import { MapPin, Clock } from "@/components/ui/icons";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

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

function dayLabel(dateStr: string): { short: string; day: string; isToday: boolean; isPast: boolean } {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = d.getTime() === today.getTime();
  const isPast = d.getTime() < today.getTime();
  const weekday = d.toLocaleDateString("en", { weekday: "short" });
  const dayNum = d.getDate().toString();
  return { short: weekday, day: dayNum, isToday, isPast };
}

const STATUS_CONFIG: Record<string, { emoji: string; bg: string; border: string; label: string }> = {
  available: { emoji: "🟢", bg: "#f0fdf4", border: "#86efac", label: "Available" },
  off: { emoji: "🔴", bg: "#fef2f2", border: "#fca5a5", label: "Leave" },
  half_day: { emoji: "🟡", bg: "#fefce8", border: "#fde68a", label: "Half Day" },
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
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    setJobsLoading(true);
    try {
      const [resToday, resTomorrow] = await Promise.all([
        phleboAPI.getJobs(days[0]).catch(() => ({ jobs: [] })),
        phleboAPI.getJobs(days[1]).catch(() => ({ jobs: [] }))
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
      fetchJobs(); // Refresh jobs
    } catch (e: any) {
      alert(e.message || "Failed to decline job.");
    } finally {
      setDeclining(null);
    }
  };

  const getStatus = (date: string): string => {
    const entry = roster.find(r => r.roster_date === date);
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
      const msg = diffDays === 0
        ? "⚠️ You are setting today as a leave day. Your assigned bookings for today will be reassigned to another phlebotomist. Continue?"
        : "⚠️ You are setting tomorrow as a leave day. Your advance bookings will be reassigned to another phlebotomist. Continue?";
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
        // Show reassignment info if any
        if (data.warning) {
          alert(data.warning);
        } else if (data.reassigned?.length > 0) {
          alert(`✅ ${data.reassigned.length} booking(s) reassigned to another phlebotomist.`);
        } else if (data.unassigned?.length > 0) {
          alert(`⚠️ ${data.unassigned.length} booking(s) could not be auto-reassigned. Please contact your processing centre.`);
        }
      } else {
        alert(data.detail || "Failed to update availability.");
      }
    } catch { alert("Network error. Please try again."); } finally {
      setSaving(false);
      setSelectedDate(null);
    }
  };

  const availableCount = days.filter(d => getStatus(d) === "available").length;
  const leaveCount = days.filter(d => getStatus(d) === "off").length;
  const halfDayCount = days.filter(d => getStatus(d) === "half_day").length;

  if (loading) {
    return <div className="card" style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Loading schedule…</div>;
  }

  return (
    <div className="cm-stack">
      {/* Summary */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{
          padding: "12px 20px", borderRadius: 10, backgroundColor: "#f0fdf4",
          border: "1px solid #86efac", flex: 1, minWidth: 120, textAlign: "center",
        }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669" }}>{availableCount}</div>
          <div style={{ fontSize: "0.75rem", color: "#065f46", fontWeight: 600 }}>🟢 Available</div>
        </div>
        <div style={{
          padding: "12px 20px", borderRadius: 10, backgroundColor: "#fef2f2",
          border: "1px solid #fca5a5", flex: 1, minWidth: 120, textAlign: "center",
        }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#dc2626" }}>{leaveCount}</div>
          <div style={{ fontSize: "0.75rem", color: "#991b1b", fontWeight: 600 }}>🔴 Leave Days</div>
        </div>
        <div style={{
          padding: "12px 20px", borderRadius: 10, backgroundColor: "#fefce8",
          border: "1px solid #fde68a", flex: 1, minWidth: 120, textAlign: "center",
        }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ca8a04" }}>{halfDayCount}</div>
          <div style={{ fontSize: "0.75rem", color: "#854d0e", fontWeight: 600 }}>🟡 Half Days</div>
        </div>
      </div>

      {/* Jobs Panels */}
      <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
        {(todayJobs.length > 0 || tomorrowJobs.length > 0) && (
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", color: "#1a2b4a", fontSize: "1.05rem" }}>📋 Assigned Jobs</h3>
            {jobsLoading ? (
              <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>Loading jobs...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {todayJobs.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "#475569" }}>Today</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {todayJobs.map((job: any) => (
                        <div key={job.dispatch_id} style={{
                          border: "1px solid #e2e8f0", borderRadius: 8, padding: 12,
                          display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#0f172a" }}>
                              {job.service_subtype || "Home Collection"}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                              <Icon as={MapPin} size={14} /> {job.patient_address || "Address hidden"}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <Icon as={Clock} size={14} /> {job.scheduled_time || "Pending time"}
                            </div>
                          </div>
                          {job.status === "pending_provider_acceptance" && (
                            <div style={{ padding: "4px", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" }}>
                              <Button 
                                variant="secondary" 
                                onClick={() => handleDecline(job.dispatch_id)}
                                disabled={declining === job.dispatch_id}
                                className="text-red-600"
                              >
                                {declining === job.dispatch_id ? "..." : "Decline"}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tomorrowJobs.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "#475569" }}>Tomorrow</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {tomorrowJobs.map((job: any) => (
                        <div key={job.dispatch_id} style={{
                          border: "1px solid #e2e8f0", borderRadius: 8, padding: 12,
                          display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#0f172a" }}>
                              {job.service_subtype || "Home Collection"}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                              <Icon as={MapPin} size={14} /> {job.patient_address || "Address hidden"}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <Icon as={Clock} size={14} /> {job.scheduled_time || "Pending time"}
                            </div>
                          </div>
                          {job.status === "pending_provider_acceptance" && (
                            <div style={{ padding: "4px", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" }}>
                              <Button 
                                variant="secondary" 
                                onClick={() => handleDecline(job.dispatch_id)}
                                disabled={declining === job.dispatch_id}
                                className="text-red-600"
                              >
                                {declining === job.dispatch_id ? "..." : "Decline"}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", color: "#1a2b4a", fontSize: "1rem" }}>📅 Next 14 Days Schedule</h3>
        <p style={{ margin: "0 0 16px", fontSize: "0.8rem", color: "#6b7280" }}>
          Tap a day to set your availability. Your processing center can override if needed.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {days.map(date => {
            const { short, day, isToday, isPast } = dayLabel(date);
            const status = getStatus(date);
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available;
            const isSelected = selectedDate === date;

            return (
              <button
                key={date}
                onClick={() => { if (!isPast) setSelectedDate(isSelected ? null : date); }}
                disabled={isPast}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "10px 4px", borderRadius: 10,
                  border: isSelected ? "2px solid #2563eb" : isToday ? "2px solid #1a2b4a" : `1.5px solid ${cfg.border}`,
                  backgroundColor: isPast ? "#f9fafb" : cfg.bg,
                  cursor: isPast ? "not-allowed" : "pointer",
                  opacity: isPast ? 0.5 : 1,
                  transition: "all 0.15s",
                  minHeight: 72,
                }}
              >
                <div style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 600, marginBottom: 2 }}>{short}</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: isToday ? "#1a2b4a" : "#374151" }}>{day}</div>
                <div style={{ fontSize: "0.9rem", marginTop: 2 }}>{cfg.emoji}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick-set panel */}
      {selectedDate && (
        <div className="card" style={{
          padding: 20, borderLeft: "4px solid #2563eb",
          animation: "fadeIn 0.2s ease-out",
        }}>
          <h4 style={{ margin: "0 0 12px", color: "#1e293b", fontSize: "0.95rem" }}>
            Set status for {new Date(selectedDate + "T00:00:00").toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}
          </h4>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setDayStatus(selectedDate, key)}
                disabled={saving}
                style={{
                  padding: "10px 20px", borderRadius: 8,
                  border: getStatus(selectedDate) === key ? "2px solid #2563eb" : "1px solid #d1d5db",
                  backgroundColor: getStatus(selectedDate) === key ? cfg.bg : "white",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 700, fontSize: "0.85rem", color: "#334155",
                  transition: "all 0.15s",
                }}
              >
                {cfg.emoji} {cfg.label}
              </button>
            ))}
          </div>
          {saving && <p style={{ marginTop: 8, fontSize: "0.8rem", color: "#6b7280" }}>Saving...</p>}
        </div>
      )}
    </div>
  );
}
