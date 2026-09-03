"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bookingsAPI } from "@/lib/api";
import DashboardShell from "../../components/DashboardShell";
import {
  Calendar, Video, FlaskConical, Stethoscope, Activity,
  Clock, CheckCircle2, XCircle, ArrowLeft,
} from "lucide-react";

export default function BookingsHistoryPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setBookings(data.data?.bookings || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string, currentStatus: string) => {
    let msg = "Are you sure you want to cancel this booking?";
    if (currentStatus === "provider_accepted" || currentStatus === "en_route" || currentStatus === "confirmed") {
      msg = "Are you sure? If the provider is already on the way or it has been more than 5 minutes since acceptance, a cancellation fee may apply.";
    }
    if (!confirm(msg)) return;

    try {
      const res = await bookingsAPI.cancelBooking(bookingId);
      if (res.success) {
        alert(res.message);
        setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
      } else {
        alert(res.message || "Failed to cancel booking");
      }
    } catch (e: any) {
      alert(e.message || "Failed to cancel booking");
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "video_consult":
        return <Video size={20} />;
      case "lab_test":
      case "home_collection":
        return <FlaskConical size={20} />;
      default:
        return <Stethoscope size={20} />;
    }
  };

  return (
    <DashboardShell
      role="patient"
      title="Appointment & Booking History"
      subtitle="Complete chronological timeline of your diagnostic tests and specialist consultations."
      tabs={[]}
      activeTab=""
      onTabChange={() => {}}
      aside={
        <button
          type="button"
          onClick={() => router.push("/dashboard/patient")}
          className="cm-btn cm-btn--secondary cm-btn--sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} /> Back to Command Center
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
        {loading ? (
          <div className="cm-panel" style={{ padding: "var(--cm-6)", textAlign: "center", color: "var(--cm-ink-3)" }}>
            Loading your bookings history...
          </div>
        ) : bookings.length > 0 ? (
          bookings.map((booking: any) => {
            const isCancelled = booking.status === "cancelled" || booking.status === "slot_rejected";
            const isConfirmed = booking.status === "confirmed";
            const isCompleted = booking.status === "completed";

            return (
              <div
                key={booking.id}
                className="cm-card"
                style={{
                  padding: "var(--cm-4) var(--cm-5)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--cm-3)",
                  border: "1px solid var(--cm-line)",
                  borderRadius: "var(--cm-radius)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-4)" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--cm-radius)",
                      background: "var(--cm-surface-2)",
                      color: "var(--cm-navy)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getServiceIcon(booking.service_type)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "var(--cm-text-base)", textTransform: "capitalize", color: "var(--cm-ink)" }}>
                      {booking.service_type.replace(/_/g, " ")}
                    </div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                      <span>Date: <strong>{new Date(booking.slot_start).toLocaleDateString()}</strong> at {new Date(booking.slot_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-faint)", marginTop: 2, fontFamily: "monospace" }}>
                      ID: {booking.id.substring(0, 8)}... · {booking.notes || `Provider: ${booking.provider_id || "Assigned"}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--cm-2)" }}>
                  <span
                    className={`cm-pill ${
                      isCancelled
                        ? "cm-pill--urgent"
                        : isCompleted
                        ? "cm-pill--done"
                        : isConfirmed
                        ? "cm-pill--active"
                        : "cm-pill--waiting"
                    }`}
                  >
                    {isCancelled ? <XCircle size={12} /> : isConfirmed || isCompleted ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {booking.status.replace(/_/g, " ")}
                  </span>

                  {booking.status !== "arrived" && booking.status !== "in_progress" && booking.status !== "completed" && booking.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() => handleCancelBooking(booking.id, booking.status)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--cm-urgent)",
                        fontWeight: 700,
                        fontSize: "var(--cm-text-xs)",
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="cm-empty" style={{ padding: "var(--cm-6)" }}>
            <span className="cm-empty__icon">
              <Calendar size={28} />
            </span>
            <p className="cm-empty__title">No Bookings Found</p>
            <p className="cm-empty__body">You haven&apos;t scheduled any diagnostic tests or doctor visits yet.</p>
            <button
              type="button"
              className="cm-btn cm-btn--primary cm-btn--sm"
              style={{ marginTop: "var(--cm-4)" }}
              onClick={() => router.push("/booking")}
            >
              Book a Service Now
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
