"use client";

/**
 * ProviderSchedulePanel — a consulting provider's bookable schedule.
 *
 * Physiotherapists, dietitians and nurses sell three distinct things and each
 * needs its own hours:
 *
 *   Walk-in centre (in_person) — the clinic they sit at, with a name and
 *                                address the patient has to travel to
 *   Online (online)            — teleconsultation windows
 *   Home visit (home_visit)    — the windows they will travel to a patient in
 *
 * Until now none of these providers could publish a single slot: the
 * availability, fee and blocked-date endpoints were all gated to `doctor`.
 * The patient-facing slot picker reads exactly what is set here, filtered by
 * mode, so a walk-in booking can never be offered a teleconsult slot.
 */

import { useCallback, useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Calendar, CalendarDays, Clock, MapPin, Plus, Trash2 } from "@/components/ui/icons";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

const DAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// Must match doctor_availability.consultation_mode and consultation_fees.fee_type.
const MODES = [
  {
    value: "in_person",
    label: "Walk-in centre",
    hint: "Patients travel to your clinic — needs a centre name and address",
    needsLocation: true,
  },
  {
    value: "online",
    label: "Online consultation",
    hint: "Video teleconsultation from wherever you are",
    needsLocation: false,
  },
  {
    value: "home_visit",
    label: "Home visit",
    hint: "You travel to the patient — these hours drive doorstep requests",
    needsLocation: false,
  },
];

interface Availability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  consultation_mode: string;
  location_name?: string;
  location_address?: string;
  is_active?: boolean;
}

interface Fee {
  id: string;
  fee_type: string;
  amount: number;
}

