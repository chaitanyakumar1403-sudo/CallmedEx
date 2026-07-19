"use client";
import { useState, useEffect } from "react";

export default function StaffDashboard() {
  const [user, setUser] = useState<any>(null);
  const [staffProfile, setStaffProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    fetchStaffProfile();
  }, []);

  const fetchStaffProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) { setError("Not logged in"); setLoading(false); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/staff/profile`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "You must be a staff or organization user to access this dashboard.");
        setLoading(false);
        return;
      }

      if (data.success) {
        setStaffProfile(data.data);
        const orgId = data.data.linked_organization_id;
        if (orgId) {
          await fetchOrgBookings(orgId);
        } else {
          setError("Your account is not linked to any organization. Please contact your hospital admin.");
          setLoading(false);
        }
      }
    } catch {
      setError("Cannot connect to backend. Please ensure the server is running on port 8000.");
      setLoading(false);
    }
  };

  const fetchOrgBookings = async (orgId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/organization/${orgId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBookings(data.data.bookings || []);
      }
    } catch {
      console.error("Failed to fetch org bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (bookingId: string, action: "checkin" | "complete" | "cancel") => {
    setActionLoading(bookingId);
    try {
      const token = localStorage.getItem("token");
      let url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/${bookingId}/${action}`;
      let method = "PATCH";

      if (action === "cancel") {
        url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/${bookingId}/status?status=cancelled`;
      }

      const res = await fetch(url, {
        method,
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success || res.ok) {
        // Refresh bookings
        if (staffProfile?.linked_organization_id) {
          await fetchOrgBookings(staffProfile.linked_organization_id);
        }
      }
    } catch {
      console.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered bookings
  const filteredBookings = bookings.filter(b => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (filterDate) {
      const bookingDate = b.slot_start?.split("T")[0] || b.created_at?.split("T")[0] || "";
      if (bookingDate !== filterDate) return false;
    }
    return true;
  });

  // Compute stats
  const todayStr = new Date().toISOString().split("T")[0];
  const todayBookings = bookings.filter(b => (b.slot_start?.split("T")[0] || "") === todayStr);
  const confirmedToday = todayBookings.filter(b => b.status === "confirmed").length;
  const checkedInToday = todayBookings.filter(b => b.status === "checked_in").length;
  const completedToday = todayBookings.filter(b => b.status === "completed").length;
  const cancelledToday = todayBookings.filter(b => b.status === "cancelled").length;

  // Payment helpers
  // In production, each booking would have payment_status from Razorpay webhook.
  // For now, we derive it: confirmed/checked_in = prepaid, completed = settled, cancelled = refunded.
  const getPaymentStatus = (booking: any) => {
    if (booking.payment_status) return booking.payment_status; // from real API
    if (booking.status === "cancelled") return "refunded";
    if (booking.status === "completed") return "settled";
    if (booking.service_type === "home_collection" || booking.service_type === "home_visit") return "pay_on_service";
    return "prepaid";
  };

  const getPaymentBadge = (booking: any) => {
    const ps = getPaymentStatus(booking);
    const map: Record<string, { label: string; bg: string; color: string }> = {
      prepaid: { label: "💳 Prepaid", bg: "#dcfce7", color: "#166534" },
      pay_on_service: { label: "🏪 Pay at Counter", bg: "#fef3c7", color: "#92400e" },
      settled: { label: "✅ Settled", bg: "#f0fdf4", color: "#15803d" },
      refunded: { label: "↩ Refunded", bg: "#fee2e2", color: "#991b1b" },
      pending: { label: "⏳ Pending", bg: "#fef3c7", color: "#92400e" },
    };
    const s = map[ps] || { label: ps, bg: "#f3f4f6", color: "#374151" };
    return (
      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 12, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  };

  // Revenue calculations (demo: use fixed avg fee per service type)
  const feeMap: Record<string, number> = {
    doctor_appointment: 500, lab_test: 400, video_consult: 600,
    home_collection: 350, home_visit: 700,
  };
  const getBookingFee = (b: any) => b.amount || feeMap[b.service_type] || 400;
  const todayRevenue = todayBookings.filter(b => b.status !== "cancelled").reduce((sum, b) => sum + getBookingFee(b), 0);
  const prepaidCount = todayBookings.filter(b => getPaymentStatus(b) === "prepaid").length;
  const payAtCounterCount = todayBookings.filter(b => getPaymentStatus(b) === "pay_on_service").length;
  const settledCount = todayBookings.filter(b => getPaymentStatus(b) === "settled").length;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      confirmed: { label: "✅ Confirmed", bg: "#dcfce7", color: "#166534" },
      checked_in: { label: "🏥 Checked In", bg: "#dbeafe", color: "#1e40af" },
      completed: { label: "✔ Completed", bg: "#f0fdf4", color: "#15803d" },
      cancelled: { label: "✖ Cancelled", bg: "#fee2e2", color: "#991b1b" },
      pending: { label: "⏳ Pending", bg: "#fef3c7", color: "#92400e" },
    };
    const s = map[status] || { label: status, bg: "#f3f4f6", color: "#374151" };
    return (
      <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20, fontWeight: 700, backgroundColor: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  };

  const getServiceIcon = (type: string) => {
    const icons: Record<string, string> = {
      doctor_appointment: "🩺", lab_test: "🔬", video_consult: "📹",
      home_collection: "🩸", home_visit: "🏠",
    };
    return icons[type] || "📋";
  };

  const formatTime = (isoStr: string) => {
    if (!isoStr) return "—";
    try {
      const timePart = isoStr.split("T")[1]?.substring(0, 5);
      if (!timePart) return "—";
      const [h, m] = timePart.split(":").map(Number);
      if (h === 0) return `12:${m.toString().padStart(2, '0')} AM`;
      if (h < 12) return `${h}:${m.toString().padStart(2, '0')} AM`;
      if (h === 12) return `12:${m.toString().padStart(2, '0')} PM`;
      return `${h - 12}:${m.toString().padStart(2, '0')} PM`;
    } catch { return "—"; }
  };

  // Date navigation
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i - 1);
    return { value: d.toISOString().split("T")[0], label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }), isToday: i === 1 };
  });

  if (error) {
    return (
      <div className="dashboard">
        <div className="container">
          <div className="dashboard__header">
            <div><h1>Staff Dashboard 👤</h1></div>
          </div>
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontFamily: "var(--font-body)", marginBottom: 8 }}>{error}</h3>
            <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem" }}>
              Make sure you are logged in as a <strong>Staff</strong> or <strong>Organization</strong> user.
            </p>
            <a href="/auth/login" className="btn btn-primary" style={{ marginTop: 16 }}>Go to Login</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="container">
        {/* Header */}
        <div className="dashboard__header">
          <div>
            <h1>Staff Dashboard 👤</h1>
            <p className="dashboard__greeting">
              {staffProfile?.organization_name
                ? `Managing bookings for ${staffProfile.organization_name}`
                : staffProfile?.staff_role
                  ? `${staffProfile.staff_role} · ${staffProfile.department || "General"}`
                  : "Manage your organization's appointments & patient flow"}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {staffProfile?.verification_status === "pending" ? (
              <span className="badge badge-warning">⏳ Verification Pending</span>
            ) : (
              <span className="badge badge-success">✅ Verified</span>
            )}
          </div>
        </div>

        {/* Today's Stats */}
        <div className="stats-grid">
          <div className="card stat-card">
            <div className="stat-card__icon" style={{ background: "#dbeafe", color: "#2563eb" }}>📋</div>
            <div>
              <div className="stat-card__value">{confirmedToday}</div>
              <div className="stat-card__label">Upcoming Today</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-card__icon" style={{ background: "#fef3c7", color: "#d97706" }}>🏥</div>
            <div>
              <div className="stat-card__value">{checkedInToday}</div>
              <div className="stat-card__label">Checked In</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-card__icon" style={{ background: "#dcfce7", color: "#16a34a" }}>✅</div>
            <div>
              <div className="stat-card__value">{completedToday}</div>
              <div className="stat-card__label">Completed</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-card__icon" style={{ background: "#fee2e2", color: "#dc2626" }}>❌</div>
            <div>
              <div className="stat-card__value">{cancelledToday}</div>
              <div className="stat-card__label">Cancelled</div>
            </div>
          </div>
        </div>

        {/* Revenue & Payment Summary */}
        <div className="card" style={{ padding: 20, marginBottom: 24, background: 'linear-gradient(135deg, #f0fff4 0%, #ebf8ff 100%)', border: '1px solid #c6f6d5' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#1a2b4a', marginBottom: 12, fontFamily: 'var(--font-body)' }}>💰 Today&apos;s Payment Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2f855a' }}>₹{todayRevenue.toLocaleString()}</div>
              <div style={{ fontSize: '0.72rem', color: '#718096', fontWeight: 600 }}>Today&apos;s Revenue</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb' }}>{prepaidCount}</div>
              <div style={{ fontSize: '0.72rem', color: '#718096', fontWeight: 600 }}>💳 Prepaid Online</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706' }}>{payAtCounterCount}</div>
              <div style={{ fontSize: '0.72rem', color: '#718096', fontWeight: 600 }}>🏪 Pay at Counter</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{settledCount}</div>
              <div style={{ fontSize: '0.72rem', color: '#718096', fontWeight: 600 }}>✅ Settled to Bank</div>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#a0aec0', marginTop: 8, textAlign: 'center' }}>
            💡 In production, revenue is settled to your bank via Razorpay Route within T+1 day, minus platform commission.
          </div>
        </div>

        {/* Date Selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {dates.map(d => (
            <div key={d.value}
              style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', minWidth: 80,
                border: filterDate === d.value ? '2px solid #1a2b4a' : '2px solid #e2e8f0',
                backgroundColor: filterDate === d.value ? '#1a2b4a' : 'white',
                color: filterDate === d.value ? 'white' : 'inherit',
                transition: 'all 0.2s',
              }}
              onClick={() => setFilterDate(d.value)}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{d.label}</div>
              {d.isToday && <div style={{ fontSize: '0.6rem', opacity: 0.8, marginTop: 2 }}>Today</div>}
            </div>
          ))}
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { key: "all", label: "All" },
            { key: "confirmed", label: "✅ Confirmed" },
            { key: "checked_in", label: "🏥 Checked In" },
            { key: "completed", label: "✔ Completed" },
            { key: "cancelled", label: "✖ Cancelled" },
          ].map(f => (
            <button key={f.key} className={`chip ${filterStatus === f.key ? 'active' : ''}`}
              style={{ cursor: 'pointer', border: filterStatus === f.key ? '2px solid #1a2b4a' : '2px solid #e2e8f0', borderRadius: 20, padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: filterStatus === f.key ? '#1a2b4a' : 'white', color: filterStatus === f.key ? 'white' : '#4a5568', transition: 'all 0.2s' }}
              onClick={() => setFilterStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", marginBottom: 12 }}>
          Appointments ({filteredBookings.length})
        </h3>

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--color-gray-500)" }}>
            Loading bookings...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
            <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8, color: "#718096" }}>
              No appointments for this date/filter
            </h3>
            <p style={{ color: "#a0aec0", fontSize: "0.85rem" }}>
              Bookings will appear here when patients book appointments at your organization.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredBookings.map((booking: any) => (
              <div key={booking.id} className="card" style={{ padding: 20, transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  {/* Left: Details */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      backgroundColor: booking.service_type === "lab_test" ? "#dbeafe" : booking.service_type === "video_consult" ? "#f3e8ff" : "#fef3c7",
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem'
                    }}>
                      {getServiceIcon(booking.service_type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#1a2b4a', fontSize: '0.95rem' }}>
                          {booking.notes || booking.service_type?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </span>
                        {getStatusBadge(booking.status)}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.82rem', color: '#718096', alignItems: 'center' }}>
                        <span>🕐 {formatTime(booking.slot_start)}{booking.slot_end ? ` – ${formatTime(booking.slot_end)}` : ''}</span>
                        <span>📅 {booking.slot_start?.split("T")[0] || booking.created_at?.split("T")[0] || "—"}</span>
                        <span>🆔 {booking.patient_id?.substring(0, 8)}...</span>
                        <span style={{ fontWeight: 700, color: '#2f855a' }}>₹{getBookingFee(booking)}</span>
                        {getPaymentBadge(booking)}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {booking.status === "confirmed" && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', backgroundColor: '#2563eb', borderColor: '#2563eb' }}
                        disabled={actionLoading === booking.id}
                        onClick={() => handleAction(booking.id, "checkin")}
                      >
                        {actionLoading === booking.id ? "..." : "🏥 Check In"}
                      </button>
                    )}
                    {booking.status === "checked_in" && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                        disabled={actionLoading === booking.id}
                        onClick={() => handleAction(booking.id, "complete")}
                      >
                        {actionLoading === booking.id ? "..." : "✅ Complete"}
                      </button>
                    )}
                    {(booking.status === "confirmed" || booking.status === "checked_in") && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fecaca' }}
                        disabled={actionLoading === booking.id}
                        onClick={() => handleAction(booking.id, "cancel")}
                      >
                        ✖ Cancel
                      </button>
                    )}
                    {(booking.status === "completed" || booking.status === "cancelled") && (
                      <span style={{ fontSize: '0.78rem', color: '#a0aec0', fontStyle: 'italic' }}>No actions</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Organization Info Footer */}
        {staffProfile && (
          <div className="card" style={{ marginTop: 32, padding: 20, backgroundColor: '#f7fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Linked Organization</div>
                <div style={{ fontWeight: 700, color: '#1a2b4a', marginTop: 2 }}>
                  {staffProfile.organization_name || `Org ID: ${staffProfile.linked_organization_id || "Not linked"}`}
                </div>
                {staffProfile.organization_type && (
                  <div style={{ fontSize: '0.82rem', color: '#718096', marginTop: 2 }}>
                    Type: {staffProfile.organization_type} · Staff Role: {staffProfile.staff_role || "General"}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#a0aec0' }}>
                Total Bookings: {bookings.length}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
