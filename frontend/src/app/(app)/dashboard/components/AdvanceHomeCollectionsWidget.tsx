"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Phone,
  ExternalLink,
  TestTube,
  CheckCircle2,
  Droplets,
  ArrowRight,
  RefreshCw,
} from "@/components/ui/icons";

interface ScheduledJob {
  id: string;
  dispatch_id?: string;
  booking_id?: string;
  patient_id?: string;
  patient_name?: string;
  patient_phone?: string;
  patient_address?: string;
  scheduled_time?: string;
  slot_time?: string;
  collection_date?: string;
  scheduled_for?: string;
  selected_tests?: string[];
  service_subtype?: string;
  status?: string;
  total_price?: number;
  priority?: string;
}

interface AdvanceHomeCollectionsWidgetProps {
  onSelectBookingForCollection?: (bookingId: string) => void;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

export default function AdvanceHomeCollectionsWidget({
  onSelectBookingForCollection,
}: AdvanceHomeCollectionsWidgetProps) {
  const [timeframe, setTimeframe] = useState<"today" | "tomorrow" | "upcoming" | "all">("today");
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tomorrowCount, setTomorrowCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);

  const fetchJobs = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      // Fetch selected timeframe
      const res = await fetch(`${apiBase}/api/phlebo/jobs?timeframe=${timeframe}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }

      // Pre-fetch count for Tomorrow badge if not on tomorrow
      if (timeframe !== "tomorrow") {
        fetch(`${apiBase}/api/phlebo/jobs?timeframe=tomorrow`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((d) => setTomorrowCount((d.jobs || []).length))
          .catch(() => {});
      } else {
        setTomorrowCount((res.ok ? (await res.clone().json()).jobs : []).length);
      }

      // Pre-fetch count for Today badge if not on today
      if (timeframe !== "today") {
        fetch(`${apiBase}/api/phlebo/jobs?timeframe=today`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((d) => setTodayCount((d.jobs || []).length))
          .catch(() => {});
      }
    } catch (err) {
      console.error("Failed to load advance jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const formatSlot = (time?: string) => {
    if (!time) return "Morning Fasting Slot (05:30 AM – 11:00 AM)";
    const parts = time.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:${m} ${ampm}`;
    }
    return time;
  };

  const getTubeTypeRecommendation = (tests: string[] = []) => {
    const tubes: { label: string; color: string; border: string; bg: string }[] = [];
    const testStr = tests.join(" ").toLowerCase();
    if (testStr.includes("cbc") || testStr.includes("blood count") || testStr.includes("hemoglobin")) {
      tubes.push({ label: "EDTA Lavender", color: "#6b21a8", border: "#d8b4fe", bg: "#f3e8ff" });
    }
    if (testStr.includes("sugar") || testStr.includes("glucose") || testStr.includes("fasting sugar")) {
      tubes.push({ label: "Fluoride Grey", color: "#374151", border: "#d1d5db", bg: "#f3f4f6" });
    }
    if (
      testStr.includes("lipid") ||
      testStr.includes("cholesterol") ||
      testStr.includes("lft") ||
      testStr.includes("liver") ||
      testStr.includes("thyroid") ||
      testStr.includes("tsh") ||
      testStr.includes("serum") ||
      testStr.includes("creatinine") ||
      testStr.includes("kft") ||
      tubes.length === 0
    ) {
      tubes.push({ label: "SST Gold / Serum Red", color: "#854d0e", border: "#fde047", bg: "#fef9c3" });
    }
    return tubes;
  };

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderRadius: 18,
        border: "1px solid rgba(2, 132, 199, 0.18)",
        padding: 24,
        boxShadow: "0 12px 36px -4px rgba(15, 23, 42, 0.08)",
        marginBottom: 24,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
              }}
            >
              <CalendarDays size={20} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: "-0.3px",
                }}
              >
                Advance & Scheduled Home Collections
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                Pre-rostered doorstep blood sample visits synced for your service area
              </p>
            </div>
          </div>
        </div>

        {/* Timeframe selector tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setTimeframe("today")}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              fontSize: "0.82rem",
              fontWeight: 700,
              border: timeframe === "today" ? "1px solid #0284c7" : "1px solid #e2e8f0",
              background: timeframe === "today" ? "#0284c7" : "#ffffff",
              color: timeframe === "today" ? "#ffffff" : "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Today
            {todayCount > 0 && timeframe !== "today" && (
              <span
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  fontSize: "0.7rem",
                  padding: "1px 6px",
                  borderRadius: 10,
                }}
              >
                {todayCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTimeframe("tomorrow")}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              fontSize: "0.82rem",
              fontWeight: 700,
              border: timeframe === "tomorrow" ? "1px solid #0284c7" : "1px solid #e2e8f0",
              background: timeframe === "tomorrow" ? "#0284c7" : "#ffffff",
              color: timeframe === "tomorrow" ? "#ffffff" : "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Tomorrow
            {tomorrowCount > 0 && (
              <span
                style={{
                  background: timeframe === "tomorrow" ? "#ffffff" : "#16a34a",
                  color: timeframe === "tomorrow" ? "#0284c7" : "#ffffff",
                  fontSize: "0.7rem",
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontWeight: 800,
                }}
              >
                {tomorrowCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTimeframe("upcoming")}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              fontSize: "0.82rem",
              fontWeight: 700,
              border: timeframe === "upcoming" ? "1px solid #0284c7" : "1px solid #e2e8f0",
              background: timeframe === "upcoming" ? "#0284c7" : "#ffffff",
              color: timeframe === "upcoming" ? "#ffffff" : "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Upcoming (7d)
          </button>

          <button
            onClick={() => setTimeframe("all")}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              fontSize: "0.82rem",
              fontWeight: 700,
              border: timeframe === "all" ? "1px solid #0284c7" : "1px solid #e2e8f0",
              background: timeframe === "all" ? "#0284c7" : "#ffffff",
              color: timeframe === "all" ? "#ffffff" : "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            All Scheduled
          </button>

          <button
            onClick={fetchJobs}
            title="Refresh schedule"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#64748b",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Roster & jobs list */}
      {loading ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "#64748b" }}>
          <div style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>
            <RefreshCw size={24} color="#0284c7" />
          </div>
          <p style={{ marginTop: 8, fontSize: "0.85rem" }}>Loading advance collections roster...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div
          style={{
            padding: "36px 20px",
            textAlign: "center",
            background: "rgba(248, 250, 252, 0.8)",
            borderRadius: 14,
            border: "1px dashed #cbd5e1",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: 6 }}>📋</div>
          <h4 style={{ margin: "0 0 4px", color: "#334155", fontSize: "0.95rem", fontWeight: 700 }}>
            No Scheduled Collections for {timeframe === "today" ? "Today" : timeframe === "tomorrow" ? "Tomorrow" : timeframe}
          </h4>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", maxWidth: 460, marginInline: "auto" }}>
            When a patient books tomorrow’s morning fasting slot (05:30 – 11:00 AM) in your service area, it will lock the area slot and appear here immediately with advance dispatch details.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {jobs.map((job) => {
            const bId = job.booking_id || job.id;
            const tubes = getTubeTypeRecommendation(job.selected_tests || []);
            const mapsUrl = job.patient_address
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.patient_address)}`
              : null;

            return (
              <div
                key={job.dispatch_id || job.id}
                style={{
                  background: "#ffffff",
                  border: "1.5px solid rgba(2, 132, 199, 0.22)",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 4px 14px -2px rgba(15, 23, 42, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Top row: Patient Name, Slot Time, Status */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>
                        {job.patient_name || "Patient Collection"}
                      </span>
                      {job.collection_date && (
                        <span
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#e0f2fe",
                            color: "#0369a1",
                            border: "1px solid #bae6fd",
                          }}
                        >
                          📅 {job.collection_date}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "#f0fdf4",
                          color: "#15803d",
                          border: "1px solid #bbf7d0",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={12} /> {formatSlot(job.slot_time || job.scheduled_time)}
                      </span>
                    </div>

                    {/* Patient Phone & Contact */}
                    {job.patient_phone && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 4,
                          fontSize: "0.82rem",
                          color: "#475569",
                        }}
                      >
                        <Phone size={13} color="#0284c7" />
                        <a
                          href={`tel:${job.patient_phone}`}
                          style={{ color: "#0284c7", fontWeight: 700, textDecoration: "none" }}
                        >
                          {job.patient_phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Status & Priority Badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        padding: "3px 10px",
                        borderRadius: 12,
                        background: job.status === "provider_accepted" ? "#dbeafe" : "#fef3c7",
                        color: job.status === "provider_accepted" ? "#1d4ed8" : "#b45309",
                        border: `1px solid ${job.status === "provider_accepted" ? "#bfdbfe" : "#fde68a"}`,
                      }}
                    >
                      {job.status === "provider_accepted" ? "Advance Roster Locked" : "Pending Confirmation"}
                    </span>
                  </div>
                </div>

                {/* Patient Address & Navigation */}
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "#334155" }}>
                    <MapPin size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{job.patient_address || "Address in booking notes"}</span>
                  </div>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#0284c7",
                        textDecoration: "none",
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                      }}
                    >
                      <span>Navigate</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {/* Diagnostic Tests & Tube requirements */}
                <div>
                  <div
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <TestTube size={13} color="#0284c7" /> Diagnostic Tests & Vacutainers Required
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {(job.selected_tests && job.selected_tests.length > 0
                      ? job.selected_tests
                      : ["Complete Blood Count (CBC)", "Fasting Blood Sugar"]
                    ).map((testName, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 8,
                          background: "#f1f5f9",
                          color: "#1e293b",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        🔬 {testName}
                      </span>
                    ))}

                    {/* Tube vacutainer badges */}
                    {tubes.map((tube, idx) => (
                      <span
                        key={`tube-${idx}`}
                        style={{
                          fontSize: "0.74rem",
                          fontWeight: 800,
                          padding: "3px 9px",
                          borderRadius: 8,
                          background: tube.bg,
                          color: tube.color,
                          border: `1px solid ${tube.border}`,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Droplets size={11} /> {tube.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action bar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: 10,
                    marginTop: 2,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Booking Ref: <code style={{ color: "#0284c7", fontWeight: 700 }}>{bId ? bId.slice(0, 8) : "N/A"}</code>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {onSelectBookingForCollection && bId && (
                      <button
                        onClick={() => onSelectBookingForCollection(bId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 16px",
                          borderRadius: 8,
                          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          border: "none",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                        }}
                      >
                        <span>Start Doorstep Collection</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
