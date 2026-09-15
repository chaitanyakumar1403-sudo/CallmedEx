"use client";

/**
 * ProviderSchedulePanel — a consulting provider's bookable schedule.
 *
 * Supports:
 *   - Shift-based availability (morning & evening shifts)
 *   - Slot durations from 10 minutes (10, 15, 20, 30, 45, 60, 90)
 *   - Consolidated weekly view grouping identical shifts & branches into one card
 *   - Multi-branch clinic management for walk-in OPD
 *   - 1-click multi-day presets (Mon–Fri, Mon–Sat, all 7 days, weekend)
 *   - Leave & blocked-date management
 *
 * Presentation is class-based (foundation.css `.cm-sched*`) and gated by
 * scripts/lint-ui.mjs — no inline styles, colour literals or emoji here.
 */

import { useCallback, useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import {
  AlertCircle, Building2, Calendar, CalendarOff, CheckCircle2, Clock,
  LayoutGrid, MapPin, Moon, Plus, Rows3, Settings2, Sun, Sunrise, Trash2, X,
} from "@/components/ui/icons";
import type { LucideIcon } from "@/components/ui/icons";

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
    icon: MapPin,
  },
  {
    value: "online",
    label: "Online consultation",
    hint: "1-on-1 HD video teleconsultation from anywhere",
    needsLocation: false,
    icon: Calendar,
  },
  {
    value: "home_visit",
    label: "Home visit",
    hint: "Doorstep bedside clinical evaluation",
    needsLocation: false,
    icon: Clock,
  },
];

const SLOT_DURATIONS = [10, 15, 20, 30, 45, 60, 90];

const LEAVE_PRESETS = ["Medical Conference", "Weekly Off", "Personal Leave", "Emergency / Sabbatical", "CME Training"];

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
  if (days.length === 7) return "Every day";

  // Standard medical week ordering: Mon (1) to Sun (0)
  const sorted = [...days].sort((a, b) => {
    const oA = a === 0 ? 7 : a;
    const oB = b === 0 ? 7 : b;
    return oA - oB;
  });

  const isSeq = (arr: number[], expected: number[]) =>
    arr.length === expected.length && arr.every((v, i) => v === expected[i]);

  if (isSeq(sorted, [1, 2, 3, 4, 5])) return "Monday – Friday";
  if (isSeq(sorted, [1, 2, 3, 4, 5, 6])) return "Monday – Saturday";
  if (isSeq(sorted, [6, 0])) return "Weekends";
  if (sorted.length === 1) return DAYS.find((d) => d.value === sorted[0])?.label || "";

  return sorted.map((d) => DAYS.find((x) => x.value === d)?.short).join(", ");
}

