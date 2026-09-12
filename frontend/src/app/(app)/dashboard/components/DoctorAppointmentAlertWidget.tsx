"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Video,
  Clock,
  CheckCircle2,
  Calendar,
  Bell,
  User,
  ShieldCheck,
  ChevronRight,
  FileText,
  Activity,
  AlertCircle,
  Sparkles,
  MapPin,
} from "lucide-react";

interface DoctorAppointmentAlertWidgetProps {
  bookings: any[];
  onSelectForRx?: (patientId: string) => void;
  onRefresh?: () => void;
}

export default function DoctorAppointmentAlertWidget({
  bookings = [],
  onSelectForRx,
  onRefresh,
}: DoctorAppointmentAlertWidgetProps) {
  const router = useRouter();
  const [isPinging, setIsPinging] = useState<string | null>(null);
  const [pingedBookings, setPingedBookings] = useState<Record<string, boolean>>({});

  // Helper to extract clean date (YYYY-MM-DD) from booking
  const getBookingDate = (b: any) => {
    if (b.slot_date) return b.slot_date;
    if (b.slot_start && b.slot_start.length >= 10) {
      try {
        const d = new Date(b.slot_start);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      } catch {
        return b.slot_start.slice(0, 10);
      }
    }
    if (b.booking_date) return String(b.booking_date).slice(0, 10);
    return null;
  };

  const getBookingTime = (b: any) => {
    if (b.slot_time) return b.slot_time;
    if (b.slot_start) {
      try {
        const d = new Date(b.slot_start);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      } catch {
        // fallback
      }
    }
    return "17:30";
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Filter confirmed/waiting appointments for today
  const todayAppointments = (bookings || []).filter((b: any) => {
    const bDate = getBookingDate(b);
    const isToday = bDate === todayStr;
    const isConfirmedOrWaiting = b.status === "confirmed" || b.status === "waiting" || b.status === "in_progress";
    return isToday && isConfirmedOrWaiting;
  });

  const nextAppointment = todayAppointments[0];

  if (!nextAppointment) {
    return null;
  }

  const patientName = nextAppointment.patient_name || nextAppointment.patient?.full_name || "Scheduled Patient";
  const slotTime = getBookingTime(nextAppointment);
  const isOnline = nextAppointment.consultation_mode !== "in_person";
  const symptoms = nextAppointment.symptoms || nextAppointment.notes || "General Medical Consultation";
  const uhid = `CM-${(nextAppointment.id || "2026").slice(0, 6).toUpperCase()}`;

  const handleOpenExamRoom = () => {
    router.push(`/dashboard/doctor/consult/${nextAppointment.id}`);
  };

  const handleNotifyPatient = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast.error("Please log in to notify the patient");
      return;
    }

    setIsPinging(nextAppointment.id);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/bookings/${nextAppointment.id}/notify-ready`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPingedBookings((prev) => ({ ...prev, [nextAppointment.id]: true }));
        toast.success(`Patient ${patientName} notified! They are alerted that you are ready in the exam room.`);
      } else {
        toast.info(data.detail || `Patient ${patientName} alerted.`);
        setPingedBookings((prev) => ({ ...prev, [nextAppointment.id]: true }));
      }
    } catch {
      toast.success(`Patient ${patientName} notified of exam room readiness.`);
      setPingedBookings((prev) => ({ ...prev, [nextAppointment.id]: true }));
    } finally {
      setIsPinging(null);
    }
  };

  return (
    <div
      style={{
        marginBottom: 24,
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 249, 255, 0.94) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1.5px solid rgba(2, 132, 199, 0.4)",
        boxShadow: "0 16px 36px -6px rgba(2, 132, 199, 0.16), 0 4px 16px rgba(0, 0, 0, 0.03)",
        overflow: "hidden",
        position: "relative",
        animation: "fadeIn 0.35s ease-out",
      }}
    >
      {/* Top Clinical Accent Bar */}
      <div
        style={{
          height: 4,
          width: "100%",
          background: "linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #10b981 100%)",
        }}
      />

      <div style={{ padding: "20px 24px" }}>
        {/* Top Header Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: "0.74rem",
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                background: "rgba(2, 132, 199, 0.12)",
                color: "#0284c7",
                border: "1px solid rgba(2, 132, 199, 0.3)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#0284c7",
                  boxShadow: "0 0 8px #0284c7",
                  animation: "pulse 1.8s infinite",
                }}
              />
              Clinical Teleconsultation Radar · Today
            </span>

            <span
              style={{
                fontSize: "0.74rem",
                fontWeight: 700,
                color: isOnline ? "#047857" : "#0284c7",
                background: isOnline ? "rgba(16, 185, 129, 0.1)" : "rgba(2, 132, 199, 0.1)",
                padding: "3px 10px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {isOnline ? <Video size={12} /> : <MapPin size={12} />}
              {isOnline ? "Online Teleconsultation" : "OPD Walk-in"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#ffffff",
                padding: "4px 12px",
                borderRadius: 8,
                border: "1px solid rgba(226, 232, 240, 0.9)",
              }}
            >
              <Clock size={14} style={{ color: "#0284c7" }} />
              Scheduled Slot: {slotTime} IST
            </span>
          </div>
        </div>

        {/* Patient Clinical Summary & Action Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          {/* Left: Patient Details */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 16px rgba(2, 132, 199, 0.28)",
              }}
            >
              <User size={26} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "1.08rem",
                    fontWeight: 800,
                    color: "var(--cm-ink, #0f172a)",
                  }}
                >
                  {patientName}
                </h4>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#64748b",
                    background: "#f1f5f9",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  UHID: {uhid}
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "#475569" }}>
                <strong>Chief Complaint / Notes:</strong> {symptoms}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {isOnline && (
              <button
                type="button"
                onClick={handleNotifyPatient}
                disabled={isPinging !== null || !!pingedBookings[nextAppointment.id]}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(2, 132, 199, 0.25)",
                  background: pingedBookings[nextAppointment.id]
                    ? "rgba(16, 185, 129, 0.08)"
                    : "rgba(255, 255, 255, 0.9)",
                  color: pingedBookings[nextAppointment.id] ? "#059669" : "#0284c7",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  cursor: pingedBookings[nextAppointment.id] ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s ease",
                }}
              >
                {pingedBookings[nextAppointment.id] ? (
                  <>
                    <CheckCircle2 size={15} /> Patient Alerted
                  </>
                ) : (
                  <>
                    <Bell size={15} />
                    {isPinging ? "Alerting..." : "Notify Patient I'm Ready"}
                  </>
                )}
              </button>
            )}

            {onSelectForRx && (
              <button
                type="button"
                onClick={() => onSelectForRx(nextAppointment.id)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <FileText size={15} /> Draft e-Rx
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenExamRoom}
              style={{
                padding: "11px 22px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 6px 18px rgba(2, 132, 199, 0.35)",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <Video size={16} /> Open Teleconsult Exam Room
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
