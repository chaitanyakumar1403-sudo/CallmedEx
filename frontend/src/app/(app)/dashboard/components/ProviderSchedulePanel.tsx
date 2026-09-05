"use client";

/**
 * ProviderSchedulePanel — a consulting provider's bookable schedule.
 *
 * Supports:
 *   - 🌅 🌆 Shift-Based Availability (Morning & Evening Shifts) matching clinical standards
 *   - ⏱️ Minimum Slot Duration starting from 10 minutes (10, 15, 20, 30, 45, 60, 90)
 *   - 📑 Consolidated Weekly Availability grouping identical shifts & branches into unified cards
 *   - 🏥 Multi-Branch Clinic Management & Selection for Walk-In OPD (e.g. MVP Colony, Gajuwaka)
 *   - ⚡ 1-Click Multi-Day Batch Presets (Weekdays Mon–Fri, Mon–Sat 6 Days, All 7 Days)
 *   - 🛡️ Outage Safeguard: Leave & Blocked Date Management
 */

import { useCallback, useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Calendar, CalendarDays, Clock, MapPin, Plus, Trash2, Building2 } from "@/components/ui/icons";

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

interface ClinicBranch {
  id: string;
  name: string;
  address: string;
}

interface ConsolidatedShiftGroup {
  key: string;
  days: number[];
  dayLabel: string;
  distinctShifts: {
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
    slots: number;
  }[];
  location_name?: string;
  location_address?: string;
  totalSlotsDaily: number;
  totalSlotsWeekly: number;
  allBlockIds: string[];
}

