"use client";
import { useState, useEffect } from "react";
import DashboardShell from "../components/DashboardShell";
import {
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Banknote,
  RotateCcw,
  Stethoscope,
  Activity,
  Video,
  Droplet,
  Home,
  ClipboardList,
  AlertTriangle,
  DollarSign
} from 'lucide-react';

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
    const map: Record<string, { label: string; icon: any; bg: string; color: string; border: string }> = {
      prepaid: { label: "Prepaid", icon: CreditCard, bg: "var(--cm-done-surface)", color: "var(--cm-done)", border: "var(--cm-done-line)" },
      pay_on_service: { label: "Pay at Counter", icon: Banknote, bg: "var(--cm-waiting-surface)", color: "var(--cm-waiting)", border: "var(--cm-waiting-line)" },
      settled: { label: "Settled", icon: CheckCircle2, bg: "var(--cm-done-surface)", color: "var(--cm-done)", border: "var(--cm-done-line)" },
      refunded: { label: "Refunded", icon: RotateCcw, bg: "var(--cm-urgent-surface)", color: "var(--cm-urgent)", border: "var(--cm-urgent-line)" },
      pending: { label: "Pending", icon: Clock, bg: "var(--cm-waiting-surface)", color: "var(--cm-waiting)", border: "var(--cm-waiting-line)" },
    };
    const s = map[ps] || { label: ps, icon: CreditCard, bg: "var(--cm-surface-3)", color: "var(--cm-ink)", border: "var(--cm-line)" };
    const IconComp = s.icon;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', padding: '2px 8px', borderRadius: 12, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
        <IconComp size={11} />
        {s.label}
      </span>
    );
  };

  // Only count money the booking actually carries. This previously fell back to
  // a hardcoded fee per service type (500 / 400 / 600 / 350 / 700) and then to a
  // flat 400, so a desk showing "today's revenue" was reporting a figure the
  // platform had invented for every booking whose price had not been recorded.
  //
  // Bookings without a price are counted separately rather than guessed at, so
  // the total is understated-but-true instead of confident-and-wrong.
  const priced = todayBookings.filter(b => b.status !== "cancelled" && typeof b.amount === "number");
  const unpricedCount = todayBookings.filter(
    b => b.status !== "cancelled" && typeof b.amount !== "number"
  ).length;
  const todayRevenue = priced.reduce((sum, b) => sum + b.amount, 0);
  const prepaidCount = todayBookings.filter(b => getPaymentStatus(b) === "prepaid").length;
  const payAtCounterCount = todayBookings.filter(b => getPaymentStatus(b) === "pay_on_service").length;
  const settledCount = todayBookings.filter(b => getPaymentStatus(b) === "settled").length;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; icon: any; bg: string; color: string; border: string }> = {
      confirmed: { label: "Confirmed", icon: CheckCircle2, bg: "var(--cm-done-surface)", color: "var(--cm-done)", border: "var(--cm-done-line)" },
      checked_in: { label: "Checked In", icon: Building2, bg: "var(--cm-active-surface)", color: "var(--cm-active)", border: "var(--cm-active-line)" },
      completed: { label: "Completed", icon: CheckCircle2, bg: "var(--cm-done-surface)", color: "var(--cm-done)", border: "var(--cm-done-line)" },
      cancelled: { label: "Cancelled", icon: XCircle, bg: "var(--cm-urgent-surface)", color: "var(--cm-urgent)", border: "var(--cm-urgent-line)" },
      pending: { label: "Pending", icon: Clock, bg: "var(--cm-waiting-surface)", color: "var(--cm-waiting)", border: "var(--cm-waiting-line)" },
    };
    const s = map[status] || { label: status, icon: Clock, bg: "var(--cm-surface-3)", color: "var(--cm-ink)", border: "var(--cm-line)" };
    const IconComp = s.icon;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
        <IconComp size={12} />
        {s.label}
      </span>
    );
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "doctor_appointment": return <Stethoscope size={20} />;
      case "lab_test": return <Activity size={20} />;
      case "video_consult": return <Video size={20} />;
      case "home_collection": return <Droplet size={20} />;
      case "home_visit": return <Home size={20} />;
      default: return <ClipboardList size={20} />;
    }
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

  // The error state is a full replacement for the dashboard, so it takes the
  // same shell rather than falling back to the old page chrome — an error screen
  // that looks like a different product is its own small alarm.
  if (error) {
    return (
      <DashboardShell
        role="staff"
        title="Staff Desk"
        subtitle="We could not open this dashboard."
        tabs={[]}
        activeTab=""
        onTabChange={() => {}}
      >
        <div className="cm-empty">
          <div className="cm-empty__icon" aria-hidden="true">⚠️</div>
          <p className="cm-empty__title">{error}</p>
          <p className="cm-empty__body">
            This dashboard is for <strong>Staff</strong> and <strong>Organization</strong> accounts.
            Sign in with one of those to continue.
          </p>
          <div style={{ marginTop: 16 }}>
            <a href="/auth/login" className="btn btn-primary">Go to login</a>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="staff"
      title="Staff Desk"
      subtitle={
        staffProfile?.organization_name
          ? `Bookings for ${staffProfile.organization_name}`
          : staffProfile?.staff_role
            ? `${staffProfile.staff_role} · ${staffProfile.department || "General"}`
            : "Appointments and patient flow"
      }
      tabs={[]}
      activeTab=""
      onTabChange={() => {}}
      aside={
        <span className={`cm-pill cm-pill--${staffProfile?.verification_status === "pending" ? "waiting" : "done"}`}>
          {staffProfile?.verification_status === "pending" ? "Verification pending" : "Verified"}
        </span>
      }
    >
        {/* Today's Stats */}
        <div className="cm-kpi-grid">
          <div className="cm-kpi-card" onClick={() => setFilterStatus("confirmed")} style={{ cursor: "pointer" }}>
            <div className="cm-kpi-card__accent cm-kpi-card__accent--active" />
            <div>
              <div className="cm-kpi-card__label">Upcoming Today</div>
              <div className="cm-kpi-card__value">{confirmedToday}</div>
              <div className="cm-kpi-card__subtitle">Scheduled intake</div>
            </div>
            <div className="cm-kpi-card__icon" style={{ background: "var(--cm-active-surface)", color: "var(--cm-active)" }}>
              <ClipboardList size={22} />
            </div>
          </div>

          <div className="cm-kpi-card" onClick={() => setFilterStatus("checked_in")} style={{ cursor: "pointer" }}>
            <div className="cm-kpi-card__accent cm-kpi-card__accent--waiting" />
            <div>
              <div className="cm-kpi-card__label">Checked In</div>
              <div className="cm-kpi-card__value">{checkedInToday}</div>
              <div className="cm-kpi-card__subtitle">In waiting area</div>
            </div>
            <div className="cm-kpi-card__icon" style={{ background: "var(--cm-waiting-surface)", color: "var(--cm-waiting)" }}>
              <Building2 size={22} />
            </div>
          </div>

          <div className="cm-kpi-card" onClick={() => setFilterStatus("completed")} style={{ cursor: "pointer" }}>
            <div className="cm-kpi-card__accent cm-kpi-card__accent--done" />
            <div>
              <div className="cm-kpi-card__label">Completed</div>
              <div className="cm-kpi-card__value">{completedToday}</div>
              <div className="cm-kpi-card__subtitle">Discharged / routed</div>
            </div>
            <div className="cm-kpi-card__icon" style={{ background: "var(--cm-done-surface)", color: "var(--cm-done)" }}>
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="cm-kpi-card" onClick={() => setFilterStatus("cancelled")} style={{ cursor: "pointer" }}>
            <div className="cm-kpi-card__accent cm-kpi-card__accent--urgent" />
            <div>
              <div className="cm-kpi-card__label">Cancelled</div>
              <div className="cm-kpi-card__value">{cancelledToday}</div>
              <div className="cm-kpi-card__subtitle">No-shows / drops</div>
            </div>
            <div className="cm-kpi-card__icon" style={{ background: "var(--cm-urgent-surface)", color: "var(--cm-urgent)" }}>
              <XCircle size={22} />
            </div>
          </div>
        </div>

        {/* Revenue & Payment Summary */}
        <div style={{ padding: 20, marginBottom: 24, background: 'var(--cm-surface)', borderRadius: 12, border: '1px solid var(--cm-line)' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--cm-navy)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <DollarSign size={16} color="var(--cm-done)" />
            Today&apos;s Payment Summary
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'var(--cm-surface-2)', borderRadius: 10, border: '1px solid var(--cm-line)' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--cm-done)' }}>₹{todayRevenue.toLocaleString()}</div>
              {unpricedCount > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--cm-ink-3)', marginTop: 2 }}>
                  excludes {unpricedCount} booking{unpricedCount === 1 ? '' : 's'} with no price recorded
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: 'var(--cm-ink-3)', fontWeight: 600 }}>Today&apos;s Revenue</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'var(--cm-surface-2)', borderRadius: 10, border: '1px solid var(--cm-line)' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--cm-active)' }}>{prepaidCount}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--cm-ink-3)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <CreditCard size={12} /> Prepaid Online
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'var(--cm-surface-2)', borderRadius: 10, border: '1px solid var(--cm-line)' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--cm-waiting)' }}>{payAtCounterCount}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--cm-ink-3)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Banknote size={12} /> Pay at Counter
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, backgroundColor: 'var(--cm-surface-2)', borderRadius: 10, border: '1px solid var(--cm-line)' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--cm-done)' }}>{settledCount}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--cm-ink-3)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <CheckCircle2 size={12} /> Settled to Bank
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--cm-ink-3)', marginTop: 8, textAlign: 'center' }}>
            In production, revenue is settled to your bank via Razorpay Route within T+1 day, minus platform commission.
          </div>
        </div>

        {/* Date Selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {dates.map(d => (
            <div key={d.value}
              style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', minWidth: 80,
                border: filterDate === d.value ? '2px solid var(--cm-navy)' : '1px solid var(--cm-line)',
                backgroundColor: filterDate === d.value ? 'var(--cm-navy)' : 'var(--cm-surface)',
                color: filterDate === d.value ? '#ffffff' : 'var(--cm-ink)',
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
            { key: "confirmed", label: "Confirmed" },
            { key: "checked_in", label: "Checked In" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Cancelled" },
          ].map(f => (
            <button key={f.key} className={`chip ${filterStatus === f.key ? 'active' : ''}`}
              style={{
                cursor: 'pointer',
                border: filterStatus === f.key ? '2px solid var(--cm-navy)' : '1px solid var(--cm-line)',
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: filterStatus === f.key ? 'var(--cm-navy)' : 'var(--cm-surface)',
                color: filterStatus === f.key ? '#ffffff' : 'var(--cm-ink-2)',
                transition: 'all 0.2s'
              }}
              onClick={() => setFilterStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--cm-navy)", marginBottom: 12 }}>
          Appointments ({filteredBookings.length})
        </h3>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--cm-ink-3)", background: "var(--cm-surface)", borderRadius: 12, border: "1px solid var(--cm-line)" }}>
            Loading bookings...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", background: "var(--cm-surface)", borderRadius: 12, border: "1px solid var(--cm-line)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--cm-surface-3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--cm-ink-3)" }}>
              <ClipboardList size={24} />
            </div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 6, color: "var(--cm-navy)" }}>
              No appointments for this date/filter
            </h3>
            <p style={{ color: "var(--cm-ink-3)", fontSize: "0.85rem" }}>
              Bookings will appear here when patients book appointments at your organization.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredBookings.map((booking: any) => (
              <div key={booking.id} style={{ padding: 20, background: "var(--cm-surface)", borderRadius: 12, border: "1px solid var(--cm-line)", transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  {/* Left: Details */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      backgroundColor: booking.service_type === "lab_test" ? "var(--cm-active-surface)" : booking.service_type === "video_consult" ? "var(--cm-surface-3)" : "var(--cm-waiting-surface)",
                      color: booking.service_type === "lab_test" ? "var(--cm-active)" : booking.service_type === "video_consult" ? "var(--cm-navy)" : "var(--cm-waiting)",
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {getServiceIcon(booking.service_type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--cm-navy)', fontSize: '0.95rem' }}>
                          {booking.notes || booking.service_type?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </span>
                        {getStatusBadge(booking.status)}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--cm-ink-2)', alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} color="var(--cm-ink-3)" />
                          {formatTime(booking.slot_start)}{booking.slot_end ? ` – ${formatTime(booking.slot_end)}` : ''}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} color="var(--cm-ink-3)" />
                          {booking.slot_start?.split("T")[0] || booking.created_at?.split("T")[0] || "—"}
                        </span>
                        <span>ID: {booking.patient_id?.substring(0, 8)}...</span>
                        <span style={{ fontWeight: 700, color: typeof booking.amount === "number" ? 'var(--cm-done)' : 'var(--cm-ink-3)' }}>
                          {typeof booking.amount === "number" ? `₹${booking.amount}` : "Price not set"}
                        </span>
                        {getPaymentBadge(booking)}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {booking.status === "confirmed" && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        disabled={actionLoading === booking.id}
                        onClick={() => handleAction(booking.id, "checkin")}
                      >
                        <Building2 size={13} />
                        {actionLoading === booking.id ? "..." : "Check In"}
                      </button>
                    )}
                    {booking.status === "checked_in" && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', backgroundColor: 'var(--cm-done)', borderColor: 'var(--cm-done)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        disabled={actionLoading === booking.id}
                        onClick={() => handleAction(booking.id, "complete")}
                      >
                        <CheckCircle2 size={13} />
                        {actionLoading === booking.id ? "..." : "Complete"}
                      </button>
                    )}
                    {(booking.status === "confirmed" || booking.status === "checked_in") && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', color: 'var(--cm-urgent)', borderColor: 'var(--cm-urgent-line)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        disabled={actionLoading === booking.id}
                        onClick={() => handleAction(booking.id, "cancel")}
                      >
                        <XCircle size={13} />
                        Cancel
                      </button>
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
    </DashboardShell>
  );
}
