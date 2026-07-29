"use client";

/**
 * StateDistrictPicker — State → District cascade with GPS auto-detect.
 *
 * Shared by /diagnostics (Book a Test) and /consultation (Walk-in & Home Visit
 * modes). Districts come from src/data/india-locations.json — a hardcoded
 * state → districts map, so no extra API round-trip to render the cascade.
 *
 * Auto-detect reverse-geocodes the browser position (Geoapify when a key is
 * configured, Nominatim otherwise) and fuzzy-matches the returned state and
 * district onto the JSON. A failed district match still fills the state so the
 * patient only has to pick the district manually.
 */

import { useCallback, useState } from "react";
import LOCATIONS from "@/data/india-locations.json";

const LOCATION_MAP = LOCATIONS as Record<string, string[]>;
const STATES = Object.keys(LOCATION_MAP).sort();

// Reverse geocoders disagree on naming ("Visakhapatnam" vs "Vishakhapatnam",
// "Bengaluru" vs "Bangalore"), so matching is normalised-contains rather than
// strict equality.
function norm(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z]/g, "");
}

function findState(raw: string): string {
  const n = norm(raw);
  if (!n) return "";
  return (
    STATES.find((s) => norm(s) === n) ||
    STATES.find((s) => norm(s).includes(n) || n.includes(norm(s))) ||
    ""
  );
}

function findDistrict(state: string, ...candidates: string[]): string {
  const list = LOCATION_MAP[state] || [];
  for (const raw of candidates) {
    const n = norm(raw);
    if (!n) continue;
    const exact = list.find((d) => norm(d) === n);
    if (exact) return exact;
  }
  for (const raw of candidates) {
    const n = norm(raw);
    if (!n || n.length < 4) continue;
    const fuzzy = list.find((d) => norm(d).includes(n) || n.includes(norm(d)));
    if (fuzzy) return fuzzy;
  }
  return "";
}

interface StateDistrictPickerProps {
  stateValue: string;
  districtValue: string;
  detected: boolean;
  onChange: (next: { state: string; district: string; detected: boolean }) => void;
}

export default function StateDistrictPicker({
  stateValue,
  districtValue,
  detected,
  onChange,
}: StateDistrictPickerProps) {
  const [detecting, setDetecting] = useState(false);

  const districts = stateValue ? LOCATION_MAP[stateValue] || [] : [];

  const handleDetect = useCallback(() => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || "";
          let rawState = "";
          let districtCandidates: string[] = [];

          if (geoapifyKey) {
            const res = await fetch(
              `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${geoapifyKey}&format=json`
            );
            const json = await res.json();
            const r = json.results?.[0] || {};
            rawState = r.state || "";
            districtCandidates = [r.district, r.county, r.city, r.town, r.village].filter(Boolean);
          } else {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
              { headers: { "Accept-Language": "en", "User-Agent": "CallMedex/2.0" } }
            );
            const data = await res.json();
            const a = data.address || {};
            rawState = a.state || "";
            districtCandidates = [a.state_district, a.county, a.city_district, a.city, a.town, a.village].filter(Boolean);
          }

          const matchedState = findState(rawState);
          if (matchedState) {
            const matchedDistrict = findDistrict(matchedState, ...districtCandidates);
            onChange({ state: matchedState, district: matchedDistrict, detected: true });
          }
          // Unmatched state → silent no-op; the patient picks manually.
        } catch {
          // Silent failure — manual selection still works.
        } finally {
          setDetecting(false);
        }
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [onChange]);

  const border = detected ? "1.5px solid #22c55e" : "1.5px solid #cbd5e1";
  const background = detected ? "#f0fdf4" : "#fff";

  return (
    <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 140, flexWrap: "nowrap" }}>
      <select
        value={stateValue}
        onChange={(e) => onChange({ state: e.target.value, district: "", detected: false })}
        aria-label="State"
        style={{
          flex: 1,
          minWidth: 140,
          padding: "14px 12px",
          borderRadius: 12,
          border,
          fontSize: "0.92rem",
          backgroundColor: background,
          color: stateValue ? "#0f172a" : "#64748b",
          cursor: "pointer",
        }}
      >
        <option value="">State</option>
        {STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={districtValue}
        onChange={(e) => onChange({ state: stateValue, district: e.target.value, detected: false })}
        disabled={!stateValue}
        aria-label="District"
        style={{
          flex: 1,
          minWidth: 140,
          padding: "14px 12px",
          borderRadius: 12,
          border,
          fontSize: "0.92rem",
          backgroundColor: !stateValue ? "#f8fafc" : background,
          color: districtValue ? "#0f172a" : "#64748b",
          cursor: stateValue ? "pointer" : "not-allowed",
        }}
      >
        <option value="">{stateValue ? "District" : "Select state first"}</option>
        {districts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleDetect}
        disabled={detecting}
        title="Auto-detect your location"
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1.5px solid #cbd5e1",
          background: detecting ? "#f1f5f9" : detected ? "#f0fdf4" : "#fff",
          cursor: detecting ? "wait" : "pointer",
          fontSize: "1.1rem",
          display: "flex",
          alignItems: "center",
          transition: "all 0.2s",
        }}
      >
        {detecting ? (
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>📡</span>
        ) : detected ? (
          "✅"
        ) : (
          "📍"
        )}
      </button>
    </div>
  );
}