export default function ProviderSchedulePanel({
  roleLabel = "practice",
}: {
  roleLabel?: string;
}) {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "13:00",
    slot_duration_minutes: 30,
    consultation_mode: "in_person",
    location_name: "",
    location_address: "",
    apply_to_all_days: false,
    replace_existing: false,
  });
  const [feeForm, setFeeForm] = useState({ fee_type: "in_person", amount: "" });
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  const load = useCallback(async () => {
    if (!getToken()) return;
    try {
      const [a, f, b] = await Promise.all([
        fetch(`${apiBase}/api/providers/my-availability`, { headers: authHeaders() }),
        fetch(`${apiBase}/api/providers/my-fees`, { headers: authHeaders() }),
        fetch(`${apiBase}/api/providers/my-blocked-dates`, { headers: authHeaders() }),
      ]);
      if (a.ok) {
        const d = await a.json();
        if (d.success) setAvailability(d.availability || []);
      }
      if (f.ok) {
        const d = await f.json();
        if (d.success) setFees(d.fees || []);
      }
      if (b.ok) {
        const d = await b.json();
        if (d.success) setBlockedDates(d.blocked_dates || []);
      }
    } catch {
      setMsg({ text: "Could not load your schedule. Check your connection.", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedMode = MODES.find((m) => m.value === form.consultation_mode);

  const addAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.start_time >= form.end_time) {
      setMsg({ text: "Start time must be before end time.", ok: false });
      return;
    }
    // A walk-in block with no centre name is unbookable — the patient has
    // nowhere to go. Refuse it here rather than publishing a dead slot.
    if (selectedMode?.needsLocation && !form.location_name.trim()) {
      setMsg({ text: "Give your walk-in centre a name so patients know where to come.", ok: false });
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/providers/availability`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg({ text: data.message || "Availability saved.", ok: true });
        setShowForm(false);
        load();
      } else {
        setMsg({ text: data.detail || "Could not save availability.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error — availability not saved.", ok: false });
    }
  };

  const removeAvailability = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/api/providers/availability/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        setMsg({ text: "Availability block removed.", ok: true });
        load();
      }
    } catch {
      setMsg({ text: "Could not remove that block.", ok: false });
    }
  };

  const saveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(feeForm.amount);
    if (!amount || amount <= 0) {
      setMsg({ text: "Enter a fee greater than zero.", ok: false });
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/providers/fees`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ fee_type: feeForm.fee_type, amount }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg({ text: data.message || "Fee saved.", ok: true });
        setFeeForm({ ...feeForm, amount: "" });
        load();
      } else {
        setMsg({ text: data.detail || "Could not save fee.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error — fee not saved.", ok: false });
    }
  };

  const addBlockedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDate) return;
    try {
      const res = await fetch(`${apiBase}/api/providers/blocked-dates`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ blocked_date: blockDate, reason: blockReason }),
      });
      if (res.ok) {
        setMsg({ text: `${blockDate} marked as unavailable.`, ok: true });
        setBlockDate("");
        setBlockReason("");
        load();
      }
    } catch {
      setMsg({ text: "Could not block that date.", ok: false });
    }
  };

  const removeBlockedDate = async (id: string) => {
    try {
      await fetch(`${apiBase}/api/providers/blocked-dates/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      load();
    } catch {
      setMsg({ text: "Could not unblock that date.", ok: false });
    }
  };

  const byMode = (mode: string) => availability.filter((a) => a.consultation_mode === mode);
  const feeFor = (type: string) => fees.find((f) => f.fee_type === type);

  if (loading) {
    return <div className="card" style={{ padding: 24, color: "#64748b" }}>Loading your schedule…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {msg && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            fontSize: "0.88rem",
            fontWeight: 600,
            backgroundColor: msg.ok ? "#f0fdf4" : "#fef2f2",
            color: msg.ok ? "#166534" : "#b91c1c",
            border: `1px solid ${msg.ok ? "#86efac" : "#fca5a5"}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* ── Fees per mode ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
          Your fees
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748b" }}>
          Set a price for each way you work. You keep 80%; CallMedex takes 20%.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          {MODES.map((m) => {
            const fee = feeFor(m.value);
            return (
              <div key={m.value} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 700, color: "#64748b" }}>
                  {m.label}
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: fee ? "#0f172a" : "#94a3b8", marginTop: 4 }}>
                  {fee ? `₹${fee.amount}` : "Not set"}
                </div>
                {fee && (
                  <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: 2 }}>
                    You receive ₹{Math.round(fee.amount * 0.8)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <form onSubmit={saveFee} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
            Mode
            <select
              value={feeForm.fee_type}
              onChange={(e) => setFeeForm({ ...feeForm, fee_type: e.target.value })}
              style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 170 }}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
            Fee (₹)
            <input
              type="number"
              min={1}
              value={feeForm.amount}
              onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
              placeholder="e.g. 600"
              style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", width: 140 }}
            />
          </label>
          <Button type="submit" variant="primary">Save fee</Button>
        </form>
      </div>

      {/* ── Weekly availability ───────────────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
            Weekly availability
          </h3>
          <Button variant="secondary" onClick={() => setShowForm((s) => !s)}>
            <Icon as={Plus} size={16} />
            {showForm ? "Cancel" : "Add hours"}
          </Button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748b" }}>
          These are the exact slots patients can book across your {roleLabel}.
        </p>

        {showForm && (
          <form onSubmit={addAvailability} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 18, background: "#f8fafc" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                How you see the patient
                <select
                  value={form.consultation_mode}
                  onChange={(e) => setForm({ ...form, consultation_mode: e.target.value })}
                  style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                Day
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                  disabled={form.apply_to_all_days}
                  style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                From
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                To
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                Appointment length
                <select
                  value={form.slot_duration_minutes}
                  onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })}
                  style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  {[15, 20, 30, 45, 60, 90].map((d) => (
                    <option key={d} value={d}>{d} minutes</option>
                  ))}
                </select>
              </label>
            </div>

            {selectedMode?.needsLocation && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                  Centre name
                  <input
                    value={form.location_name}
                    onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                    placeholder="e.g. Gajuwaka Physio Centre"
                    style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                  Centre address
                  <input
                    value={form.location_address}
                    onChange={(e) => setForm({ ...form, location_address: e.target.value })}
                    placeholder="Street, area, city"
                    style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14, fontSize: "0.83rem", color: "#334155" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.apply_to_all_days}
                  onChange={(e) => setForm({ ...form, apply_to_all_days: e.target.checked })}
                />
                Same hours every day
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.replace_existing}
                  onChange={(e) => setForm({ ...form, replace_existing: e.target.checked })}
                />
                Replace existing hours on those days
              </label>
            </div>

            <div style={{ marginTop: 8, fontSize: "0.78rem", color: "#64748b" }}>
              {selectedMode?.hint}
            </div>

            <div style={{ marginTop: 14 }}>
              <Button type="submit" variant="primary">Publish these hours</Button>
            </div>
          </form>
        )}

        {MODES.map((m) => {
          const rows = byMode(m.value);
          return (
            <div key={m.value} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon as={m.value === "in_person" ? MapPin : m.value === "online" ? Calendar : Clock} size={16} />
                <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", color: "#475569" }}>
                  {m.label}
                </span>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  ({rows.length} block{rows.length === 1 ? "" : "s"})
                </span>
              </div>
              {rows.length === 0 ? (
                <div style={{ fontSize: "0.83rem", color: "#94a3b8", paddingLeft: 23 }}>
                  No hours published — patients cannot book this yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rows
                    .slice()
                    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                    .map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          padding: "10px 14px",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>
                            {DAYS.find((d) => d.value === a.day_of_week)?.short}
                          </span>
                          <span style={{ marginLeft: 10, color: "#334155" }}>
                            {a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}
                          </span>
                          <span style={{ marginLeft: 10, fontSize: "0.78rem", color: "#64748b" }}>
                            {a.slot_duration_minutes} min slots
                          </span>
                          {a.location_name && (
                            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                              {a.location_name}
                              {a.location_address ? ` • ${a.location_address}` : ""}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAvailability(a.id)}
                          aria-label="Remove this availability block"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}
                        >
                          <Icon as={Trash2} size={16} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Leave / blocked dates ─────────────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
          Leave &amp; blocked dates
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748b" }}>
          A blocked date removes every slot that day, across all three modes.
        </p>
        <form onSubmit={addBlockedDate} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
            Date
            <input
              type="date"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
              style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
            Reason (optional)
            <input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Conference, leave…"
              style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 200 }}
            />
          </label>
          <Button type="submit" variant="secondary">
            <Icon as={CalendarDays} size={16} /> Block date
          </Button>
        </form>
        {blockedDates.length === 0 ? (
          <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>No upcoming blocked dates.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {blockedDates.map((b) => (
              <span
                key={b.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  color: "#b91c1c",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                }}
              >
                {b.blocked_date}
                {b.reason ? ` — ${b.reason}` : ""}
                <button
                  type="button"
                  onClick={() => removeBlockedDate(b.id)}
                  aria-label={`Unblock ${b.blocked_date}`}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
