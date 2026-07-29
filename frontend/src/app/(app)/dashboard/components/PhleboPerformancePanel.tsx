"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, Panel, Pill } from "@/components/ui";
import {
  Award, IndianRupee, BarChart3, CalendarDays,
  CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight,
} from "@/components/ui/icons";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

interface PerformanceData {
  slots_completed: number;
  cancellation_pct: number | null;
  incentives_month: number;
  fines_month: number;
  month_label: string;
}

interface AvailabilityDay {
  date: string;
  display: string;
  status: "available" | "unavailable" | "leave";
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekdayLabel(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function next7Days(): AvailabilityDay[] {
  const days: AvailabilityDay[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: formatDate(d),
      display: weekdayLabel(d),
      status: "available",
    });
  }
  return days;
}

export default function PhleboPerformancePanel() {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDay[]>(next7Days);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/phlebo/performance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPerformance(await res.json());
      }
    } catch (e) {
      console.error("Failed to load performance:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // Load existing roster entries for the next 7 days
  useEffect(() => {
    const loadRoster = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const today = formatDate(new Date());
        const future = new Date();
        future.setDate(future.getDate() + 6);
        const to = formatDate(future);
        const res = await fetch(`${apiBase}/api/phlebo/roster?from=${today}&to=${to}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const rosterMap: Record<string, string> = {};
          if (data.roster) {
            for (const row of data.roster) {
              rosterMap[row.roster_date] = row.status;
            }
          }
          setAvailability((prev) =>
            prev.map((d) => ({
              ...d,
              status: (rosterMap[d.date] as AvailabilityDay["status"]) || "available",
            }))
          );
        }
      } catch (e) {
        // Non-critical
      }
    };
    loadRoster();
  }, []);

  const toggleAvailability = async (day: AvailabilityDay) => {
    const nextStatus: Record<string, "available" | "unavailable" | "leave"> = {
      available: "leave",
      leave: "unavailable",
      unavailable: "available",
    };
    const newStatus = nextStatus[day.status];
    setSaving(day.date);

    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/api/phlebo/availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date: day.date, status: newStatus }),
      });

      if (res.ok) {
        setAvailability((prev) =>
          prev.map((d) => (d.date === day.date ? { ...d, status: newStatus } : d))
        );
        setError(null);
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to update availability");
      }
    } catch (e) {
      setError("Network error updating availability");
    } finally {
      setSaving(null);
    }
  };

  const p = performance;

  const statusIcon = (s: string) => {
    switch (s) {
      case "available": return CheckCircle2;
      case "unavailable": return XCircle;
      case "leave": return Clock;
      default: return CheckCircle2;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "available": return "Available";
      case "unavailable": return "Unavailable";
      case "leave": return "Leave";
      default: return "Available";
    }
  };

  const statusPillTone = (s: string) => {
    switch (s) {
      case "available": return "done" as const;
      case "unavailable": return "urgent" as const;
      case "leave": return "waiting" as const;
      default: return "done" as const;
    }
  };

  return (
    <div className="cm-stack">
      {/* ── Scorecard ──────────────────────────────────────────────────────── */}
      <Panel>
        <div className="perf__head">
          <h3 className="perf__title">
            <Icon as={BarChart3} size={16} />
            My Performance this Month
          </h3>
          {p && <span className="perf__month">{p.month_label}</span>}
        </div>

        {loading ? (
          <div className="perf__loading">Loading performance data...</div>
        ) : p ? (
          <div className="perf__grid">
            <div className="perf__tile">
              <Icon as={Award} size={20} />
              <span className="perf__tile-value">{p.slots_completed}</span>
              <span className="perf__tile-label">Slots Completed</span>
            </div>

            <div className="perf__tile perf__tile--green">
              <Icon as={IndianRupee} size={20} />
              <span className="perf__tile-value">+{p.incentives_month.toFixed(2)}</span>
              <span className="perf__tile-label">Incentives</span>
            </div>

            <div className="perf__tile perf__tile--red">
              <Icon as={IndianRupee} size={20} />
              <span className="perf__tile-value">-{p.fines_month.toFixed(2)}</span>
              <span className="perf__tile-label">Fines</span>
            </div>

            <div className="perf__tile">
              <Icon as={AlertTriangle} size={20} />
              <span className="perf__tile-value">
                {p.cancellation_pct !== null ? `${p.cancellation_pct}%` : "—"}
              </span>
              <span className="perf__tile-label">Cancellation</span>
            </div>
          </div>
        ) : (
          <div className="perf__empty">Could not load performance data.</div>
        )}
      </Panel>

      {/* ── Availability Strip ──────────────────────────────────────────────── */}
      <Panel>
        <div className="perf__head">
          <h3 className="perf__title">
            <Icon as={CalendarDays} size={16} />
            My Availability
          </h3>
        </div>

        {error && (
          <div className="perf__error">{error}</div>
        )}

        <div className="perf__av-grid">
          {availability.map((day) => (
            <button
              key={day.date}
              className={`perf__av-day perf__av-day--${day.status}`}
              onClick={() => toggleAvailability(day)}
              disabled={saving === day.date}
              title={`Click to toggle. Currently: ${statusLabel(day.status)}`}
            >
              <span className="perf__av-date">{day.display}</span>
              <span className="perf__av-icon">
                <Icon as={statusIcon(day.status)} size={16} />
              </span>
              <Pill tone={statusPillTone(day.status)}>
                {statusLabel(day.status)}
              </Pill>
            </button>
          ))}
        </div>

        <p className="perf__av-note">
          <Icon as={ArrowRight} size={14} />
          Your processing centre can override for staffing needs.
        </p>
      </Panel>
    </div>
  );
}