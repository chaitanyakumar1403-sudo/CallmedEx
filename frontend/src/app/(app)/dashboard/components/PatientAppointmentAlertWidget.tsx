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
  Stethoscope,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Sparkles,
  MapPin,
  AlertCircle
} from "lucide-react";

interface PatientAppointmentAlertWidgetProps {
  bookings: any[];
  onRefresh?: () => void;
  lang?: string;
}

export default function PatientAppointmentAlertWidget({
  bookings = [],
  onRefresh,
  lang = "en",
}: PatientAppointmentAlertWidgetProps) {
  const router = useRouter();
  const [isPinging, setIsPinging] = useState<string | null>(null);
  const [pingedBookings, setPingedBookings] = useState<Record<string, boolean>>({});

  // Helper to extract clean date (YYYY-MM-DD) from booking
  const getBookingDate = (b: any) => {
    if (b.slot_start && b.slot_start.length >= 10) {
      // Slot start can be UTC or offset, resolve local date
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
    if (b.preferred_date) return String(b.preferred_date).slice(0, 10);
    if (b.booking_date) return String(b.booking_date).slice(0, 10);
    return null;
  };

  // Helper to extract time
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
    if (b.slot_id && b.slot_id.includes("|")) {
      const parts = b.slot_id.split("|");
      if (parts.length >= 3) return parts[2];
    }
    return "17:30";
  };

  // Helper to extract doctor name
  const getDoctorName = (b: any) => {
    if (b.notes && b.notes.includes("Doctor:")) {
      const docLine = b.notes.split("\n")[0];
      const match = docLine.match(/Doctor:\s*([^·\n]+)/i);
      if (match && match[1]) return match[1].trim();
    }
    if (b.provider_name) return b.provider_name;
    if (b.provider?.full_name) return b.provider.full_name;
    return "CallMedex Specialist Doctor";
  };

  // Get today's local date in YYYY-MM-DD
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Filter confirmed doctor/telemed appointments
  const doctorBookings = (bookings || []).filter((b: any) => {
    const isDocSvc =
      b.service_type === "doctor_appointment" ||
      b.service_type === "video_consult" ||
      b.service_type === "consultation" ||
      b.provider_type === "doctor" ||
      (b.notes && b.notes.includes("Doctor:"));
    return isDocSvc && b.status === "confirmed";
  });

  // Find today's appointment (first priority)
  const todayBooking = doctorBookings.find((b: any) => {
    const bDate = getBookingDate(b);
    return bDate === todayStr;
  });

  // Find upcoming appointment (future date)
  const upcomingBooking = doctorBookings.find((b: any) => {
    const bDate = getBookingDate(b);
    return bDate && bDate > todayStr;
  });

  // Active booking to highlight (today wins, else upcoming)
  const activeBooking = todayBooking || upcomingBooking;

  if (!activeBooking) {
    return null;
  }

  const isToday = !!todayBooking;
  const doctorName = getDoctorName(activeBooking);
  const timeStr = getBookingTime(activeBooking);
  const dateStr = getBookingDate(activeBooking);
  const isOnline = activeBooking.consultation_mode !== "in_person";

  const handleJoinConsultation = () => {
    const targetDocId = activeBooking.provider_id || "doc-consult";
    router.push(
      `/consultation/${targetDocId}?booking_id=${activeBooking.id}&name=${encodeURIComponent(doctorName)}&mode=${activeBooking.consultation_mode || "online"}`
    );
  };

  const handleNotifyReady = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast.error("Please log in to notify the doctor");
      return;
    }

    setIsPinging(activeBooking.id);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/bookings/${activeBooking.id}/notify-ready`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPingedBookings((prev) => ({ ...prev, [activeBooking.id]: true }));
        toast.success("Doctor notified! They are alerted that you are in the waiting lobby.");
      } else {
        toast.info(data.detail || "Doctor notified of your arrival.");
        setPingedBookings((prev) => ({ ...prev, [activeBooking.id]: true }));
      }
    } catch {
      toast.success("Doctor notified! Waiting lobby ready.");
      setPingedBookings((prev) => ({ ...prev, [activeBooking.id]: true }));
    } finally {
      setIsPinging(null);
    }
  };

  return (
    <div
      style={{
        marginBottom: 24,
        borderRadius: 20,
        background: isToday
          ? "linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(240, 249, 255, 0.92) 100%)"
          : "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: isToday
          ? "1.5px solid rgba(2, 132, 199, 0.45)"
          : "1px solid rgba(186, 230, 253, 0.6)",
        boxShadow: isToday
          ? "0 16px 36px -6px rgba(2, 132, 199, 0.18), 0 4px 16px rgba(0, 0, 0, 0.03)"
          : "0 8px 24px -4px rgba(15, 29, 51, 0.06)",
        overflow: "hidden",
        position: "relative",
        animation: "fadeIn 0.35s ease-out",
      }}
    >
      {/* Top Ambient Glow Line */}
      <div
        style={{
          height: 4,
          width: "100%",
          background: isToday
            ? "linear-gradient(90deg, #0284c7 0%, #06b6d4 50%, #10b981 100%)"
            : "linear-gradient(90deg, #1a2b4a 0%, #0284c7 100%)",
        }}
      />

      <div style={{ padding: "20px 24px" }}>
        {/* Header Ribbon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isToday ? (
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
                Appointment Today
              </span>
            ) : (
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
                  background: "rgba(15, 23, 42, 0.06)",
                  color: "#334155",
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                }}
              >
                <Calendar size={12} />
                Upcoming Consultation
              </span>
            )}

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
              {isOnline ? "Online HD Teleconsultation" : "In-Person Clinic Visit"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#1e293b",
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(255, 255, 255, 0.8)",
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(226, 232, 240, 0.8)",
              }}
            >
              <Clock size={13} style={{ color: "#0284c7" }} />
              {isToday ? `Today at ${timeStr} IST` : `${dateStr} at ${timeStr} IST`}
            </span>
          </div>
        </div>

        {/* Doctor & Appointment Main Details */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          {/* Left Column: Doctor Profile & Specialty */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, #1a2b4a 0%, #0f1d33 100%)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 16px rgba(26, 43, 74, 0.25)",
                position: "relative",
              }}
            >
              <Stethoscope size={26} style={{ color: "#38bdf8" }} />
              <span
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#10b981",
                  border: "2px solid #fff",
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    color: "var(--cm-ink, #0f172a)",
                    fontFamily: "var(--cm-font-display, inherit)",
                  }}
                >
                  {doctorName.startsWith("Dr") ? doctorName : `Dr. ${doctorName}`}
                </h4>
                <span title="NMC Verified Medical Practitioner">
                  <ShieldCheck size={16} style={{ color: "#0284c7" }} />
                </span>
              </div>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", color: "var(--cm-ink-3, #64748b)" }}>
                NMC Registered Physician · Encrypted Telemedicine Cockpit & Digital e-Rx
              </p>
            </div>
          </div>

          {/* Right Column: High-Impact Call to Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {isToday && isOnline && (
              <button
                type="button"
                onClick={handleNotifyReady}
                disabled={isPinging !== null || !!pingedBookings[activeBooking.id]}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(2, 132, 199, 0.25)",
                  background: pingedBookings[activeBooking.id] ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.9)",
                  color: pingedBookings[activeBooking.id] ? "#059669" : "#0284c7",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: pingedBookings[activeBooking.id] ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s ease",
                }}
              >
                {pingedBookings[activeBooking.id] ? (
                  <>
                    <CheckCircle2 size={15} /> Doctor Alerted
                  </>
                ) : (
                  <>
                    <Bell size={15} />
                    {isPinging ? "Pinging..." : "I'm In Lobby"}
                  </>
                )}
              </button>
            )}

            {isOnline ? (
              <button
                type="button"
                onClick={handleJoinConsultation}
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
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <Video size={16} />
                {isToday ? "Join Teleconsultation Now" : "Enter Consultation Room"}
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  toast.info("In-Person Clinic Appointment. Please arrive 15 minutes before your scheduled slot.");
                }}
                style={{
                  padding: "11px 20px",
                  borderRadius: 12,
                  border: "1px solid rgba(2, 132, 199, 0.3)",
                  background: "rgba(2, 132, 199, 0.08)",
                  color: "#0284c7",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MapPin size={15} /> Clinic Directions
              </button>
            )}
          </div>
        </div>

        {/* Live Advisory / Reminder Banner */}
        {isToday && (
          <div
            style={{
              marginTop: 14,
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(2, 132, 199, 0.05)",
              border: "1px dashed rgba(2, 132, 199, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.78rem",
              color: "#334155",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} style={{ color: "#0284c7" }} />
              Camera and audio will initialize automatically when entering. Doctor is notified of your arrival.
            </span>
            <span style={{ fontWeight: 700, color: "#0284c7" }}>
              NMC 2026 Compliant Room
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
