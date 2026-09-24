"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bookingsAPI } from "@/lib/api";
import { customConfirm } from "@/lib/customConfirm";
import { parseBookingNotes, bookingKindLabel, formatINR, formatSlot } from "@/lib/bookingDisplay.mjs";
import DashboardShell from "../../components/DashboardShell";
import {
  Calendar, Video, FlaskConical, Stethoscope,
  Clock, CheckCircle2, XCircle, ArrowLeft, MapPin,
} from "lucide-react";

const CLOSED = ["arrived", "in_progress", "completed", "cancelled", "slot_rejected"];

export default function BookingsHistoryPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      const token = localStorage.getItem("token");
      if (!token) { setLoading(false); return; }
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
    let msg = "Cancel this booking?";
    if (currentStatus === "provider_accepted" || currentStatus === "en_route" || currentStatus === "confirmed") {
      msg = "Cancel this booking? If the provider is already on the way, or it has been more than 5 minutes since they accepted, a cancellation fee may apply.";
    }
    if (!await customConfirm(msg)) return;

    try {
      const res = await bookingsAPI.cancelBooking(bookingId);
      if (res.success) {
        toast.success(res.message || "Booking cancelled.");
        setBookings((prev) => prev.map(b => b.id === bookingId ? { ...b, status: "cancelled" } : b));
      } else {
        toast.error(res.message || "Could not cancel this booking.");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not cancel this booking.");
    }
  };

  const serviceIcon = (type: string) => {
    if (type === "video_consult" || type === "video_consultation") return <Video size={20} />;
    if (type === "lab_test" || type === "home_collection" || type === "health_package") return <FlaskConical size={20} />;
    return <Stethoscope size={20} />;
  };

  return (
    <DashboardShell
      role="patient"
      title="Your Bookings"
      subtitle="Every test, visit and consultation you have booked, newest first."
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
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      }
    >
      <div className="cm-pbk__list">
        {loading ? (
          <div className="cm-pbk-card cm-pbk-card--muted">Loading your bookings…</div>
        ) : bookings.length > 0 ? (
          bookings.map((booking: any) => {
            const shown = parseBookingNotes(booking.notes, booking.service_type);
            const isExpired = booking.status === "cancelled" && shown.autoExpired;
            const isCancelled = booking.status === "cancelled" || booking.status === "slot_rejected";
            const isCompleted = booking.status === "completed";
            const isPast = booking.slot_start && new Date(booking.slot_start).getTime() < Date.now() - 3600000;
            const tone = isExpired ? "halted" : isCancelled ? "urgent" : isCompleted ? "done"
              : booking.status === "slot_allotted" ? "waiting" : "active";
            const label = isExpired ? "Expired"
              : booking.status === "slot_rejected" ? "Slot declined"
              : String(booking.status || "").replace(/_/g, " ");
            const kindTone = booking.service_type === "lab_test" || booking.service_type === "home_collection" ? "lab"
              : booking.service_type === "video_consult" ? "video" : "visit";

            return (
              <article key={booking.id} className="cm-pbk-card">
                <div className="cm-pbk-card__main">
                  <div className={`cm-pbk-card__icon cm-pbk-card__icon--${kindTone}`}>
                    {serviceIcon(booking.service_type)}
                  </div>
                  <div className="cm-pbk-card__text">
                    <div className="cm-pbk-card__kind">{bookingKindLabel(booking.service_type)}</div>
                    <div className="cm-pbk-card__name">{shown.title}</div>
                    <div className="cm-pbk-card__meta">
                      {[formatSlot(booking.slot_start), shown.total != null ? formatINR(shown.total) : ""].filter(Boolean).join(" · ")}
                    </div>
                    {shown.address && (
                      <div className="cm-pbk-card__note" style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                        <MapPin size={12} style={{ marginTop: 2, flexShrink: 0 }} /> {shown.address}
                      </div>
                    )}
                    {shown.statusNote && <div className="cm-pbk-card__note">{shown.statusNote}</div>}
                  </div>
                </div>

                <div className="cm-pbk-card__side">
                  <span className={`cm-pbk-status cm-pbk-status--${tone}`}>
                    {isCancelled ? <XCircle size={13} /> : isCompleted || booking.status === "confirmed" ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    {label}
                  </span>
                  {!CLOSED.includes(booking.status) && !isPast && (
                    <div className="cm-pbk-card__actions">
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(booking.id, booking.status)}
                        className="cm-pbk-btn cm-pbk-btn--quiet"
                      >
                        Cancel booking
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="cm-empty" style={{ padding: "var(--cm-6)" }}>
            <span className="cm-empty__icon">
              <Calendar size={28} />
            </span>
            <p className="cm-empty__title">No bookings yet</p>
            <p className="cm-empty__body">Tests, home visits and doctor consultations you book will appear here.</p>
            <button
              type="button"
              className="cm-btn cm-btn--primary cm-btn--sm"
              style={{ marginTop: "var(--cm-4)" }}
              onClick={() => router.push("/booking")}
            >
              Book a service
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
