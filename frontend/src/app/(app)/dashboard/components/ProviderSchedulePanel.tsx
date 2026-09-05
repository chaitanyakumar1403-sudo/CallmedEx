"use client";

/**
 * ProviderSchedulePanel — a consulting provider's bookable schedule.
 *
 * Supports:
 *   - 🌅 🌆 Shift-Based Availability (Morning & Evening Shifts) matching clinical standards
 *   - ⏱️ Minimum Slot Duration starting from 10 minutes (10, 15, 20, 30, 45, 60, 90)
 *   - 📅 De-congested Grouped Weekly Availability by Day & Shift with compact badges
 *   - ⚡ 1-Click CallMedex Standard MOU Tariffs Application (Walk-in ₹500, Online ₹400, Home Visit ₹800)
 *   - 📍 Walk-in Centre, Online Video, and Doorstep Home Visit modes
 */

import { useCallback, useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Calendar, CalendarDays, Clock, MapPin, Plus, Trash2 } from "@/components/ui/icons";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

const DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

const MODES = [
  {
    value: "in_person",
    label: "Walk-in centre",
    hint: "Patients travel to your clinic or hospital OPD",
    needsLocation: true,
  },
  {
    value: "online",
    label: "Online consultation",
    hint: "1-on-1 HD Video teleconsultation from anywhere",
    needsLocation: false,
  },
  {
    value: "home_visit",
    label: "Home visit",
    hint: "Doorstep bedside clinical evaluation",
    needsLocation: false,
  },
];

