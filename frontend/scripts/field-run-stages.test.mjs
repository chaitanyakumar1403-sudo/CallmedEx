import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stageOfRun,
  slotMinutes,
  summariseRuns,
  summariseNurseVisits,
} from "../src/app/(app)/dashboard/components/fieldRunStages.mjs";

test("each dispatch status lands in the stage a collector would expect", () => {
  for (const s of ["pending", "searching", "assigned", "scheduled", "confirmed", "provider_accepted"]) {
    assert.equal(stageOfRun(s), "scheduled", s);
  }
  for (const s of ["en_route", "arrived", "in_progress"]) {
    assert.equal(stageOfRun(s), "in_field", s);
  }
  for (const s of ["sample_collected", "collected", "completed", "samples_delivered_to_lab"]) {
    assert.equal(stageOfRun(s), "handover", s);
  }
  for (const s of ["cancelled", "declined", "no_show"]) {
    assert.equal(stageOfRun(s), null, s);
  }
  // An unknown status is still outstanding work, never silently dropped.
  assert.equal(stageOfRun("awaiting_reassignment"), "scheduled");
  assert.equal(stageOfRun("EN_ROUTE"), "in_field");
  assert.equal(stageOfRun(undefined), "scheduled");
});

test("slot times parse in both roster formats", () => {
  assert.equal(slotMinutes("07:00 AM"), 420);
  assert.equal(slotMinutes("12:30 AM"), 30);
  assert.equal(slotMinutes("12:30 PM"), 750);
  assert.equal(slotMinutes("14:30"), 870);
  assert.equal(slotMinutes("nope"), null);
  assert.equal(slotMinutes("99:99"), null);
});

test("a dispatch present in both feeds is counted once", () => {
  const jobs = [
    { id: "d1", status: "en_route", slot_time: "09:15 AM", selected_tests: ["CBC", "TSH"] },
    { id: "d2", status: "scheduled", scheduled_time: "07:00 AM", selected_tests: ["LFT"] },
  ];
  const tasks = [{ id: "d1", status: "en_route" }];

  const s = summariseRuns(jobs, tasks);
  assert.equal(s.total, 2, "d1 must not be double counted");
  assert.equal(s.inField, 1);
  assert.equal(s.scheduled, 1);
  assert.equal(s.tests, 3);
  assert.equal(s.nextSlot, "07:00 AM", "earliest pending draw wins");
});

test("closed runs are excluded and drawn runs stop claiming a next-draw time", () => {
  const s = summariseRuns(
    [
      { id: "a", status: "cancelled", scheduled_time: "05:00 AM" },
      { id: "b", status: "completed", scheduled_time: "06:00 AM", selected_tests: ["CBC"] },
      { id: "c", status: "arrived", scheduled_time: "08:30 AM" },
    ],
    []
  );
  assert.equal(s.total, 2);
  assert.equal(s.handover, 1);
  assert.equal(s.inField, 1);
  assert.equal(s.nextSlot, "08:30 AM");
});

test("rows without an id are counted rather than merged away", () => {
  const s = summariseRuns([{ status: "scheduled" }, { status: "scheduled" }], []);
  assert.equal(s.scheduled, 2);
});

test("empty and missing feeds produce a zeroed summary, never invented volume", () => {
  const s = summariseRuns(null, undefined);
  assert.deepEqual(s, { scheduled: 0, inField: 0, handover: 0, total: 0, tests: 0, nextSlot: null });
});

test("a nurse's live workload splits into offered, travelling and at bedside", () => {
  const s = summariseNurseVisits(
    [
      { offer_id: "o1", priority: "urgent", distance_km: 4.2 },
      { offer_id: "o2", priority: "normal", distance_km: 1.8 },
    ],
    [
      { id: "t1", status: "provider_accepted" },
      { id: "t2", status: "en_route" },
      { id: "t3", status: "arrived" },
      { id: "t4", status: "in_progress" },
    ]
  );
  assert.equal(s.incoming, 2);
  assert.equal(s.enRoute, 2);
  assert.equal(s.bedside, 2);
  assert.equal(s.total, 6);
  assert.equal(s.urgent, 1);
  assert.equal(s.nearestKm, 1.8, "nearest offer, not the first one listed");
});

test("repeated nurse offers and visits are each counted once", () => {
  const s = summariseNurseVisits(
    [{ offer_id: "o1", priority: "urgent" }, { offer_id: "o1", priority: "urgent" }],
    [{ id: "t1", status: "arrived" }, { id: "t1", status: "arrived" }]
  );
  assert.equal(s.incoming, 1);
  assert.equal(s.bedside, 1);
  assert.equal(s.urgent, 1);
});

test("a closed nurse visit is dropped and an unknown one still counts as assigned", () => {
  const s = summariseNurseVisits(
    [],
    [{ id: "t1", status: "cancelled" }, { id: "t2", status: "reassigned_pending" }]
  );
  assert.equal(s.total, 1);
  assert.equal(s.enRoute, 1);
});

test("a nurse with nothing waiting reports zeros and no distance", () => {
  const s = summariseNurseVisits(null, undefined);
  assert.deepEqual(s, { incoming: 0, enRoute: 0, bedside: 0, total: 0, urgent: 0, nearestKm: null });
});
