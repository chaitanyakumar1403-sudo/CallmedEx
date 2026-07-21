"use client";
import { useEffect, useState } from "react";
import { bookingsAPI } from "@/lib/api";

export default function BookingsHistoryPage() {
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
          setBookings(data.data.bookings || []);
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

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <a href="/dashboard/patient" style={{ textDecoration: 'none', color: 'var(--color-gray-500)', fontSize: '1.5rem' }}>←</a>
        <h1 style={{ fontSize: "2rem", fontFamily: "var(--font-heading)", margin: 0 }}>My Bookings History</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {loading ? (
          <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-500)" }}>Loading history...</div>
        ) : bookings.length > 0 ? (
          bookings.map((booking: any) => (
            <div key={booking.id} className="card" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 12,
                  background: booking.service_type === "lab_test" ? "#dbeafe" : booking.service_type === "video_consult" ? "#dcfce7" : "#fef3c7",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem"
                }}>
                  {booking.service_type === "lab_test" ? "🔬" : booking.service_type === "video_consult" ? "📹" : "🩺"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", textTransform: 'capitalize', color: '#1f2937', marginBottom: 4 }}>
                    {booking.service_type.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--color-gray-500)", marginBottom: 2 }}>
                    <strong>Date:</strong> {new Date(booking.slot_start).toLocaleDateString()} at {new Date(booking.slot_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    ID: {booking.id.substring(0,8)}... | {booking.notes || `Assigned to Provider ${booking.provider_id || 'Pending'}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <span className={`badge ${booking.status === "confirmed" ? "badge-info" : booking.status === "cancelled" ? "badge-danger" : "badge-success"}`} style={{ padding: '6px 12px', fontSize: '0.9rem', backgroundColor: booking.status === "cancelled" ? "#fee2e2" : undefined, color: booking.status === "cancelled" ? "#ef4444" : undefined }}>
                  {booking.status.replace('_', ' ')}
                </span>
                {booking.status !== "arrived" && booking.status !== "in_progress" && booking.status !== "completed" && booking.status !== "cancelled" && (
                  <button 
                    onClick={() => handleCancelBooking(booking.id, booking.status)}
                    style={{
                      background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, 
                      fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: 0
                    }}
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--color-gray-500)" }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
            <h3>No Bookings Found</h3>
            <p style={{ marginTop: 8 }}>You haven't made any bookings yet.</p>
            <a href="/booking" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block" }}>Book a Service Now</a>
          </div>
        )}
      </div>
    </div>
  );
}