function formatDaysRange(days: number[]): string {
  if (!days || days.length === 0) return "No days configured";
  if (days.length === 7) return "All 7 Days (Mon – Sun)";

  // Standard medical week ordering: Mon (1) to Sun (0)
  const sorted = [...days].sort((a, b) => {
    const oA = a === 0 ? 7 : a;
    const oB = b === 0 ? 7 : b;
    return oA - oB;
  });

  const isSeq = (arr: number[], expected: number[]) =>
    arr.length === expected.length && arr.every((v, i) => v === expected[i]);

  if (isSeq(sorted, [1, 2, 3, 4, 5])) return "Monday – Friday (5 Days)";
  if (isSeq(sorted, [1, 2, 3, 4, 5, 6])) return "Monday – Saturday (6 Days)";
  if (isSeq(sorted, [6, 0])) return "Saturday & Sunday (Weekend)";

  const dayMap: Record<number, string> = {
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
    6: "Sat",
    0: "Sun",
  };
  return sorted.map((d) => dayMap[d]).join(", ");
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
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [builderTab, setBuilderTab] = useState<"shift" | "custom">("shift");

  // Multi-Branch Clinic Practice State
  const [branches, setBranches] = useState<ClinicBranch[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cm_doctor_branches");
        if (saved) return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return [
      { id: "b1", name: "Main Consultation OPD", address: "MVP Colony, Sector 3, Visakhapatnam" },
      { id: "b2", name: "City Care Branch", address: "Gajuwaka Junction, Visakhapatnam" },
    ];
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string>("b1");
  const [showBranchManager, setShowBranchManager] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchAddress, setNewBranchAddress] = useState("");

  // Consolidated View vs Day-by-Day View
  const [scheduleViewMode, setScheduleViewMode] = useState<"consolidated" | "day_by_day">("consolidated");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Reference-matched Morning & Evening Shift Configurator with Batch Day Selection
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
    location_name: "Main Consultation OPD",
    location_address: "MVP Colony, Sector 3, Visakhapatnam",
    replace_existing: true,
  });

  // Custom Single-Block Form
  const [form, setForm] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "13:00",
    slot_duration_minutes: 10,
    consultation_mode: "in_person",
    location_name: "Main Consultation OPD",
    location_address: "MVP Colony, Sector 3, Visakhapatnam",
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

  // Sync branches from availability records so any previously used branches are preserved
  const syncBranchesFromAvailability = useCallback((availList: Availability[]) => {
    setBranches((prev) => {
      const existingNames = new Set(prev.map((b) => b.name.toLowerCase().trim()));
      const discovered: ClinicBranch[] = [];
      availList.forEach((a) => {
        if (a.location_name && a.location_name.trim()) {
          const norm = a.location_name.toLowerCase().trim();
          if (!existingNames.has(norm)) {
            existingNames.add(norm);
            discovered.push({
              id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: a.location_name.trim(),
              address: (a.location_address || "").trim(),
            });
          }
        }
      });
      if (discovered.length > 0) {
        const merged = [...prev, ...discovered];
        try {
          localStorage.setItem("cm_doctor_branches", JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      }
      return prev;
    });
  }, []);

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
        if (d.success && Array.isArray(d.availability)) {
          setAvailability(d.availability);
          syncBranchesFromAvailability(d.availability);
        }
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
  }, [syncBranchesFromAvailability]);

  useEffect(() => {
    load();
  }, [load]);

  // Handle adding a new clinic branch
  const handleAddNewBranch = () => {
    if (!newBranchName.trim()) {
      setMsg({ text: "Please enter a clinic / branch name.", ok: false });
      return;
    }
    const newB: ClinicBranch = {
      id: `b_${Date.now()}`,
      name: newBranchName.trim(),
      address: newBranchAddress.trim() || "Visakhapatnam, Andhra Pradesh",
    };
    const updated = [...branches, newB];
    setBranches(updated);
    try {
      localStorage.setItem("cm_doctor_branches", JSON.stringify(updated));
    } catch {
      // ignore
    }
    setSelectedBranchId(newB.id);
    setShiftForm((prev) => ({
      ...prev,
      location_name: newB.name,
      location_address: newB.address,
    }));
    setForm((prev) => ({
      ...prev,
      location_name: newB.name,
      location_address: newB.address,
    }));
    setNewBranchName("");
    setNewBranchAddress("");
    setMsg({ text: `✓ Added new clinic branch: ${newB.name}`, ok: true });
  };

  const handleDeleteBranch = (bId: string) => {
    if (branches.length <= 1) {
      setMsg({ text: "You must keep at least one clinic branch.", ok: false });
      return;
    }
    const updated = branches.filter((b) => b.id !== bId);
    setBranches(updated);
    try {
      localStorage.setItem("cm_doctor_branches", JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (selectedBranchId === bId && updated.length > 0) {
      setSelectedBranchId(updated[0].id);
      setShiftForm((prev) => ({
        ...prev,
        location_name: updated[0].name,
        location_address: updated[0].address,
      }));
    }
    setMsg({ text: "Clinic branch removed from saved list.", ok: true });
  };

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
      // Ensure branch is saved in branches list
      if (shiftForm.consultation_mode === "in_person" && shiftForm.location_name.trim()) {
        const exists = branches.some(
          (b) => b.name.toLowerCase().trim() === shiftForm.location_name.toLowerCase().trim()
        );
        if (!exists) {
          const newB: ClinicBranch = {
            id: `b_${Date.now()}`,
            name: shiftForm.location_name.trim(),
            address: (shiftForm.location_address || "").trim(),
          };
          const updated = [...branches, newB];
          setBranches(updated);
          try {
            localStorage.setItem("cm_doctor_branches", JSON.stringify(updated));
          } catch {
            // ignore
          }
        }
      }

      const res = await fetch(`${apiBase}/api/providers/availability/shifts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(shiftForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg({
          text: `✓ Shifts published: ${data.created_records_count || shiftForm.selected_days.length * 2} blocks created across ${data.days_count || shiftForm.selected_days.length} day(s) (${data.total_slots_week || shiftStats.weekly} total slots/week).`,
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

  // Remove a consolidated group across multiple days
  const removeAvailabilityGroup = async (blockIds: string[], label: string) => {
    if (!blockIds || blockIds.length === 0) return;
    setDeletingGroup(blockIds[0]);
    try {
      await Promise.all(
        blockIds.map((id) =>
          fetch(`${apiBase}/api/providers/availability/${id}`, {
            method: "DELETE",
            headers: authHeaders(),
          })
        )
      );
      setMsg({
        text: `✓ Removed schedule for ${label} (${blockIds.length} shift record${blockIds.length === 1 ? "" : "s"} cleared).`,
        ok: true,
      });
      load();
    } catch {
      setMsg({ text: "Could not remove shift group.", ok: false });
    } finally {
      setDeletingGroup(null);
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

  // ── Consolidated Grouping Engine ─────────────────────────────────────────
  const buildConsolidatedGroups = (rows: Availability[]): ConsolidatedShiftGroup[] => {
    const dayMap = new Map<number, Availability[]>();
    rows.forEach((r) => {
      const arr = dayMap.get(r.day_of_week) || [];
      arr.push(r);
      dayMap.set(r.day_of_week, arr);
    });

    const daySignatures = new Map<number, { sig: string; rows: Availability[] }>();
    dayMap.forEach((dayRows, dayVal) => {
      const sorted = [...dayRows].sort((a, b) => a.start_time.localeCompare(b.start_time));
      const sig = sorted
        .map(
          (b) =>
            `${b.start_time}-${b.end_time}@${b.slot_duration_minutes}#${(b.location_name || "").trim()}#${(b.location_address || "").trim()}`
        )
        .join("::");
      daySignatures.set(dayVal, { sig, rows: sorted });
    });

    const clusters = new Map<string, { days: number[]; rows: Availability[] }>();
    daySignatures.forEach(({ sig, rows }, dayVal) => {
      const c = clusters.get(sig) || { days: [], rows };
      c.days.push(dayVal);
      clusters.set(sig, c);
    });

    const result: ConsolidatedShiftGroup[] = [];
    clusters.forEach(({ days, rows }, sig) => {
      const sortedDays = [...days].sort((a, b) => {
        const oA = a === 0 ? 7 : a;
        const oB = b === 0 ? 7 : b;
        return oA - oB;
      });

      const sampleRows = rows;
      const distinctShifts = sampleRows.map((s) => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        const slots = Math.max(0, Math.floor(mins / (s.slot_duration_minutes || 10)));
        return {
          start_time: s.start_time,
          end_time: s.end_time,
          slot_duration_minutes: s.slot_duration_minutes,
          slots,
        };
      });

      const totalSlotsDaily = distinctShifts.reduce((acc, curr) => acc + curr.slots, 0);
      const totalSlotsWeekly = totalSlotsDaily * sortedDays.length;

      const allBlockIds: string[] = [];
      sortedDays.forEach((d) => {
        const dRows = dayMap.get(d) || [];
        dRows.forEach((r) => allBlockIds.push(r.id));
      });

      result.push({
        key: sig,
        days: sortedDays,
        dayLabel: formatDaysRange(sortedDays),
        distinctShifts,
        location_name: sampleRows[0]?.location_name,
        location_address: sampleRows[0]?.location_address,
        totalSlotsDaily,
        totalSlotsWeekly,
        allBlockIds,
      });
    });

    return result;
  };

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
                Enterprise Clinical Roster
              </span>
              <span style={{ fontSize: "12px", color: "var(--cm-ink-3)" }}>
                {availability.length} active shift{availability.length === 1 ? "" : "s"} · {new Set(availability.map((a) => a.day_of_week)).size} days active
              </span>
              {branches.length > 1 && (
                <span className="cm-branch-badge">
                  <Icon as={Building2} size={14} /> {branches.length} Clinic Branches
                </span>
              )}
            </div>
            <h3 className="cm-widget-title">
              <Icon as={CalendarDays} size={20} />
              <span>Weekly Availability &amp; Multi-Branch Practice</span>
            </h3>
            <p className="cm-widget-subtitle">
              Define morning and evening shifts with 1-click batch day selection, assign shifts across multiple clinic branches, and view consolidated schedules without clutter.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* View Mode Toggle: Consolidated vs Day-by-Day */}
            <div className="cm-view-toggle">
              <button
                type="button"
                onClick={() => setScheduleViewMode("consolidated")}
                className={`cm-view-toggle-btn ${scheduleViewMode === "consolidated" ? "cm-view-toggle-btn--active" : ""}`}
                title="Consolidate days sharing identical shifts into unified cards"
              >
                📑 Consolidated View
              </button>
              <button
                type="button"
                onClick={() => setScheduleViewMode("day_by_day")}
                className={`cm-view-toggle-btn ${scheduleViewMode === "day_by_day" ? "cm-view-toggle-btn--active" : ""}`}
                title="View full week day-by-day (7 individual cards)"
              >
                📅 Day-by-Day View
              </button>
            </div>

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
              background: "linear-gradient(135deg, rgba(240, 249, 255, 0.92) 0%, rgba(255, 255, 255, 0.98) 100%)",
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
                    Practice Modality
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
                    Slot Duration (Starting from 10 minutes)
                    <select
                      value={shiftForm.slot_duration_minutes}
                      onChange={(e) => setShiftForm({ ...shiftForm, slot_duration_minutes: Number(e.target.value) })}
                      style={{ padding: 9, borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.9)", fontSize: "0.85rem", background: "#fff" }}
                    >
                      {SLOT_DURATIONS.map((d) => (
                        <option key={d} value={d}>{d} minutes per patient slot</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Morning Shift Card */}
                <div style={{ background: "rgba(255, 255, 255, 0.92)", border: "1px solid rgba(186, 230, 253, 0.8)", borderRadius: 10, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(2, 132, 199, 0.04)" }}>
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
                        ({shiftStats.mSlots} morning slots per active day)
                      </div>
                    </div>
                  )}
                </div>

                {/* Evening Shift Card */}
                <div style={{ background: "rgba(255, 255, 255, 0.92)", border: "1px solid rgba(186, 230, 253, 0.8)", borderRadius: 10, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(2, 132, 199, 0.04)" }}>
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
                        ({shiftStats.eSlots} evening slots per active day)
                      </div>
                    </div>
                  )}
                </div>

                {/* Multi-Day Batch Selector & Presets */}
                <div style={{ marginBottom: 16, background: "rgba(255, 255, 255, 0.92)", padding: 16, borderRadius: 10, border: "1px solid rgba(186, 230, 253, 0.8)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--cm-navy, #1e3a8a)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      📅 Practice Days Selection (Multi-Day Batch)
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 700 }}>
                      {shiftForm.selected_days.length} day{shiftForm.selected_days.length === 1 ? "" : "s"} selected
                    </span>
                  </div>

                  {/* 1-Click Preset Buttons */}
                  <div className="cm-day-presets-row">
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--cm-ink-3)", display: "flex", alignItems: "center", gap: 4 }}>
                      ⚡ 1-Click Presets:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShiftForm({ ...shiftForm, selected_days: [1, 2, 3, 4, 5] })}
                      className={`cm-day-preset-btn ${JSON.stringify(shiftForm.selected_days.slice().sort()) === JSON.stringify([1, 2, 3, 4, 5]) ? "cm-day-preset-btn--active" : ""}`}
                    >
                      Weekdays (Mon–Fri)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftForm({ ...shiftForm, selected_days: [1, 2, 3, 4, 5, 6] })}
                      className={`cm-day-preset-btn ${JSON.stringify(shiftForm.selected_days.slice().sort()) === JSON.stringify([1, 2, 3, 4, 5, 6]) ? "cm-day-preset-btn--active" : ""}`}
                    >
                      Mon–Sat (6 Days)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftForm({ ...shiftForm, selected_days: [0, 1, 2, 3, 4, 5, 6] })}
                      className={`cm-day-preset-btn ${shiftForm.selected_days.length === 7 ? "cm-day-preset-btn--active" : ""}`}
                    >
                      All 7 Days (Mon–Sun)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftForm({ ...shiftForm, selected_days: [6, 0] })}
                      className={`cm-day-preset-btn ${JSON.stringify(shiftForm.selected_days.slice().sort()) === JSON.stringify([0, 6]) ? "cm-day-preset-btn--active" : ""}`}
                    >
                      Weekend (Sat &amp; Sun)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftForm({ ...shiftForm, selected_days: [] })}
                      className="cm-day-preset-btn"
                      style={{ color: "#ef4444" }}
                    >
                      Clear
                    </button>
                  </div>

                  {/* Individual Day Checkboxes */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                            background: isSelected ? "linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(224, 242, 254, 0.8) 100%)" : "rgba(255, 255, 255, 0.8)",
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

                {/* ── Multi-Branch Clinic Practice Selector for Walk-in centre ── */}
                {shiftForm.consultation_mode === "in_person" && (
                  <div style={{ background: "rgba(255, 255, 255, 0.95)", border: "1px solid rgba(186, 230, 253, 0.9)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                      <label style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--cm-navy, #1e3a8a)", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon as={MapPin} size={16} /> Multi-Branch Clinic Practice (Select Active Branch)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowBranchManager((s) => !s)}
                        style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                      >
                        {showBranchManager ? "Close Branch Manager" : "⚙️ Manage Saved Branches"}
                      </button>
                    </div>

                    {/* Saved Branch Chips */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      {branches.map((b) => {
                        const isSelected = selectedBranchId === b.id || (shiftForm.location_name === b.name && shiftForm.location_address === b.address);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSelectedBranchId(b.id);
                              setShiftForm({ ...shiftForm, location_name: b.name, location_address: b.address });
                            }}
                            style={{
                              padding: "8px 14px",
                              borderRadius: 8,
                              border: isSelected ? "1.5px solid #0284c7" : "1px solid rgba(186, 230, 253, 0.8)",
                              background: isSelected ? "linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(224, 242, 254, 0.8) 100%)" : "#fff",
                              color: isSelected ? "var(--cm-navy, #1e3a8a)" : "#475569",
                              fontWeight: isSelected ? 800 : 600,
                              fontSize: "0.82rem",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              boxShadow: isSelected ? "0 2px 6px rgba(2, 132, 199, 0.15)" : "none",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <span>📍 {b.name}</span>
                            {isSelected && <span style={{ fontSize: "10px", color: "#0284c7", fontWeight: 900 }}>✓</span>}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBranchId("new");
                          setShiftForm({ ...shiftForm, location_name: "", location_address: "" });
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: selectedBranchId === "new" ? "1.5px solid #0284c7" : "1px dashed #7dd3fc",
                          background: selectedBranchId === "new" ? "rgba(2, 132, 199, 0.08)" : "transparent",
                          color: "#0284c7",
                          fontWeight: 800,
                          fontSize: "0.82rem",
                          cursor: "pointer",
                        }}
                      >
                        + Add New Branch...
                      </button>
                    </div>

                    {/* Branch Detail Inputs */}
                    {(selectedBranchId === "new" || !shiftForm.location_name) && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, padding: 12, background: "rgba(240, 249, 255, 0.7)", borderRadius: 8, border: "1px solid rgba(186, 230, 253, 0.7)" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>
                          Clinic / Branch Name *
                          <input
                            value={shiftForm.location_name}
                            onChange={(e) => setShiftForm({ ...shiftForm, location_name: e.target.value })}
                            placeholder="e.g. Apex Polyclinic - MVP Colony"
                            style={{ padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff" }}
                            required
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>
                          Branch Address *
                          <input
                            value={shiftForm.location_address}
                            onChange={(e) => setShiftForm({ ...shiftForm, location_address: e.target.value })}
                            placeholder="Street, area, city (e.g. Sector 3, MVP Colony, Visakhapatnam)"
                            style={{ padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff" }}
                            required
                          />
                        </label>
                      </div>
                    )}

                    {/* Branch Manager Drawer */}
                    {showBranchManager && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #bae6fd" }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", marginBottom: 8 }}>
                          Manage Registered Branches ({branches.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                          {branches.map((b) => {
                            const count = availability.filter((a) => a.location_name?.trim() === b.name.trim()).length;
                            return (
                              <div
                                key={b.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "8px 12px",
                                  background: "#f8fafc",
                                  borderRadius: 6,
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <div>
                                  <strong style={{ fontSize: "0.85rem", color: "var(--cm-navy, #1e3a8a)" }}>{b.name}</strong>
                                  <span style={{ fontSize: "0.76rem", color: "#64748b", marginLeft: 8 }}>• {b.address}</span>
                                  <span style={{ marginLeft: 8, fontSize: "10px", background: "rgba(2, 132, 199, 0.1)", color: "#0284c7", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                                    {count} shift block{count === 1 ? "" : "s"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBranch(b.id)}
                                  disabled={branches.length <= 1}
                                  style={{ background: "none", border: "none", color: branches.length <= 1 ? "#cbd5e1" : "#ef4444", cursor: branches.length <= 1 ? "not-allowed" : "pointer", padding: 2 }}
                                  title="Delete saved branch"
                                >
                                  <Icon as={Trash2} size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add branch inline */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: 8, alignItems: "center" }}>
                          <input
                            placeholder="New Branch Name (e.g. Apollo Cradle Gajuwaka)"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            style={{ padding: 7, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "#fff" }}
                          />
                          <input
                            placeholder="Branch Address (e.g. Near Old Post Office, Gajuwaka)"
                            value={newBranchAddress}
                            onChange={(e) => setNewBranchAddress(e.target.value)}
                            style={{ padding: 7, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.8rem", background: "#fff" }}
                          />
                          <button
                            type="button"
                            onClick={handleAddNewBranch}
                            className="cm-btn cm-btn--secondary cm-btn--sm"
                            style={{ fontWeight: 800, padding: "7px 12px" }}
                          >
                            + Save Branch
                          </button>
                        </div>
                      </div>
                    )}
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
                    Replace existing hours on those selected days for this mode
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
                    Consultation Modality
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
                    Day of Week
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
                    Start Time
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                      style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                    End Time
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                      style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                    Slot Duration
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
                      Clinic / Centre Name
                      <input
                        value={form.location_name}
                        onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                        placeholder="e.g. Visakha Multispeciality Clinics"
                        style={{ padding: 9, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>
                      Branch Address
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

        {/* ── Grouped & Consolidated Weekly Schedule Display ───────────── */}
        {MODES.map((m) => {
          let modeRows = availability.filter((a) => a.consultation_mode === m.value);

          // If walk-in OPD and a branch filter is applied
          const branchNames = Array.from(
            new Set(modeRows.map((r) => r.location_name?.trim()).filter(Boolean))
          );

          if (m.value === "in_person" && selectedBranchFilter !== "all") {
            modeRows = modeRows.filter((r) => r.location_name?.trim() === selectedBranchFilter);
          }

          const consolidatedGroups = buildConsolidatedGroups(modeRows);

          return (
            <div key={m.value} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid rgba(224, 242, 254, 0.8)", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(2, 132, 199, 0.15)", color: "#0284c7", display: "grid", placeItems: "center" }}>
                    <Icon as={m.value === "in_person" ? MapPin : m.value === "online" ? Calendar : Clock} size={16} />
                  </div>
                  <span style={{ fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", color: "var(--cm-navy, #1e3a8a)", letterSpacing: "0.03em" }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: "0.76rem", background: "rgba(2, 132, 199, 0.1)", color: "#0284c7", padding: "2px 10px", borderRadius: 999, fontWeight: 700, border: "1px solid rgba(2, 132, 199, 0.25)" }}>
                    {modeRows.length} active block{modeRows.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Multi-Branch Filter Bar for Walk-In OPD */}
              {m.value === "in_person" && branchNames.length > 1 && (
                <div className="cm-branch-filter-bar">
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--cm-navy, #1e3a8a)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon as={Building2} size={14} /> Filter Branch:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBranchFilter("all")}
                    className={`cm-day-preset-btn ${selectedBranchFilter === "all" ? "cm-day-preset-btn--active" : ""}`}
                  >
                    All Branches ({availability.filter((a) => a.consultation_mode === "in_person").length})
                  </button>
                  {branchNames.map((bName) => {
                    const count = availability.filter(
                      (a) => a.consultation_mode === "in_person" && a.location_name?.trim() === bName
                    ).length;
                    return (
                      <button
                        key={bName}
                        type="button"
                        onClick={() => setSelectedBranchFilter(bName!)}
                        className={`cm-day-preset-btn ${selectedBranchFilter === bName ? "cm-day-preset-btn--active" : ""}`}
                      >
                        📍 {bName} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {modeRows.length === 0 ? (
                <div style={{ fontSize: "0.85rem", color: "#64748b", padding: "20px 24px", background: "rgba(255, 255, 255, 0.7)", borderRadius: 10, border: "1px dashed rgba(186, 230, 253, 0.9)", textAlign: "center" }}>
                  No active hours published for {m.label.toLowerCase()} yet. Click &quot;Configure Shifts / Add Hours&quot; above to publish your schedule.
                </div>
              ) : scheduleViewMode === "consolidated" ? (
                /* ── Consolidated View: Unified Cards Grouped Across Days ── */
                <div className="cm-consolidated-grid">
                  {consolidatedGroups.map((group) => {
                    const isExpanded = !!expandedGroups[group.key];
                    const isDeleting = deletingGroup === group.allBlockIds[0];

                    return (
                      <div key={group.key} className="cm-consolidated-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h4 style={{ margin: 0, fontWeight: 900, fontSize: "1.05rem", color: "var(--cm-navy, #1e3a8a)" }}>
                                {group.dayLabel}
                              </h4>
                              <span style={{ fontSize: "0.72rem", background: "rgba(2, 132, 199, 0.12)", color: "#0284c7", padding: "2px 8px", borderRadius: 999, fontWeight: 800, border: "1px solid rgba(2, 132, 199, 0.2)" }}>
                                {group.days.length} Day{group.days.length === 1 ? "" : "s"} Active
                              </span>
                            </div>
                            {group.location_name && (
                              <div style={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                <Icon as={MapPin} size={14} />
                                <span>{group.location_name}</span>
                                {group.location_address && <span style={{ color: "#64748b", fontWeight: 500 }}>• {group.location_address}</span>}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeAvailabilityGroup(group.allBlockIds, group.dayLabel)}
                            disabled={isDeleting}
                            aria-label={`Remove shifts for ${group.dayLabel}`}
                            title="Remove shifts across all matching days"
                            style={{
                              background: "rgba(239, 68, 68, 0.08)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#ef4444",
                              borderRadius: 6,
                              padding: "4px 8px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: "11px",
                              fontWeight: 800,
                            }}
                          >
                            <Icon as={Trash2} size={14} />
                            <span>{isDeleting ? "Removing..." : "Remove"}</span>
                          </button>
                        </div>

                        {/* Shift blocks */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                          {group.distinctShifts.map((s, idx) => {
                            const isMorning = s.start_time < "13:00";
                            const isEvening = s.start_time >= "16:00";
                            const icon = isMorning ? "🌅" : isEvening ? "🌆" : "☀️";
                            const title = isMorning ? "Morning Shift" : isEvening ? "Evening Shift" : "Afternoon Shift";

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "8px 12px",
                                  background: "#ffffff",
                                  borderRadius: 8,
                                  border: "1px solid rgba(186, 230, 253, 0.7)",
                                  boxShadow: "0 1px 3px rgba(2, 132, 199, 0.04)",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: "1rem" }}>{icon}</span>
                                  <div>
                                    <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#0f172a" }}>
                                      {title}: {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                                    </span>
                                    <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "#0284c7", background: "rgba(2, 132, 199, 0.1)", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                                      {s.slot_duration_minutes}m slots
                                    </span>
                                  </div>
                                </div>
                                <span style={{ fontSize: "0.76rem", color: "#16a34a", fontWeight: 700 }}>
                                  {s.slots} slots/day
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Summary & Day Breakdown Toggle */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed rgba(186, 230, 253, 0.9)", paddingTop: 10, flexWrap: "wrap", gap: 8 }}>
                          <span style={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 700 }}>
                            ✨ Capacity: <strong>{group.totalSlotsDaily}</strong> slots/day · <strong>{group.totalSlotsWeekly}</strong> slots/week
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGroups((prev) => ({
                                ...prev,
                                [group.key]: !prev[group.key],
                              }))
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "#0284c7",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            {isExpanded ? "Hide Days" : `View Days (${group.days.length})`}
                          </button>
                        </div>

                        {/* Expanded individual days list */}
                        {isExpanded && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #e0f2fe", display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {group.days.map((d) => {
                              const dayObj = DAYS.find((item) => item.value === d);
                              return (
                                <span
                                  key={d}
                                  style={{
                                    padding: "3px 8px",
                                    borderRadius: 4,
                                    background: "rgba(2, 132, 199, 0.08)",
                                    color: "#0369a1",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    border: "1px solid rgba(186, 230, 253, 0.8)",
                                  }}
                                >
                                  {dayObj?.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── Day-by-Day View (7 Separate Cards) ── */
                <div className="cm-shift-day-grid">
                  {DAYS.map((dayObj) => {
                    const dayBlocks = modeRows
                      .filter((r) => r.day_of_week === dayObj.value)
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));

                    if (dayBlocks.length === 0) return null;

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
