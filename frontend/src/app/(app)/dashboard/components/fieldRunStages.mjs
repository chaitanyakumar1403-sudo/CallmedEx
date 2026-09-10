/**
 * Field-run lifecycle grouping for the phlebotomist dashboard.
 *
 * Plain JS rather than .ts so `node --test scripts/*.test.mjs` imports the
 * exact code the dashboard runs, instead of a copy that drifts away from it.
 */

/** Runs that are over, or never happened — excluded from every bucket. */
const CLOSED = new Set(["cancelled", "declined", "rejected", "no_show", "expired", "failed"]);

/** Collector is out on the run. */
const IN_FIELD = new Set(["en_route", "arrived", "in_progress"]);

/** Blood is drawn — the run now belongs to the sample chain, not the road. */
const HANDOVER = new Set(["sample_collected", "collected", "completed", "samples_delivered_to_lab"]);

/**
 * @param {unknown} status
 * @returns {"scheduled" | "in_field" | "handover" | null}
 */
export function stageOfRun(status) {
  const s = String(status || "").trim().toLowerCase();
  if (CLOSED.has(s)) return null;
  if (HANDOVER.has(s)) return "handover";
  if (IN_FIELD.has(s)) return "in_field";
  // pending / searching / assigned / scheduled / confirmed / provider_accepted,
  // plus any status this build has not seen yet: still work the collector owes.
  return "scheduled";
}

const TIME_RE = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i;

/**
 * "07:00 AM" or "14:30" -> minutes past midnight; null when unparseable.
 * @param {unknown} value
 * @returns {number | null}
 */
export function slotMinutes(value) {
  const m = TIME_RE.exec(String(value || ""));
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  const meridiem = m[3] ? m[3].toLowerCase() : "";
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

/**
 * Bucket a collector's day into the three field stages.
 *
 * @param {Array<Record<string, any>> | null | undefined} jobs rostered runs
 * @param {Array<Record<string, any>> | null | undefined} tasks live dispatch runs
 */
export function summariseRuns(jobs, tasks) {
  /** @type {Map<string, Record<string, any>>} */
  const seen = new Map();
  const rows = [...(jobs || []), ...(tasks || [])];
  rows.forEach((row, i) => {
    // The roster feed and the live-dispatch feed overlap: the same dispatch id
    // appears in both, and counting it twice would inflate the collector's day.
    const key = String((row && (row.id || row.dispatch_id || row.booking_id)) || `row-${i}`);
    if (!seen.has(key)) seen.set(key, row);
  });

  const counts = { scheduled: 0, in_field: 0, handover: 0 };
  let tests = 0;
  /** @type {string | null} */
  let nextSlot = null;
  let nextSlotAt = Infinity;

  for (const row of seen.values()) {
    const stage = stageOfRun(row && row.status);
    if (!stage) continue;
    counts[stage] += 1;
    if (row && Array.isArray(row.selected_tests)) tests += row.selected_tests.length;

    // A drawn sample has no draw time left to show, so only pending work
    // contributes to "next draw".
    if (stage === "handover") continue;
    const raw = (row && (row.scheduled_time || row.slot_time)) || "";
    const at = slotMinutes(raw);
    if (at !== null && at < nextSlotAt) {
      nextSlotAt = at;
      nextSlot = String(raw).trim();
    }
  }

  return {
    scheduled: counts.scheduled,
    inField: counts.in_field,
    handover: counts.handover,
    total: counts.scheduled + counts.in_field + counts.handover,
    tests,
    nextSlot,
  };
}

/** Nurse has accepted the visit and is travelling to it. */
const NURSE_EN_ROUTE = new Set(["provider_accepted", "accepted", "en_route"]);

/** Nurse is with the patient. */
const NURSE_BEDSIDE = new Set(["arrived", "in_progress"]);

/**
 * Bucket a nurse's live workload. Unlike the collector roster there is no
 * scheduled or completed feed for this role, so the three buckets are the
 * three live states: offered, travelling, and with the patient.
 *
 * @param {Array<Record<string, any>> | null | undefined} offers pending dispatch offers
 * @param {Array<Record<string, any>> | null | undefined} tasks accepted dispatch runs
 */
export function summariseNurseVisits(offers, tasks) {
  /** @type {Map<string, Record<string, any>>} */
  const uniqueOffers = new Map();
  (offers || []).forEach((o, i) => {
    const key = String((o && (o.offer_id || o.dispatch_request_id)) || `offer-${i}`);
    if (!uniqueOffers.has(key)) uniqueOffers.set(key, o);
  });

  let urgent = 0;
  /** @type {number | null} */
  let nearestKm = null;
  for (const o of uniqueOffers.values()) {
    if (String((o && o.priority) || "").trim().toLowerCase() === "urgent") urgent += 1;
    const km = Number(o && o.distance_km);
    if (Number.isFinite(km) && km >= 0 && (nearestKm === null || km < nearestKm)) nearestKm = km;
  }

  /** @type {Map<string, Record<string, any>>} */
  const seenTasks = new Map();
  (tasks || []).forEach((t, i) => {
    const key = String((t && (t.id || t.dispatch_id || t.booking_id)) || `task-${i}`);
    if (!seenTasks.has(key)) seenTasks.set(key, t);
  });

  let enRoute = 0;
  let bedside = 0;
  for (const t of seenTasks.values()) {
    const s = String((t && t.status) || "").trim().toLowerCase();
    if (CLOSED.has(s)) continue;
    if (NURSE_BEDSIDE.has(s)) bedside += 1;
    // Accepted but not yet at the door, plus any status this build has not
    // seen: assigned work the nurse still has to reach.
    else if (NURSE_EN_ROUTE.has(s) || s) enRoute += 1;
  }

  const incoming = uniqueOffers.size;
  return { incoming, enRoute, bedside, total: incoming + enRoute + bedside, urgent, nearestKm };
}