const SLOT_DURATIONS = [10, 15, 20, 30, 45, 60, 90];

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
  const [savingShift, setSavingShift] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [builderTab, setBuilderTab] = useState<"shift" | "custom">("shift");

  // Reference-matched Morning & Evening Shift Configurator
  const [shiftForm, setShiftForm] = useState({
    consultation_mode: "in_person",
    slot_duration_minutes: 10, // Default starts from 10 minutes
    selected_days: [1, 2, 3, 4, 5, 6], // Mon-Sat default
    morning_shift_enabled: true,
    morning_start: "09:00",
    morning_end: "12:00",
    evening_shift_enabled: true,
    evening_start: "17:00",
    evening_end: "19:00",
    location_name: "",
    location_address: "",
    replace_existing: true,
  });

  // Custom Single-Block Form
  const [form, setForm] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "13:00",
    slot_duration_minutes: 10,
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

  const selectedMode = MODES.find((m) => m.value === (builderTab === "shift" ? shiftForm.consultation_mode : form.consultation_mode));

  // Dynamic slot calculation preview for shift builder
  const calcShiftSlots = () => {
    let mSlots = 0;
    let eSlots = 0;
    const dur = shiftForm.slot_duration_minutes || 10;

    if (shiftForm.morning_shift_enabled && shiftForm.morning_start < shiftForm.morning_end) {
      const [sh, sm] = shiftForm.morning_start.split(":").map(Number);
      const [eh, em] = shiftForm.morning_end.split(":").map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm);
      mSlots = Math.max(0, Math.floor(mins / dur));
    }
    if (shiftForm.evening_shift_enabled && shiftForm.evening_start < shiftForm.evening_end) {
      const [sh, sm] = shiftForm.evening_start.split(":").map(Number);
      const [eh, em] = shiftForm.evening_end.split(":").map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm);
      eSlots = Math.max(0, Math.floor(mins / dur));
    }
    const daily = mSlots + eSlots;
    const weekly = daily * shiftForm.selected_days.length;
    return { mSlots, eSlots, daily, weekly };
  };

  const shiftStats = calcShiftSlots();

  const handleToggleDay = (dayVal: number) => {
    if (shiftForm.selected_days.includes(dayVal)) {
      setShiftForm({
        ...shiftForm,
        selected_days: shiftForm.selected_days.filter((d) => d !== dayVal),
      });
    } else {
      setShiftForm({
        ...shiftForm,
        selected_days: [...shiftForm.selected_days, dayVal].sort(),
      });
    }
  };

  // Submit Shift Schedule
  const handlePublishShifts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.morning_shift_enabled && !shiftForm.evening_shift_enabled) {
      setMsg({ text: "Enable at least Morning or Evening shift.", ok: false });
      return;
    }
    if (shiftForm.selected_days.length === 0) {
      setMsg({ text: "Select at least one day of the week.", ok: false });
      return;
    }
    if (shiftForm.consultation_mode === "in_person" && !shiftForm.location_name.trim()) {
      setMsg({ text: "Please enter your clinic or branch name.", ok: false });
      return;
    }

    setSavingShift(true);
    try {
      const res = await fetch(`${apiBase}/api/providers/availability/shifts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(shiftForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg({
          text: `✓ Shifts published: ${data.created_records_count} blocks created across ${data.days_count} day(s) (${data.total_slots_week} total slots/week).`,
          ok: true,
        });
        setShowForm(false);
        load();
      } else {
        setMsg({ text: data.detail || data.message || "Failed to publish shifts.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error while publishing shifts.", ok: false });
    } finally {
      setSavingShift(false);
    }
  };

  // Custom Single Block Submission
  const addAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.start_time >= form.end_time) {
      setMsg({ text: "Start time must be before end time.", ok: false });
      return;
    }
    if (form.consultation_mode === "in_person" && !form.location_name.trim()) {
      setMsg({ text: "Give your walk-in centre a name.", ok: false });
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

  const applyStandardMOUFees = async () => {
    try {
      const res = await fetch(`${apiBase}/api/providers/fees/apply-standard`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg({ text: "✓ CallMedex Standard MOU Tariffs applied: Walk-in (₹500), Online (₹400), Home Visit (₹800).", ok: true });
        load();
      } else {
        setMsg({ text: data.detail || "Failed to apply standard fees.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error — standard fees not applied.", ok: false });
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

  const feeFor = (type: string) => fees.find((f) => f.fee_type === type);

  if (loading) {
    return <div className="card" style={{ padding: 24, color: "#64748b" }}>Loading clinical schedule cockpit…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {msg && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            fontSize: "0.88rem",
            fontWeight: 700,
            backgroundColor: msg.ok ? "var(--cm-done-surface, #f0fdf4)" : "var(--cm-urgent-surface, #fef2f2)",
            color: msg.ok ? "var(--cm-done, #166534)" : "var(--cm-urgent, #b91c1c)",
            border: `1px solid ${msg.ok ? "var(--cm-done-line, #86efac)" : "var(--cm-urgent-line, #fca5a5)"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: "bold" }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Weekly Availability & Shift Scheduler Widget ───────────────── */}
      <div className="cm-widget-glass-light" style={{ marginBottom: 24 }}>
        <div className="cm-widget-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(2, 132, 199, 0.15)", color: "#0284c7", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(2, 132, 199, 0.3)" }}>
                Clinical Roster Console
              </span>
              <span style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                {availability.length} active shift{availability.length === 1 ? "" : "s"} · {new Set(availability.map((a) => a.day_of_week)).size} days active
              </span>
            </div>
            <h3 className="cm-widget-title">
              <Icon as={CalendarDays} size={20} />
              <span>Weekly Availability &amp; Shift Management</span>
            </h3>
            <p className="cm-widget-subtitle">
              Define morning and evening shifts, choose days of practice, and control slot length with automated capacity calculation.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="cm-btn cm-btn--primary cm-btn--sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 800,
                borderRadius: "9999px",
                padding: "8px 18px",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
              }}
            >
              <Icon as={Plus} size={16} />
              <span>{showForm ? "Close Shift Builder" : "Configure Shifts / Add Hours"}</span>
            </button>
          </div>
        </div>

        {/* Shift Builder Form (Frosted Glass Drawer) */}
        {showForm && (
          <div
            style={{
              borderRadius: "var(--cm-radius-lg)",
              padding: 24,
              margin: "0 0 24px 0",
              background: "linear-gradient(135deg, rgba(240, 249, 255, 0.9) 0%, rgba(255, 255, 255, 0.98) 100%)",
              border: "1px solid rgba(186, 230, 253, 0.9)",
              boxShadow: "0 10px 25px -5px rgba(2, 132, 199, 0.08)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ display: "flex", gap: 10, borderBottom: "1px solid rgba(224, 242, 254, 0.9)", paddingBottom: 12, marginBottom: 18 }}>
              <button
                type="button"
                onClick={() => setBuilderTab("shift")}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  background: builderTab === "shift" ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "rgba(2, 132, 199, 0.06)",
                  color: builderTab === "shift" ? "#ffffff" : "var(--cm-ink-2, #334155)",
                  boxShadow: builderTab === "shift" ? "0 4px 12px rgba(2, 132, 199, 0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                🌅 🌆 Morning &amp; Evening Shift Builder (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setBuilderTab("custom")}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  background: builderTab === "custom" ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "rgba(2, 132, 199, 0.06)",
                  color: builderTab === "custom" ? "#ffffff" : "var(--cm-ink-2, #334155)",
                  boxShadow: builderTab === "custom" ? "0 4px 12px rgba(2, 132, 199, 0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                Single Custom Block
              </button>
            </div>

            {builderTab === "shift" ? (
              <form onSubmit={handlePublishShifts}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 700, color: "var(--cm-ink-2, #334155)" }}>
                    Practice Mode
                    <select
                      value={shiftForm.consultation_mode}
                      onChange={(e) => setShiftForm({ ...shiftForm, consultation_mode: e.target.value })}
                      style={{ padding: 9, borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.9)", fontSize: "0.85rem", background: "#fff" }}
                    >
                      {MODES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </label>

                  {/* Slot Duration starting from 10 min */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 700, color: "var(--cm-ink-2, #334155)" }}>
                    Slot Duration (Min: 10 minutes)
                    <select
                      value={shiftForm.slot_duration_minutes}
                      onChange={(e) => setShiftForm({ ...shiftForm, slot_duration_minutes: Number(e.target.value) })}
                      style={{ padding: 9, borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.9)", fontSize: "0.85rem", background: "#fff" }}
                    >
                      {SLOT_DURATIONS.map((d) => (
                        <option key={d} value={d}>{d} minutes per patient</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Morning Shift */}
                <div style={{ background: "rgba(255, 255, 255, 0.9)", border: "1px solid rgba(186, 230, 253, 0.8)", borderRadius: 10, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(2, 132, 199, 0.04)" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: "0.9rem", color: "var(--cm-ink, #0f172a)", marginBottom: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={shiftForm.morning_shift_enabled}
                      onChange={(e) => setShiftForm({ ...shiftForm, morning_shift_enabled: e.target.checked })}
                      style={{ width: 18, height: 18 }}
                    />
                    🌅 Enable Morning Shift
                  </label>

                  {shiftForm.morning_shift_enabled && (
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: "var(--cm-ink-3, #64748b)" }}>
                        MORNING START
                        <input
                          type="time"
                          value={shiftForm.morning_start}
                          onChange={(e) => setShiftForm({ ...shiftForm, morning_start: e.target.value })}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                        />
                      </label>
                      <span style={{ marginTop: 20, color: "#94a3b8" }}>to</span>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: "var(--cm-ink-3, #64748b)" }}>
                        MORNING END
                        <input
                          type="time"
                          value={shiftForm.morning_end}
                          onChange={(e) => setShiftForm({ ...shiftForm, morning_end: e.target.value })}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                        />
                      </label>
                      <div style={{ fontSize: "0.8rem", color: "var(--cm-active, #0284c7)", fontWeight: 700, marginTop: 18 }}>
                        ({shiftStats.mSlots} morning slots per day)
                      </div>
                    </div>
                  )}
                </div>

                {/* Evening Shift */}
                <div style={{ background: "rgba(255, 255, 255, 0.9)", border: "1px solid rgba(186, 230, 253, 0.8)", borderRadius: 10, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(2, 132, 199, 0.04)" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: "0.9rem", color: "var(--cm-ink, #0f172a)", marginBottom: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={shiftForm.evening_shift_enabled}
                      onChange={(e) => setShiftForm({ ...shiftForm, evening_shift_enabled: e.target.checked })}
                      style={{ width: 18, height: 18 }}
                    />
                    🌆 Enable Evening Shift
                  </label>

                  {shiftForm.evening_shift_enabled && (
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: "var(--cm-ink-3, #64748b)" }}>
                        EVENING START
                        <input
                          type="time"
                          value={shiftForm.evening_start}
                          onChange={(e) => setShiftForm({ ...shiftForm, evening_start: e.target.value })}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                        />
                      </label>
                      <span style={{ marginTop: 20, color: "#94a3b8" }}>to</span>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: "var(--cm-ink-3, #64748b)" }}>
                        EVENING END
                        <input
                          type="time"
                          value={shiftForm.evening_end}
                          onChange={(e) => setShiftForm({ ...shiftForm, evening_end: e.target.value })}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                        />
                      </label>
                      <div style={{ fontSize: "0.8rem", color: "var(--cm-active, #0284c7)", fontWeight: 700, marginTop: 18 }}>
                        ({shiftStats.eSlots} evening slots per day)
                      </div>
                    </div>
                  )}
                </div>

                {/* Available Days Checkboxes */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--cm-ink-2, #334155)", textTransform: "uppercase", marginBottom: 8 }}>
                    Available Days
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {DAYS.map((d) => {
                      const isSelected = shiftForm.selected_days.includes(d.value);
                      return (
                        <label
                          key={d.value}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 14px",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            border: `1px solid ${isSelected ? "#0284c7" : "rgba(186, 230, 253, 0.8)"}`,
                            background: isSelected ? "linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(224, 242, 254, 0.8) 100%)" : "rgba(255, 255, 255, 0.7)",
                            color: isSelected ? "var(--cm-navy, #1e3a8a)" : "#64748b",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleDay(d.value)}
                            style={{ width: 16, height: 16 }}
                          />
                          {d.short.toUpperCase()}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Location Fields for Walk-in centre */}
                {shiftForm.consultation_mode === "in_person" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                      Clinic / Centre Name
                      <input
                        value={shiftForm.location_name}
                        onChange={(e) => setShiftForm({ ...shiftForm, location_name: e.target.value })}
                        placeholder="e.g. Visakha Multispeciality Clinics"
                        style={{ padding: 9, borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.9)", background: "#fff" }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                      Branch Address
                      <input
                        value={shiftForm.location_address}
                        onChange={(e) => setShiftForm({ ...shiftForm, location_address: e.target.value })}
                        placeholder="Street, area, city (e.g. Chandrampalem, Visakhapatnam)"
                        style={{ padding: 9, borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.9)", background: "#fff" }}
                      />
                    </label>
                  </div>
                )}

                {/* Live Slot Calculation Summary */}
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", color: "#15803d", fontSize: "0.85rem", fontWeight: 700, marginBottom: 16 }}>
                  ✨ Generates {shiftStats.mSlots} morning + {shiftStats.eSlots} evening slots ({shiftStats.daily} slots/day × {shiftForm.selected_days.length} days = {shiftStats.weekly} bookable slots per week)
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#475569" }}>
                    <input
                      type="checkbox"
                      checked={shiftForm.replace_existing}
                      onChange={(e) => setShiftForm({ ...shiftForm, replace_existing: e.target.checked })}
                    />
                    Replace existing hours on those selected days
                  </label>
                  <Button type="submit" variant="primary" disabled={savingShift}>
                    {savingShift ? "Publishing Shifts..." : "Publish Shift Schedule"}
                  </Button>
                </div>
              </form>
            ) : (
              /* Custom Single Block Form */
              <form onSubmit={addAvailability}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                    How you see the patient
                    <select
                      value={form.consultation_mode}
                      onChange={(e) => setForm({ ...form, consultation_mode: e.target.value })}
                      style={{ padding: 9, borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.9)", background: "#fff" }}
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
                      style={{ padding: 9, borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.9)", background: "#fff" }}
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
                      style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                    To
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                      style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                    Appointment length
                    <select
                      value={form.slot_duration_minutes}
                      onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })}
                      style={{ padding: 9, borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.9)", background: "#fff" }}
                    >
                      {SLOT_DURATIONS.map((d) => (
                        <option key={d} value={d}>{d} minutes</option>
                      ))}
                    </select>
                  </label>
                </div>

                {form.consultation_mode === "in_person" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                      Centre name
                      <input
                        value={form.location_name}
                        onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                        placeholder="e.g. Visakha Multispeciality Clinics"
                        style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                      Centre address
                      <input
                        value={form.location_address}
                        onChange={(e) => setForm({ ...form, location_address: e.target.value })}
                        placeholder="Street, area, city"
                        style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                      />
                    </label>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", gap: 16 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.83rem", color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={form.apply_to_all_days}
                        onChange={(e) => setForm({ ...form, apply_to_all_days: e.target.checked })}
                      />
                      Same hours every day
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.83rem", color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={form.replace_existing}
                        onChange={(e) => setForm({ ...form, replace_existing: e.target.checked })}
                      />
                      Replace existing hours
                    </label>
                  </div>
                  <Button type="submit" variant="primary">Publish Block</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── De-Congested Grouped Weekly Schedule Display ─────────────── */}
        {MODES.map((m) => {
          const modeRows = availability.filter((a) => a.consultation_mode === m.value);
          return (
            <div key={m.value} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 6, borderBottom: "1px solid rgba(224, 242, 254, 0.8)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(2, 132, 199, 0.15)", color: "#0284c7", display: "grid", placeItems: "center" }}>
                  <Icon as={m.value === "in_person" ? MapPin : m.value === "online" ? Calendar : Clock} size={16} />
                </div>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", color: "var(--cm-navy, #1e3a8a)", letterSpacing: "0.03em" }}>
                  {m.label}
                </span>
                <span style={{ fontSize: "0.76rem", background: "rgba(2, 132, 199, 0.1)", color: "#0284c7", padding: "2px 10px", borderRadius: 999, fontWeight: 700, border: "1px solid rgba(2, 132, 199, 0.25)" }}>
                  {modeRows.length} active block{modeRows.length === 1 ? "" : "s"}
                </span>
              </div>

              {modeRows.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "#64748b", padding: "16px 20px", background: "rgba(255, 255, 255, 0.6)", borderRadius: 10, border: "1px dashed rgba(186, 230, 253, 0.9)" }}>
                  No hours published for {m.label.toLowerCase()} yet. Click &quot;Configure Shifts / Add Hours&quot; above to publish your schedule.
                </div>
              ) : (
                /* Group by Day in Responsive Glass Cards */
                <div className="cm-shift-day-grid">
                  {DAYS.map((dayObj) => {
                    const dayBlocks = modeRows
                      .filter((r) => r.day_of_week === dayObj.value)
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));

                    if (dayBlocks.length === 0) return null;

                    // Detect location if any
                    const primaryLocation = dayBlocks.find((b) => b.location_name)?.location_name;
                    const primaryAddress = dayBlocks.find((b) => b.location_address)?.location_address;

                    return (
                      <div key={dayObj.value} className="cm-shift-day-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid rgba(224, 242, 254, 0.9)", paddingBottom: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: "0.98rem", color: "var(--cm-navy, #1e3a8a)" }}>
                            {dayObj.label}
                          </span>
                          <span style={{ fontSize: "0.72rem", background: "rgba(2, 132, 199, 0.12)", color: "#0284c7", padding: "2px 8px", borderRadius: 999, fontWeight: 800, border: "1px solid rgba(2, 132, 199, 0.2)" }}>
                            {dayBlocks.length} shift{dayBlocks.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        {/* Shift rows */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: primaryLocation ? 10 : 0 }}>
                          {dayBlocks.map((blk) => {
                            const isMorning = blk.start_time < "13:00";
                            const isEvening = blk.start_time >= "16:00";
                            const shiftIcon = isMorning ? "🌅" : isEvening ? "🌆" : "☀️";
                            return (
                              <div
                                key={blk.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "8px 12px",
                                  background: "linear-gradient(135deg, rgba(240, 249, 255, 0.6) 0%, rgba(255, 255, 255, 0.9) 100%)",
                                  borderRadius: 8,
                                  border: "1px solid rgba(186, 230, 253, 0.7)",
                                  boxShadow: "0 1px 3px rgba(2, 132, 199, 0.04)",
                                }}
                              >
                                <div>
                                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>
                                    {shiftIcon} {blk.start_time.slice(0, 5)} – {blk.end_time.slice(0, 5)}
                                  </span>
                                  <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "#0284c7", fontWeight: 700, background: "rgba(2, 132, 199, 0.1)", padding: "1px 6px", borderRadius: 4 }}>
                                    {blk.slot_duration_minutes} min slots
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAvailability(blk.id)}
                                  aria-label="Remove this shift"
                                  title="Remove this shift"
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2, display: "grid", placeItems: "center" }}
                                >
                                  <Icon as={Trash2} size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Location Badge */}
                        {primaryLocation && (
                          <div style={{ fontSize: "0.74rem", color: "#64748b", borderTop: "1px dashed rgba(186, 230, 253, 0.8)", paddingTop: 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <span style={{ marginTop: 2, flexShrink: 0, color: "#0284c7", display: "inline-flex" }}>
                              <Icon as={MapPin} size={14} />
                            </span>
                            <span>
                              <strong style={{ color: "var(--cm-navy, #1e3a8a)" }}>{primaryLocation}</strong>
                              {primaryAddress ? ` • ${primaryAddress}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Blocked Dates / Leave Management Studio Widget ───────────────── */}
      <div
        className="cm-widget-glass-light"
        style={{
          border: "1px solid rgba(244, 63, 94, 0.25)",
          background: "linear-gradient(135deg, rgba(255, 241, 242, 0.6) 0%, rgba(255, 255, 255, 0.95) 100%)",
        }}
      >
        <div className="cm-widget-header" style={{ borderBottomColor: "rgba(254, 205, 211, 0.8)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(225, 29, 72, 0.12)", color: "#e11d48", fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(225, 29, 72, 0.25)" }}>
                Slot Outage Safeguard
              </span>
            </div>
            <h3 className="cm-widget-title" style={{ color: "#9f1239" }}>
              <Icon as={CalendarDays} size={20} />
              <span>Leave &amp; Blocked Dates Management</span>
            </h3>
            <p className="cm-widget-subtitle">
              Mark dates as blocked to temporarily suspend patient slot booking. Existing confirmed appointments remain safeguarded.
            </p>
          </div>
          <div style={{ padding: "6px 14px", borderRadius: 999, background: "rgba(225, 29, 72, 0.1)", color: "#be123c", border: "1px solid rgba(225, 29, 72, 0.3)", fontSize: "0.8rem", fontWeight: 800 }}>
            {blockedDates.length} Date{blockedDates.length === 1 ? "" : "s"} Blocked
          </div>
        </div>

        {/* Quick Reason Presets */}
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#9f1239", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 8 }}>
            Quick Reason Presets:
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Medical Conference", "Weekly Off", "Personal Leave", "Emergency / Sabbatical", "CME Training"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setBlockReason(preset)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: blockReason === preset ? "1px solid #e11d48" : "1px solid rgba(244, 63, 94, 0.2)",
                  background: blockReason === preset ? "linear-gradient(135deg, #e11d48 0%, #be123c 100%)" : "rgba(255, 255, 255, 0.8)",
                  color: blockReason === preset ? "#ffffff" : "#881337",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: blockReason === preset ? "0 4px 10px rgba(225, 29, 72, 0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={addBlockedDate} style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 700, color: "#881337" }}>
            Select Date to Block *
            <input
              type="date"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(244, 63, 94, 0.3)", fontSize: "0.85rem", background: "#fff" }}
              required
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 700, color: "#881337", flex: 1, minWidth: 220 }}>
            Reason for Unavailability (Optional)
            <input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="e.g. National Medical Council Annual Summit"
              style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(244, 63, 94, 0.3)", fontSize: "0.85rem", background: "#fff" }}
            />
          </label>
          <button
            type="submit"
            className="cm-btn cm-btn--secondary cm-btn--sm"
            style={{
              borderColor: "#e11d48",
              color: "#be123c",
              fontWeight: 800,
              height: 40,
              padding: "0 18px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.9)",
              boxShadow: "0 2px 8px rgba(225, 29, 72, 0.1)",
            }}
          >
            <Icon as={CalendarDays} size={16} /> Block This Date
          </button>
        </form>

        {blockedDates.length === 0 ? (
          <div style={{ fontSize: "0.85rem", color: "#881337", padding: "18px 20px", background: "rgba(255, 255, 255, 0.7)", borderRadius: 10, border: "1px dashed rgba(244, 63, 94, 0.3)", textAlign: "center" }}>
            No upcoming leaves or blocked dates recorded. Your published shifts are fully active and bookable by patients.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {blockedDates.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.9)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  boxShadow: "0 2px 8px rgba(225, 29, 72, 0.08)",
                  color: "#9f1239",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon as={CalendarDays} size={14} />
                    {new Date(b.blocked_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#be123c", marginTop: 3 }}>
                    Reason: <strong>{b.reason || "Scheduled Leave"}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeBlockedDate(b.id)}
                  aria-label={`Unblock ${b.blocked_date}`}
                  title="Unblock date and restore slots"
                  style={{
                    background: "linear-gradient(135deg, rgba(225, 29, 72, 0.1) 0%, rgba(244, 63, 94, 0.15) 100%)",
                    border: "1px solid rgba(225, 29, 72, 0.35)",
                    borderRadius: 6,
                    padding: "5px 10px",
                    cursor: "pointer",
                    color: "#be123c",
                    fontSize: "0.76rem",
                    fontWeight: 800,
                    transition: "all 0.2s ease",
                  }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
