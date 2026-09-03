"use client";

/**
 * Book a physiotherapist or dietitian — the three ways they actually work.
 *
 *   Online consultation → video call, no travel for either side
 *   Home visit          → the therapist travels to the patient; this raises a
 *                         dispatch to that specific therapist, who accepts it
 *                         from their own dashboard, and the patient then gets
 *                         live tracking and an arrival OTP like any other visit
 *   Walk-in centre      → the patient travels to the therapist's clinic; the
 *                         slots shown are exactly the in_person availability
 *                         blocks the therapist published, with the centre name
 *                         and address they entered
 *
 * Every provider, fee and slot on this page comes from the database. Nothing
 * here is seeded with placeholder practitioners.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StateDistrictPicker from "@/components/StateDistrictPicker";
import LocationPicker from "@/components/LocationPicker";
import {
  Video,
  Home,
  Building2,
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  User,
  Star,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

type Mode = "online" | "home_visit" | "in_person";

const MODES: { value: Mode; label: string; blurb: string; Icon: any }[] = [
  { value: "online", label: "Online consultation", blurb: "Video call — no travel", Icon: Video },
  { value: "home_visit", label: "Home visit", blurb: "They come to you", Icon: Home },
  { value: "in_person", label: "Walk-in centre", blurb: "You visit their clinic", Icon: Building2 },
];

const ROLES = [
  { value: "physiotherapist", label: "Physiotherapist", service_type: "physiotherapy" },
  { value: "dietitian", label: "Dietitian", service_type: "consultation" },
];

interface Provider {
  user_id: string;
  full_name: string;
  role: string;
  specialization: string;
  qualification: string;
  years_of_experience: number;
  consultation_fee: number | null;
  home_visit_fee: number | null;
  rating: number | null;
  total_reviews: number;
  city: string;
  district: string;
  clinic_center_name: string;
  available_for_online: boolean;
  available_for_home_visit: boolean;
}

interface Slot {
  time: string;
  end_time: string;
  display: string;
  consultation_mode: string;
  is_available: boolean;
  location: string;
  location_address: string;
}

// The backend keys availability and fees on these exact strings.
const MODE_TO_FEE_FIELD: Record<Mode, "consultation_fee" | "home_visit_fee"> = {
  online: "consultation_fee",
  in_person: "consultation_fee",
  home_visit: "home_visit_fee",
};

function TherapyBookingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [role, setRole] = useState(searchParams.get("role") || "physiotherapist");
  const [mode, setMode] = useState<Mode>("online");
  const [loc, setLoc] = useState({ state: "", district: "", detected: false });

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selected, setSelected] = useState<Provider | null>(null);

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);

  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const roleMeta = ROLES.find((r) => r.value === role) || ROLES[0];

  // ── Discovery ────────────────────────────────────────────────────────
  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    setError("");
    setSelected(null);
    setSlots([]);
    setSlot(null);
    try {
      const params = new URLSearchParams({ role });
      // The backend understands online / home / clinic.
      params.set(
        "modality",
        mode === "home_visit" ? "home" : mode === "in_person" ? "clinic" : "online"
      );
      if (loc.district) params.set("district", loc.district);

      const res = await fetch(`${apiBase}/api/providers/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setProviders(data.data?.providers || []);
      } else {
        setError(data.detail || "Could not load specialists.");
      }
    } catch {
      setError("Network error — could not load specialists.");
    } finally {
      setLoadingProviders(false);
    }
  }, [role, mode, loc.district]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // ── Slots for the chosen provider + mode + date ──────────────────────
  useEffect(() => {
    if (!selected || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
      setSlot(null);
      try {
        const res = await fetch(
          `${apiBase}/api/providers/slots?provider_id=${selected.user_id}` +
            `&target_date=${date}&mode=${mode}`,
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );
        const data = await res.json();
        if (!cancelled) setSlots(data.success ? data.slots || [] : []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, date, mode]);

  const feeFor = (p: Provider) => p[MODE_TO_FEE_FIELD[mode]];

  const canSubmit =
    !!selected &&
    !!slot &&
    (mode !== "home_visit" || (!!address && !!coords)) &&
    !submitting;

  const book = async () => {
    if (!selected || !slot) return;
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, any> = {
        provider_id: selected.user_id,
        provider_type: role,
        service_type: roleMeta.service_type,
        // create_booking parses "provider|date|HH:MM" and confirms the slot.
        slot_id: `${selected.user_id}|${date}|${slot.time}`,
        consultation_mode: mode,
        notes,
        total_price: feeFor(selected) ?? 0,
        preferred_date: date,
      };
      if (mode === "home_visit" && coords) {
        body.collection_lat = coords.lat;
        body.collection_lng = coords.lng;
        body.collection_address = address;
      }

      const res = await fetch(`${apiBase}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // A home visit also raises a dispatch to the chosen therapist. Carry
        // it into the dashboard tracker so the patient can follow it.
        const dispatchId = data.data?.dispatch?.dispatch_id;
        if (dispatchId && typeof window !== "undefined") {
          localStorage.setItem("activeDispatchId", dispatchId);
        }
        setResult(data.data);
      } else {
        setError(data.detail || data.message || "Could not complete the booking.");
      }
    } catch {
      setError("Network error — the booking was not placed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmation ─────────────────────────────────────────────────────
  if (result) {
    const dispatch = result.dispatch;
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 20 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", background: "white", borderRadius: 14, padding: 30, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <CheckCircle2 size={48} color="#16a34a" />
          </div>
          <h2 style={{ margin: "0 0 8px", color: "#166534" }}>Appointment confirmed</h2>
          <p style={{ color: "#475569", fontSize: "0.92rem" }}>
            {selected?.full_name} · {MODES.find((m) => m.value === mode)?.label} · {date} at {slot?.display}
          </p>

          {mode === "in_person" && slot?.location && (
            <div style={{ marginTop: 16, padding: 16, background: "#f8fafc", borderRadius: 10, textAlign: "left" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>{slot.location}</div>
              {slot.location_address && (
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>{slot.location_address}</div>
              )}
            </div>
          )}

          {mode === "home_visit" && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 10,
                textAlign: "left",
                background: dispatch?.success ? "#f0fdf4" : "#fffbeb",
                border: `1px solid ${dispatch?.success ? "#86efac" : "#fcd34d"}`,
              }}
            >
              {/* Never claim a therapist is on the way when no dispatch was
                  raised — say exactly what happened. */}
              <div style={{ fontSize: "0.88rem", color: dispatch?.success ? "#166534" : "#92400e" }}>
                {dispatch?.success
                  ? `${selected?.full_name} has been notified and will confirm shortly. You can track the visit from your dashboard.`
                  : dispatch?.message ||
                    "Your appointment is booked. We are still contacting your therapist."}
              </div>
            </div>
          )}

          <button
            onClick={() => router.push("/dashboard/patient")}
            style={{ marginTop: 22, padding: "12px 24px", borderRadius: 10, border: "none", background: "#0f4c81", color: "white", fontWeight: 700, cursor: "pointer" }}
          >
            Go to my dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Main flow ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 20 }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, #0f4c81, #2563eb)", borderRadius: 16, padding: "26px 32px", color: "white", marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: "1.45rem" }}>Book a {roleMeta.label}</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.9, fontSize: "0.9rem" }}>
            Online, at your home, or at their centre — verified specialists only.
          </p>
        </div>

        {/* Role + mode */}
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 999,
                  border: role === r.value ? "2px solid #0f4c81" : "1px solid #cbd5e1",
                  background: role === r.value ? "#eff6ff" : "white",
                  fontWeight: 700,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            {MODES.map((m) => {
              const IconComp = m.Icon;
              const isSelected = mode === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  style={{
                    textAlign: "left",
                    padding: 16,
                    borderRadius: 10,
                    border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: isSelected ? "#eff6ff" : "white",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ color: isSelected ? "#2563eb" : "#64748b", marginBottom: 8 }}>
                    <IconComp size={24} />
                  </div>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{m.label}</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{m.blurb}</div>
                </button>
              );
            })}
          </div>

          {mode !== "online" && (
            <div style={{ marginTop: 18 }}>
              <StateDistrictPicker
                stateValue={loc.state}
                districtValue={loc.district}
                detected={loc.detected}
                onChange={setLoc}
              />
            </div>
          )}
        </div>

        {/* Providers */}
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: "1.05rem", color: "#0f172a" }}>
            Available {roleMeta.label.toLowerCase()}s
          </h3>

          {loadingProviders ? (
            <div style={{ color: "#64748b", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 8, padding: "20px 0" }}>
              <Clock size={16} className="animate-spin" /> Finding specialists…
            </div>
          ) : providers.length === 0 ? (
            <div style={{ padding: "24px 20px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                No verified {roleMeta.label.toLowerCase()} is currently listed for {MODES.find((m) => m.value === mode)?.label.toLowerCase()}
                {loc.district ? ` in ${loc.district}` : ""}.
              </div>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 14px 0" }}>
                Specialists are continuously onboarded and verified. You can consult a verified {roleMeta.label.toLowerCase()} online via live video room.
              </p>
              {mode !== "online" && (
                <button
                  type="button"
                  onClick={() => setMode("online")}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#0284c7",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Video size={15} /> Switch to Online Video Consultation
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {providers.map((p) => {
                const isSel = selected?.user_id === p.user_id;
                const fee = feeFor(p);
                return (
                  <button
                    key={p.user_id}
                    onClick={() => setSelected(p)}
                    style={{
                      textAlign: "left",
                      border: isSel ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      background: isSel ? "#eff6ff" : "white",
                      borderRadius: 10,
                      padding: "14px 18px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{p.full_name}</div>
                        <div style={{ fontSize: "0.83rem", color: "#475569", marginTop: 2 }}>
                          {p.specialization}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                          {p.qualification}
                          {p.years_of_experience ? ` · ${p.years_of_experience} yrs` : ""}
                          {p.district ? ` · ${p.district}` : ""}
                        </div>
                        {mode === "in_person" && p.clinic_center_name && (
                          <div style={{ fontSize: "0.78rem", color: "#0f4c81", marginTop: 2 }}>
                            {p.clinic_center_name}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>
                          {fee != null ? `₹${fee}` : "Fee on request"}
                        </div>
                        {/* Unrated stays unrated — no invented stars. */}
                        {p.rating != null && (
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                            ★ {p.rating} ({p.total_reviews})
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Date + slots */}
        {selected && (
          <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "1.05rem", color: "#0f172a" }}>Pick a time</h3>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 16 }}
            />

            {!date ? (
              <div style={{ color: "#64748b", fontSize: "0.88rem" }}>Choose a date to see open slots.</div>
            ) : loadingSlots ? (
              <div style={{ color: "#64748b", fontSize: "0.88rem" }}>Loading slots…</div>
            ) : slots.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: "0.88rem" }}>
                {selected.full_name} has no {MODES.find((m) => m.value === mode)?.label.toLowerCase()} hours
                on this date. Try another day.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      disabled={!s.is_available}
                      onClick={() => setSlot(s)}
                      style={{
                        padding: "9px 14px",
                        borderRadius: 8,
                        border: slot?.time === s.time ? "2px solid #2563eb" : "1px solid #cbd5e1",
                        background: !s.is_available ? "#f1f5f9" : slot?.time === s.time ? "#eff6ff" : "white",
                        color: !s.is_available ? "#94a3b8" : "#0f172a",
                        fontWeight: 600,
                        cursor: s.is_available ? "pointer" : "not-allowed",
                        textDecoration: s.is_available ? "none" : "line-through",
                      }}
                    >
                      {s.display}
                    </button>
                  ))}
                </div>
                {slot?.location && mode === "in_person" && (
                  <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: "0.85rem" }}>
                    <strong>{slot.location}</strong>
                    {slot.location_address ? ` — ${slot.location_address}` : ""}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Home visit address */}
        {selected && mode === "home_visit" && (
          <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "1.05rem", color: "#0f172a" }}>Where should they come?</h3>
            <LocationPicker
              label="Visit address"
              required
              initialAddress={address}
              onLocationSelect={(l) => {
                setAddress(l.address);
                setCoords({ lat: l.lat, lng: l.lng });
              }}
            />
          </div>
        )}

        {/* Notes + submit */}
        {selected && (
          <div style={{ background: "white", borderRadius: 12, padding: 20 }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
              Anything the specialist should know (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Symptoms, referring doctor, injury history…"
              style={{ width: "100%", minHeight: 70, padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
            />

            {error && (
              <div role="alert" style={{ marginTop: 12, color: "#b91c1c", fontWeight: 600, fontSize: "0.88rem" }}>
                {error}
              </div>
            )}

            <button
              onClick={book}
              disabled={!canSubmit}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 14,
                borderRadius: 10,
                border: "none",
                background: canSubmit ? "#0f4c81" : "#cbd5e1",
                color: "white",
                fontWeight: 800,
                fontSize: "1rem",
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {submitting
                ? "Booking…"
                : mode === "home_visit"
                ? "Request home visit"
                : "Confirm appointment"}
            </button>
            {mode === "home_visit" && !coords && (
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#64748b" }}>
                Set your visit address above to continue.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TherapyBookingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#64748b" }}>Loading…</div>}>
      <TherapyBookingInner />
    </Suspense>
  );
}
