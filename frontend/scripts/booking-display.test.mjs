import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBookingNotes, formatINR, bookingKindLabel } from "../src/lib/bookingDisplay.mjs";

test("late cancellation: internal ids, timestamps and raw penalty never reach the patient", () => {
  const notes = "Tests: lab_1, Basic Screening (Non Diabetic) | Total: ₹948\n" +
    "[2026-09-09T10:51:43.092278] Cancelled by patient. Cancellation fee applied (Late Cancellation / En Route). Penalty: ₹189.6.";
  const r = parseBookingNotes(notes, "lab_test");
  assert.equal(r.title, "Basic Screening (Non Diabetic)");
  assert.equal(r.total, 948);
  assert.equal(r.fee, 189.6);
  assert.equal(r.statusNote, "Cancelled by you · ₹189.60 late-cancellation fee");
  assert.ok(!JSON.stringify(r).includes("2026-09-09T"));
});

test("single-line legacy notes with address and dispatch cancel", () => {
  const notes = "Package: Basic Screening (Diabetic) Collection address: L.B Nagar, Visakhapatnam, 530008, India " +
    "[2026-09-22T12:42:02.817280] Cancelled by patient via dispatch tracker.";
  const r = parseBookingNotes(notes, "home_collection");
  assert.equal(r.title, "Basic Screening (Diabetic)");
  assert.equal(r.address, "L.B Nagar, Visakhapatnam, 530008, India");
  assert.equal(r.statusNote, "Cancelled by you");
});

test("auto-expired doctor appointment", () => {
  const notes = "Doctor: LATCHIREDDI SA NAIDU\n[Auto-Refuted] Automatically cancelled: Scheduled appointment date passed without provider fulfillment/acceptance.";
  const r = parseBookingNotes(notes, "doctor_appointment");
  assert.equal(r.title, "Dr. Latchireddi Sa Naidu");
  assert.ok(r.autoExpired);
  assert.match(r.statusNote, /not charged/);
});

test("fallbacks", () => {
  assert.equal(parseBookingNotes("", "lab_test").title, "Lab Test");
  assert.equal(parseBookingNotes(null, "some_new_kind").title, "Some New Kind");
  assert.equal(formatINR(948), "₹948");
  assert.equal(formatINR(189.6), "₹189.60");
  assert.equal(bookingKindLabel("doctor_appointment"), "Doctor Consultation");
});