/** "09:30:00" → "9:30 AM". Falls back to the raw value if it isn't HH:MM. */
function formatTime(t: string): string {
  const [h, m] = (t || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function shiftPeriod(start: string): { label: string; icon: LucideIcon; tone: "morning" | "afternoon" | "evening" } {
  if (start < "13:00") return { label: "Morning", icon: Sunrise, tone: "morning" };
  if (start >= "16:00") return { label: "Evening", icon: Moon, tone: "evening" };
  return { label: "Afternoon", icon: Sun, tone: "afternoon" };
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

  // Morning & Evening Shift Configurator with Batch Day Selection
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
    setMsg({ text: `Added clinic branch: ${newB.name}`, ok: true });
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
          text: `Shifts published: ${data.created_records_count || shiftForm.selected_days.length * 2} blocks across ${data.days_count || shiftForm.selected_days.length} day(s) · ${data.total_slots_week || shiftStats.weekly} bookable slots per week.`,
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
    // One click here deletes every shift on every matching day — confirm first.
    if (!window.confirm(`Remove all shifts for ${label}? Patients will no longer be able to book these hours.`)) return;
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
        text: `Removed schedule for ${label} (${blockIds.length} shift record${blockIds.length === 1 ? "" : "s"} cleared).`,
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
    return (
      <div className="cm-sched-card cm-sched-loading" aria-busy="true">
        Loading your schedule…
      </div>
    );
  }

  const activeDayCount = new Set(availability.map((a) => a.day_of_week)).size;
  const sameDays = (a: number[], b: number[]) =>
    JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());
  const presets = [
    { label: "Mon – Fri", days: [1, 2, 3, 4, 5] },
    { label: "Mon – Sat", days: [1, 2, 3, 4, 5, 6] },
    { label: "All 7 days", days: [0, 1, 2, 3, 4, 5, 6] },
    { label: "Weekend", days: [0, 6] },
  ];

  const shiftEditors = [
    {
      key: "morning",
      label: "Morning shift",
      icon: Sunrise,
      tone: "morning",
      enabled: shiftForm.morning_shift_enabled,
      start: shiftForm.morning_start,
      end: shiftForm.morning_end,
      slots: shiftStats.mSlots,
      toggle: (v: boolean) => setShiftForm({ ...shiftForm, morning_shift_enabled: v }),
      setStart: (v: string) => setShiftForm({ ...shiftForm, morning_start: v }),
      setEnd: (v: string) => setShiftForm({ ...shiftForm, morning_end: v }),
    },
    {
      key: "evening",
      label: "Evening shift",
      icon: Moon,
      tone: "evening",
      enabled: shiftForm.evening_shift_enabled,
      start: shiftForm.evening_start,
      end: shiftForm.evening_end,
      slots: shiftStats.eSlots,
      toggle: (v: boolean) => setShiftForm({ ...shiftForm, evening_shift_enabled: v }),
      setStart: (v: string) => setShiftForm({ ...shiftForm, evening_start: v }),
      setEnd: (v: string) => setShiftForm({ ...shiftForm, evening_end: v }),
    },
  ];

  return (
    <div className="cm-sched">
      {msg && (
        <div role="status" className={`cm-banner ${msg.ok ? "cm-banner--done" : "cm-banner--urgent"} cm-sched-msg`}>
          <Icon as={msg.ok ? CheckCircle2 : AlertCircle} size={20} />
          <span className="cm-banner__body">{msg.text}</span>
          <button type="button" className="cm-banner__x" onClick={() => setMsg(null)} aria-label="Dismiss message">
            <Icon as={X} size={16} />
          </button>
        </div>
      )}

      {/* ── Weekly availability ─────────────────────────────────────────── */}
      <section className="cm-sched-card" aria-labelledby="cm-sched-title">
        <header className="cm-sched-card__head">
          <div className="cm-sched-card__intro">
            <p className="cm-sched-eyebrow">Clinical roster</p>
            <h3 id="cm-sched-title" className="cm-sched-card__title">Weekly availability</h3>
            <p className="cm-sched-card__desc">
              Publish the hours patients can book — across your clinic branches, online consultations and home visits.
            </p>
            <div className="cm-sched-meta">
              <span><strong>{availability.length}</strong> shift block{availability.length === 1 ? "" : "s"}</span>
              <span><strong>{activeDayCount}</strong> day{activeDayCount === 1 ? "" : "s"} active</span>
              {branches.length > 1 && (
                <span><Icon as={Building2} size={14} /> <strong>{branches.length}</strong> clinic branches</span>
              )}
            </div>
          </div>

          <div className="cm-sched-card__actions">
            <div className="cm-seg" role="group" aria-label="Schedule layout">
              <button
                type="button"
                className="cm-seg__btn"
                aria-pressed={scheduleViewMode === "consolidated"}
                onClick={() => setScheduleViewMode("consolidated")}
                title="Group days that share identical shifts"
              >
                <Icon as={LayoutGrid} size={16} /> Consolidated
              </button>
              <button
                type="button"
                className="cm-seg__btn"
                aria-pressed={scheduleViewMode === "day_by_day"}
                onClick={() => setScheduleViewMode("day_by_day")}
                title="Show every day separately"
              >
                <Icon as={Rows3} size={16} /> By day
              </button>
            </div>
            <Button type="button" variant="primary" onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
              <Icon as={showForm ? X : Plus} size={16} />
              {showForm ? "Close builder" : "Configure shifts"}
            </Button>
          </div>
        </header>

        {/* ── Shift builder ─────────────────────────────────────────────── */}
        {showForm && (
          <div className="cm-sched-builder">
            <div className="cm-seg cm-sched-builder__tabs" role="group" aria-label="Builder type">
              <button type="button" className="cm-seg__btn" aria-pressed={builderTab === "shift"} onClick={() => setBuilderTab("shift")}>
                Shift builder <span className="cm-sched-tag">Recommended</span>
              </button>
              <button type="button" className="cm-seg__btn" aria-pressed={builderTab === "custom"} onClick={() => setBuilderTab("custom")}>
                Single custom block
              </button>
            </div>

            {builderTab === "shift" ? (
              <form onSubmit={handlePublishShifts} className="cm-sched-form">
                <div className="cm-sched-grid-2">
                  <label className="cm-sched-field">
                    <span className="cm-sched-field__label">Practice mode</span>
                    <select
                      className="cm-input cm-input--select"
                      value={shiftForm.consultation_mode}
                      onChange={(e) => setShiftForm({ ...shiftForm, consultation_mode: e.target.value })}
                    >
                      {MODES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="cm-sched-field">
                    <span className="cm-sched-field__label">Slot duration</span>
                    <select
                      className="cm-input cm-input--select"
                      value={shiftForm.slot_duration_minutes}
                      onChange={(e) => setShiftForm({ ...shiftForm, slot_duration_minutes: Number(e.target.value) })}
                    >
                      {SLOT_DURATIONS.map((d) => (
                        <option key={d} value={d}>{d} minutes per patient</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="cm-sched-grid-2">
                  {shiftEditors.map((s) => (
                    <div key={s.key} className="cm-sched-shift-edit" data-enabled={s.enabled}>
                      <label className="cm-sched-shift-edit__head">
                        <input type="checkbox" checked={s.enabled} onChange={(e) => s.toggle(e.target.checked)} />
                        <span className={`cm-sched-glyph cm-sched-glyph--${s.tone}`}><Icon as={s.icon} size={16} /></span>
                        <span className="cm-sched-shift-edit__label">{s.label}</span>
                        {s.enabled && <span className="cm-sched-shift-edit__slots">{s.slots} slots / day</span>}
                      </label>
                      {s.enabled && (
                        <div className="cm-sched-grid-2 cm-sched-grid-2--tight">
                          <label className="cm-sched-field">
                            <span className="cm-sched-field__label">Starts</span>
                            <input type="time" className="cm-input" value={s.start} onChange={(e) => s.setStart(e.target.value)} />
                          </label>
                          <label className="cm-sched-field">
                            <span className="cm-sched-field__label">Ends</span>
                            <input type="time" className="cm-input" value={s.end} onChange={(e) => s.setEnd(e.target.value)} />
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <fieldset className="cm-sched-fieldset">
                  <legend className="cm-sched-fieldset__legend">
                    Practice days
                    <span className="cm-sched-fieldset__count">
                      {shiftForm.selected_days.length} selected
                    </span>
                  </legend>
                  <div className="cm-sched-chips">
                    {presets.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="cm-sched-chip"
                        aria-pressed={sameDays(shiftForm.selected_days, p.days)}
                        onClick={() => setShiftForm({ ...shiftForm, selected_days: p.days })}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="cm-sched-chip cm-sched-chip--quiet"
                      onClick={() => setShiftForm({ ...shiftForm, selected_days: [] })}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="cm-sched-days">
                    {DAYS.map((d) => {
                      const isSelected = shiftForm.selected_days.includes(d.value);
                      return (
                        <label key={d.value} className="cm-sched-day-toggle" data-selected={isSelected}>
                          <input
                            type="checkbox"
                            className="cm-sr"
                            checked={isSelected}
                            onChange={() => handleToggleDay(d.value)}
                          />
                          <span aria-hidden="true">{d.short}</span>
                          <span className="cm-sr">{d.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* ── Branch selector for walk-in centre ── */}
                {shiftForm.consultation_mode === "in_person" && (
                  <fieldset className="cm-sched-fieldset">
                    <legend className="cm-sched-fieldset__legend">
                      Clinic branch
                      <button
                        type="button"
                        className="cm-sched-link"
                        onClick={() => setShowBranchManager((s) => !s)}
                        aria-expanded={showBranchManager}
                      >
                        <Icon as={Settings2} size={14} />
                        {showBranchManager ? "Done" : "Manage branches"}
                      </button>
                    </legend>

                    <div className="cm-sched-chips">
                      {branches.map((b) => {
                        const isSelected = selectedBranchId === b.id || (shiftForm.location_name === b.name && shiftForm.location_address === b.address);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            className="cm-sched-chip"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedBranchId(b.id);
                              setShiftForm({ ...shiftForm, location_name: b.name, location_address: b.address });
                            }}
                          >
                            <Icon as={MapPin} size={14} /> {b.name}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="cm-sched-chip cm-sched-chip--dashed"
                        aria-pressed={selectedBranchId === "new"}
                        onClick={() => {
                          setSelectedBranchId("new");
                          setShiftForm({ ...shiftForm, location_name: "", location_address: "" });
                        }}
                      >
                        <Icon as={Plus} size={14} /> New branch
                      </button>
                    </div>

                    {(selectedBranchId === "new" || !shiftForm.location_name) && (
                      <div className="cm-sched-grid-2 cm-sched-inset">
                        <label className="cm-sched-field">
                          <span className="cm-sched-field__label">Clinic / branch name</span>
                          <input
                            className="cm-input"
                            value={shiftForm.location_name}
                            onChange={(e) => setShiftForm({ ...shiftForm, location_name: e.target.value })}
                            placeholder="e.g. Apex Polyclinic – MVP Colony"
                            required
                          />
                        </label>
                        <label className="cm-sched-field">
                          <span className="cm-sched-field__label">Branch address</span>
                          <input
                            className="cm-input"
                            value={shiftForm.location_address}
                            onChange={(e) => setShiftForm({ ...shiftForm, location_address: e.target.value })}
                            placeholder="Street, area, city"
                            required
                          />
                        </label>
                      </div>
                    )}

                    {showBranchManager && (
                      <div className="cm-sched-inset">
                        <ul className="cm-sched-branch-list">
                          {branches.map((b) => {
                            const count = availability.filter((a) => a.location_name?.trim() === b.name.trim()).length;
                            return (
                              <li key={b.id} className="cm-sched-branch-row">
                                <span className="cm-sched-branch-row__text">
                                  <strong>{b.name}</strong>
                                  <span>{b.address}</span>
                                </span>
                                <span className="cm-sched-count">{count} block{count === 1 ? "" : "s"}</span>
                                <button
                                  type="button"
                                  className="cm-sched-icon-btn"
                                  onClick={() => handleDeleteBranch(b.id)}
                                  disabled={branches.length <= 1}
                                  aria-label={`Delete saved branch ${b.name}`}
                                  title="Delete saved branch"
                                >
                                  <Icon as={Trash2} size={16} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="cm-sched-branch-add">
                          <input
                            className="cm-input"
                            placeholder="New branch name"
                            aria-label="New branch name"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                          />
                          <input
                            className="cm-input"
                            placeholder="Branch address"
                            aria-label="Branch address"
                            value={newBranchAddress}
                            onChange={(e) => setNewBranchAddress(e.target.value)}
                          />
                          <Button type="button" variant="secondary" onClick={handleAddNewBranch}>
                            <Icon as={Plus} size={16} /> Save branch
                          </Button>
                        </div>
                      </div>
                    )}
                  </fieldset>
                )}

                {/* Live slot calculation */}
                <dl className="cm-sched-summary" aria-live="polite">
                  <div><dt>Morning</dt><dd>{shiftStats.mSlots}</dd></div>
                  <div><dt>Evening</dt><dd>{shiftStats.eSlots}</dd></div>
                  <div><dt>Per day</dt><dd>{shiftStats.daily}</dd></div>
                  <div className="cm-sched-summary__total"><dt>Bookable per week</dt><dd>{shiftStats.weekly}</dd></div>
                </dl>

                <div className="cm-sched-form__foot">
                  <label className="cm-sched-check">
                    <input
                      type="checkbox"
                      checked={shiftForm.replace_existing}
                      onChange={(e) => setShiftForm({ ...shiftForm, replace_existing: e.target.checked })}
                    />
                    Replace existing hours on the selected days for this mode
                  </label>
                  <Button type="submit" variant="primary" loading={savingShift}>
                    {savingShift ? "Publishing…" : "Publish schedule"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={addAvailability} className="cm-sched-form">
                <div className="cm-sched-grid-auto">
                  <label className="cm-sched-field">
                    <span className="cm-sched-field__label">Practice mode</span>
                    <select
                      className="cm-input cm-input--select"
                      value={form.consultation_mode}
                      onChange={(e) => setForm({ ...form, consultation_mode: e.target.value })}
                    >
                      {MODES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="cm-sched-field">
                    <span className="cm-sched-field__label">Day of week</span>
                    <select
                      className="cm-input cm-input--select"
                      value={form.day_of_week}
                      onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                      disabled={form.apply_to_all_days}
                    >
                      {DAYS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="cm-sched-field">
                    <span className="cm-sched-field__label">Starts</span>
                    <input type="time" className="cm-input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </label>
                  <label className="cm-sched-field">
                    <span className="cm-sched-field__label">Ends</span>
                    <input type="time" className="cm-input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                  </label>
                  <label className="cm-sched-field">
                    <span className="cm-sched-field__label">Slot duration</span>
                    <select
                      className="cm-input cm-input--select"
                      value={form.slot_duration_minutes}
                      onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })}
                    >
                      {SLOT_DURATIONS.map((d) => (
                        <option key={d} value={d}>{d} minutes</option>
                      ))}
                    </select>
                  </label>
                </div>

                {form.consultation_mode === "in_person" && (
                  <div className="cm-sched-grid-2">
                    <label className="cm-sched-field">
                      <span className="cm-sched-field__label">Clinic / centre name</span>
                      <input
                        className="cm-input"
                        value={form.location_name}
                        onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                        placeholder="e.g. Visakha Multispeciality Clinics"
                      />
                    </label>
                    <label className="cm-sched-field">
                      <span className="cm-sched-field__label">Branch address</span>
                      <input
                        className="cm-input"
                        value={form.location_address}
                        onChange={(e) => setForm({ ...form, location_address: e.target.value })}
                        placeholder="Street, area, city"
                      />
                    </label>
                  </div>
                )}

                <div className="cm-sched-form__foot">
                  <div className="cm-sched-checks">
                    <label className="cm-sched-check">
                      <input
                        type="checkbox"
                        checked={form.apply_to_all_days}
                        onChange={(e) => setForm({ ...form, apply_to_all_days: e.target.checked })}
                      />
                      Same hours every day
                    </label>
                    <label className="cm-sched-check">
                      <input
                        type="checkbox"
                        checked={form.replace_existing}
                        onChange={(e) => setForm({ ...form, replace_existing: e.target.checked })}
                      />
                      Replace existing hours
                    </label>
                  </div>
                  <Button type="submit" variant="primary">Publish block</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Published schedule, per mode ──────────────────────────────── */}
        {MODES.map((m) => {
          let modeRows = availability.filter((a) => a.consultation_mode === m.value);

          const branchNames = Array.from(
            new Set(modeRows.map((r) => r.location_name?.trim()).filter(Boolean))
          );

          if (m.value === "in_person" && selectedBranchFilter !== "all") {
            modeRows = modeRows.filter((r) => r.location_name?.trim() === selectedBranchFilter);
          }

          const consolidatedGroups = buildConsolidatedGroups(modeRows);

          return (
            <div key={m.value} className="cm-sched-mode">
              <div className="cm-sched-mode__head">
                <span className="cm-sched-mode__icon"><Icon as={m.icon} size={16} /></span>
                <h4 className="cm-sched-mode__title">{m.label}</h4>
                <span className="cm-sched-count">
                  {modeRows.length} block{modeRows.length === 1 ? "" : "s"}
                </span>
              </div>

              {m.value === "in_person" && branchNames.length > 1 && (
                <div className="cm-sched-chips cm-sched-filter" role="group" aria-label="Filter by branch">
                  <button
                    type="button"
                    className="cm-sched-chip"
                    aria-pressed={selectedBranchFilter === "all"}
                    onClick={() => setSelectedBranchFilter("all")}
                  >
                    All branches
                    <span className="cm-sched-chip__n">{availability.filter((a) => a.consultation_mode === "in_person").length}</span>
                  </button>
                  {branchNames.map((bName) => {
                    const count = availability.filter(
                      (a) => a.consultation_mode === "in_person" && a.location_name?.trim() === bName
                    ).length;
                    return (
                      <button
                        key={bName}
                        type="button"
                        className="cm-sched-chip"
                        aria-pressed={selectedBranchFilter === bName}
                        onClick={() => setSelectedBranchFilter(bName!)}
                      >
                        <Icon as={MapPin} size={14} /> {bName}
                        <span className="cm-sched-chip__n">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {modeRows.length === 0 ? (
                <div className="cm-sched-empty">
                  <p>No hours published for {m.label.toLowerCase()} yet.</p>
                  {!showForm && (
                    <button
                      type="button"
                      className="cm-sched-link"
                      onClick={() => {
                        setShiftForm((prev) => ({ ...prev, consultation_mode: m.value }));
                        setBuilderTab("shift");
                        setShowForm(true);
                      }}
                    >
                      <Icon as={Plus} size={14} /> Add hours
                    </button>
                  )}
                </div>
              ) : scheduleViewMode === "consolidated" ? (
                <div className="cm-sched-groups">
                  {consolidatedGroups.map((group) => {
                    const isDeleting = deletingGroup === group.allBlockIds[0];

                    return (
                      <article key={group.key} className="cm-sched-group">
                        <header className="cm-sched-group__head">
                          <div className="cm-sched-group__titles">
                            <h5 className="cm-sched-group__title">{group.dayLabel}</h5>
                            <ol className="cm-sched-week" aria-label={`Active on ${group.days.length} day${group.days.length === 1 ? "" : "s"}`}>
                              {DAYS.map((d) => {
                                const on = group.days.includes(d.value);
                                return (
                                  <li key={d.value} className="cm-sched-week__day" data-on={on} title={d.label}>
                                    <span aria-hidden="true">{d.short.charAt(0)}</span>
                                    <span className="cm-sr">{d.label}{on ? " (active)" : ""}</span>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                          <button
                            type="button"
                            className="cm-sched-icon-btn"
                            onClick={() => removeAvailabilityGroup(group.allBlockIds, group.dayLabel)}
                            disabled={isDeleting}
                            aria-label={`Remove shifts for ${group.dayLabel}`}
                            title="Remove these shifts on all listed days"
                          >
                            <Icon as={Trash2} size={16} />
                          </button>
                        </header>

                        {group.location_name && (
                          <p className="cm-sched-loc">
                            <Icon as={MapPin} size={14} />
                            <span>
                              <span className="cm-sched-loc__name">{group.location_name}</span>
                              {group.location_address && <span className="cm-sched-loc__addr">{group.location_address}</span>}
                            </span>
                          </p>
                        )}

                        <ul className="cm-sched-shifts">
                          {group.distinctShifts.map((s, idx) => {
                            const p = shiftPeriod(s.start_time);
                            return (
                              <li key={idx} className="cm-sched-shift">
                                <span className={`cm-sched-glyph cm-sched-glyph--${p.tone}`}><Icon as={p.icon} size={16} /></span>
                                <span className="cm-sched-shift__main">
                                  <span className="cm-sched-shift__name">{p.label}</span>
                                  <span className="cm-sched-shift__time">
                                    {formatTime(s.start_time)} – {formatTime(s.end_time)}
                                  </span>
                                </span>
                                <span className="cm-sched-shift__side">
                                  <span className="cm-sched-shift__slots">{s.slots} slots</span>
                                  <span className="cm-sched-shift__dur">{s.slot_duration_minutes} min each</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>

                        <footer className="cm-sched-group__foot">
                          <span className="cm-sched-group__cap-label">Capacity</span>
                          <span className="cm-sched-group__cap">
                            <strong>{group.totalSlotsDaily}</strong> / day
                            <span aria-hidden="true" className="cm-sched-dot" />
                            <strong>{group.totalSlotsWeekly}</strong> / week
                          </span>
                          {isDeleting && <span className="cm-sched-group__busy">Removing…</span>}
                        </footer>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="cm-sched-daygrid">
                  {DAYS.map((dayObj) => {
                    const dayBlocks = modeRows
                      .filter((r) => r.day_of_week === dayObj.value)
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));

                    if (dayBlocks.length === 0) return null;

                    const primaryLocation = dayBlocks.find((b) => b.location_name)?.location_name;
                    const primaryAddress = dayBlocks.find((b) => b.location_address)?.location_address;

                    return (
                      <article key={dayObj.value} className="cm-sched-group">
                        <header className="cm-sched-group__head">
                          <h5 className="cm-sched-group__title">{dayObj.label}</h5>
                          <span className="cm-sched-count">
                            {dayBlocks.length} shift{dayBlocks.length === 1 ? "" : "s"}
                          </span>
                        </header>

                        <ul className="cm-sched-shifts">
                          {dayBlocks.map((blk) => {
                            const p = shiftPeriod(blk.start_time);
                            return (
                              <li key={blk.id} className="cm-sched-shift">
                                <span className={`cm-sched-glyph cm-sched-glyph--${p.tone}`}><Icon as={p.icon} size={16} /></span>
                                <span className="cm-sched-shift__main">
                                  <span className="cm-sched-shift__name">{p.label} · {blk.slot_duration_minutes} min slots</span>
                                  <span className="cm-sched-shift__time">
                                    {formatTime(blk.start_time)} – {formatTime(blk.end_time)}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  className="cm-sched-icon-btn"
                                  onClick={() => removeAvailability(blk.id)}
                                  aria-label={`Remove ${dayObj.label} ${formatTime(blk.start_time)} shift`}
                                  title="Remove this shift"
                                >
                                  <Icon as={Trash2} size={16} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>

                        {primaryLocation && (
                          <p className="cm-sched-loc cm-sched-loc--foot">
                            <Icon as={MapPin} size={14} />
                            <span>
                              <span className="cm-sched-loc__name">{primaryLocation}</span>
                              {primaryAddress && <span className="cm-sched-loc__addr">{primaryAddress}</span>}
                            </span>
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ── Leave & blocked dates ───────────────────────────────────────── */}
      <section className="cm-sched-card" aria-labelledby="cm-leave-title">
        <header className="cm-sched-card__head">
          <div className="cm-sched-card__intro">
            <p className="cm-sched-eyebrow">Time off</p>
            <h3 id="cm-leave-title" className="cm-sched-card__title">Leave &amp; blocked dates</h3>
            <p className="cm-sched-card__desc">
              Blocking a date stops new bookings for that day. Appointments already confirmed are not affected.
            </p>
          </div>
          <span className={`cm-pill ${blockedDates.length > 0 ? "cm-pill--waiting" : "cm-pill--halted"}`}>
            {blockedDates.length} date{blockedDates.length === 1 ? "" : "s"} blocked
          </span>
        </header>

        <form onSubmit={addBlockedDate} className="cm-sched-form">
          <div className="cm-sched-leave-row">
            <label className="cm-sched-field">
              <span className="cm-sched-field__label">Date</span>
              <input
                type="date"
                className="cm-input"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                required
              />
            </label>
            <label className="cm-sched-field cm-sched-field--grow">
              <span className="cm-sched-field__label">Reason <span className="cm-sched-optional">optional</span></span>
              <input
                className="cm-input"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. National Medical Council annual summit"
              />
            </label>
            <Button type="submit" variant="secondary">
              <Icon as={CalendarOff} size={16} /> Block date
            </Button>
          </div>
          <div className="cm-sched-chips" role="group" aria-label="Quick reasons">
            {LEAVE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="cm-sched-chip"
                aria-pressed={blockReason === preset}
                onClick={() => setBlockReason(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </form>

        {blockedDates.length === 0 ? (
          <div className="cm-sched-empty">
            <p>No leave scheduled. All published shifts are open for booking.</p>
          </div>
        ) : (
          <ul className="cm-sched-leave-list">
            {blockedDates.map((b) => {
              const d = new Date(b.blocked_date + "T00:00:00");
              return (
                <li key={b.id} className="cm-sched-leave">
                  <span className="cm-sched-leave__date" aria-hidden="true">
                    <span className="cm-sched-leave__mon">{d.toLocaleDateString(undefined, { month: "short" })}</span>
                    <span className="cm-sched-leave__day">{d.getDate()}</span>
                  </span>
                  <span className="cm-sched-leave__text">
                    <strong>{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</strong>
                    <span>{b.reason || "Scheduled leave"}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlockedDate(b.id)}
                    aria-label={`Unblock ${b.blocked_date}`}
                    title="Unblock date and restore slots"
                  >
                    Unblock
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
