import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeSavedScope,
  toScopePayload,
  splitFee,
} from "../src/app/(app)/dashboard/nurse/nurseScope.mjs";

const DEFAULTS = [
  { code: "NUR-01", name: "IM Injection", category: "Basic Nursing", standard_fee: 300,
    nurse_net: 240, platform_fee: 60, duration: "20 min", supplies: "Syringe", enabled: true },
];

test("backend-shaped saves round-trip without duplicates or lost state", () => {
  const edited = [{ ...DEFAULTS[0], ...splitFee(450), enabled: false, duration: "25 min" },
    { code: "NUR-CUST-abc", name: "Suture Removal", category: "Wound Care", ...splitFee(500),
      duration: "30 min", supplies: "Cutter", enabled: true, is_custom: true }];
  // What sanitize_selected_scope persists: id / service_name / is_active.
  const stored = toScopePayload(edited).map((p) => ({
    id: p.id, service_name: p.service_name, category: p.category, standard_fee: p.standard_fee,
    duration: p.duration, supplies: p.supplies, is_active: p.is_active,
  }));
  const back = mergeSavedScope(DEFAULTS, stored);
  assert.equal(back.length, 2);
  assert.equal(back[0].enabled, false);
  assert.equal(back[0].standard_fee, 450);
  assert.equal(back[0].nurse_net, 360);
  assert.equal(back[0].duration, "25 min");
  assert.equal(back[1].name, "Suture Removal");
  assert.equal(back[1].is_custom, true);
});

test("master catalog items keep their names and are not marked custom", () => {
  const back = mergeSavedScope(DEFAULTS, [
    { id: "nurse_vitals", service_name: "Vital Signs Monitoring", category: "Basic Nursing Procedures",
      standard_fee: 300, is_active: true },
  ]);
  assert.equal(back.length, 2);
  assert.equal(back[1].name, "Vital Signs Monitoring");
  assert.equal(back[1].is_custom, false);
});

test("legacy saves that stored the code as the name do not show the code", () => {
  const back = mergeSavedScope([], [{ id: "CUST-123", service_name: "CUST-123", standard_fee: 400 }]);
  assert.equal(back[0].name, "Custom Procedure");
  assert.equal(back[0].is_custom, true);
});

test("fee split always sums back to the gross fee", () => {
  for (const fee of [100, 333, 455, 1500]) {
    const s = splitFee(fee);
    assert.equal(s.nurse_net + s.platform_fee, s.standard_fee);
  }
});
