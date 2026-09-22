// Nurse scope-of-services wire mapping.
//
// The backend (provider_scope.py → sanitize_selected_scope) stores each item
// as {id, service_name, category, standard_fee, nurse_net, duration, supplies,
// is_active}. The dashboard used to write {code, service, enabled} and read
// the same names back, so: `enabled` was dropped (a paused procedure came back
// active), `service` was ignored (names saved as the code), and nothing
// matched on reload, so every saved item was re-appended as an unnamed
// "Custom Procedure" duplicate. Both directions live here so they cannot
// drift apart again.

const PLATFORM_SHARE = 0.2;

export function splitFee(fee) {
  const gross = Math.round(Number(fee) || 0);
  const platform = Math.round(gross * PLATFORM_SHARE);
  return { standard_fee: gross, platform_fee: platform, nurse_net: gross - platform };
}

export function isCustomCode(code) {
  return /^(NUR-CUST-|custom_|CUST-)/.test(String(code || ""));
}

/** Merge the saved backend scope onto the built-in defaults. */
export function mergeSavedScope(defaults, savedList) {
  const byKey = new Map();
  for (const s of savedList || []) {
    const key = s && (s.id || s.code);
    if (key && !byKey.has(key)) byKey.set(key, s);
  }

  const merged = defaults.map((dp) => {
    const found = byKey.get(dp.code);
    if (!found) return dp;
    byKey.delete(dp.code);
    const fee = Number(found.standard_fee ?? found.custom_price) || dp.standard_fee;
    return {
      ...dp,
      ...splitFee(fee),
      duration: found.duration || dp.duration,
      supplies: found.supplies || dp.supplies,
      enabled: (found.is_active ?? found.enabled) !== false,
    };
  });

  for (const [key, s] of byKey) {
    const rawName = s.service_name || s.service || s.name;
    // Older saves stored the code itself as the name.
    const name = rawName && rawName !== key ? rawName : "Custom Procedure";
    const fee = Number(s.standard_fee ?? s.custom_price ?? s.benchmark_price) || 400;
    merged.push({
      code: key,
      name,
      category: s.category || "Specialized Care",
      ...splitFee(fee),
      duration: s.duration || "30 min",
      supplies: s.supplies || "Standard clinical kit",
      enabled: (s.is_active ?? s.enabled) !== false,
      is_custom: isCustomCode(key),
    });
  }
  return merged;
}

/** Shape the list the way PUT /api/providers/me/scope reads it. */
export function toScopePayload(list) {
  return list.map((p) => ({
    id: p.code,
    code: p.code,
    service_name: p.name,
    name: p.name,
    category: p.category,
    custom_price: p.standard_fee,
    standard_fee: p.standard_fee,
    duration: p.duration,
    supplies: p.supplies,
    modality: "home",
    is_active: p.enabled,
  }));
}
