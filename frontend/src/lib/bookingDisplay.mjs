// Patient-facing formatting for bookings.
//
// `bookings.notes` is an append-only audit log, not display copy: the booking
// page writes "Tests: … | Total: ₹…", "Package: …", "Doctor: …" and
// "Collection address: …" lines, and the backend appends
// "[<iso timestamp>] Cancelled by patient…" and "[Auto-Refuted] …" lines.
// Other backend code parses those lines, so the storage format stays; this
// turns them into something a patient should see.

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** ₹189.6 -> "₹189.60"; whole rupees drop the paise ("₹948"). */
export function formatINR(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const s = INR.format(n);
  return Number.isInteger(n) ? s.replace(/\.00$/, "") : s;
}

const KIND_LABELS = {
  lab_test: "Lab Test",
  home_collection: "Home Sample Collection",
  health_package: "Health Package",
  doctor_appointment: "Doctor Consultation",
  doctor_consultation: "Doctor Consultation",
  video_consultation: "Video Consultation",
  nri_consultation: "NRI Consultation",
  diagnostic: "Diagnostic Test",
  radiology: "Imaging",
  nursing: "Home Nursing",
  home_nursing: "Home Nursing",
  pharmacy: "Pharmacy Order",
};

export function bookingKindLabel(serviceType) {
  if (!serviceType) return "Booking";
  return KIND_LABELS[serviceType]
    || String(serviceType).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Catalogue rows that were seeded without a real name ("lab_1", "test_12").
// ponytail: pattern match, the real fix is naming those catalogue rows.
const INTERNAL_ID = /^[a-z]+_\d+$/i;

const cleanList = (s) =>
  s.split(",").map((x) => x.trim()).filter((x) => x && !INTERNAL_ID.test(x)).join(", ");

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * @returns {{ title: string, address: string, total: number|null,
 *   statusNote: string, fee: number|null, autoExpired: boolean,
 *   cancelledByPatient: boolean }}
 */
export function parseBookingNotes(notes, serviceType) {
  const out = {
    title: "", address: "", total: null, statusNote: "", fee: null,
    autoExpired: false, cancelledByPatient: false,
  };
  const raw = String(notes || "");
  // Older rows put everything on one line; split before each known marker.
  const lines = raw
    .replace(/\s*(Collection address:|\[[^\]]+\]|Doctor:|Package:|Tests:)/g, "\n$1")
    .split("\n").map((l) => l.trim()).filter(Boolean);

  const other = [];
  for (const line of lines) {
    let m;
    if ((m = line.match(/^Tests:\s*(.*?)(?:\s*\|\s*Total:\s*₹?\s*([\d.,]+))?\s*$/))) {
      out.title = cleanList(m[1]) || out.title;
      if (m[2]) out.total = Number(m[2].replace(/,/g, ""));
    } else if ((m = line.match(/^Package:\s*(.+)$/))) {
      out.title = m[1].trim();
    } else if ((m = line.match(/^Doctor:\s*(.+)$/))) {
      const name = m[1].replace(/\s*·.*$/, "").replace(/^Dr\.?\s*/i, "").trim();
      out.title = `Dr. ${titleCase(name)}`;
    } else if ((m = line.match(/^Collection address:\s*(.+)$/))) {
      out.address = m[1].trim();
    } else if (line.startsWith("[Auto-Refuted]")) {
      out.autoExpired = true;
    } else if ((m = line.match(/^\[[^\]]+\]\s*(.*)$/))) {
      const body = m[1];
      if (/Cancelled by patient/i.test(body)) out.cancelledByPatient = true;
      const fee = body.match(/Penalty:\s*₹\s*([\d,]+(?:\.\d+)?)/);
      if (fee) out.fee = Number(fee[1].replace(/,/g, ""));
      else if (/Cancellation fee applied/i.test(body)) out.fee = out.fee ?? 0;
    } else {
      other.push(line);
    }
  }

  if (out.autoExpired) {
    out.statusNote = "Expired — the provider did not confirm before the scheduled time. You were not charged.";
  } else if (out.cancelledByPatient) {
    out.statusNote = out.fee
      ? `Cancelled by you · ${formatINR(out.fee)} late-cancellation fee`
      : out.fee === 0 ? "Cancelled by you · late-cancellation fee applied" : "Cancelled by you";
  }

  if (!out.title) {
    // Free-text notes that aren't one of the audit markers (e.g. "Home Visit").
    const free = other.join(" ").replace(/Quick Re-Order of\s*/i, "").trim();
    out.title = free && free.length <= 80 && !free.includes("[") ? free : bookingKindLabel(serviceType);
  }
  return out;
}

/** "22 Sep 2026 · 6:30 AM", or "" for bad input. */
export function formatSlot(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} · ${time.toUpperCase()}`;
}
