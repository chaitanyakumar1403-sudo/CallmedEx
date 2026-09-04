"use client";

/**
 * CollectionKitWidget — what the collector must physically carry.
 *
 * A collector offered "Complete Blood Count" has to know it is one 3 ml
 * lavender EDTA, not go and look it up. Tubes are grouped by container with
 * their real cap colour, additive and draw volume, and the tests riding in
 * each one; consumables come from the same kit catalogue the stock counter
 * decrements against, so nothing is listed that has no stock line.
 *
 * Everything here comes from /api/phlebo/kit-requirements — there is no
 * fallback tube list. A booking whose tests have no tube mapping says so
 * rather than showing a plausible-looking guess at an additive.
 */

import { useCallback, useEffect, useState } from "react";
import { TestTube, AlertTriangle, Package, CheckCircle2 } from "@/components/ui/icons";
import { Icon } from "@/components/ui";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

interface KitTube {
  tube_type_code: string;
  name: string;
  cap_colour: string;
  additive: string;
  volume_ml: number | null;
  count: number;
  collected: number;
  tests: string[];
}

interface KitData {
  tubes: KitTube[];
  consumables: { code: string; name: string }[];
  total_tubes: number;
  unmapped_sample_count: number;
  note?: string;
}

/** Real cap colours. A tube is identified by its cap on a bench, so the swatch
 *  has to be the actual colour, not a theme accent. */
const CAP_HEX: Record<string, string> = {
  lavender: "#9b59b6",
  gold: "#f39c12",
  yellow: "#f1c40f",
  blue: "#3498db",
  grey: "#95a5a6",
  gray: "#95a5a6",
  red: "#e74c3c",
  green: "#27ae60",
  black: "#2c3e50",
  navy: "#1f3a93",
  white: "#cbd5e1",
};

const capHex = (c: string) => CAP_HEX[(c || "").toLowerCase().trim()] || "#94a3b8";

/** A tube drawn as a tube: coloured cap over a body filled to the draw line. */
function TubeGlyph({ cap, filled }: { cap: string; filled: boolean }) {
  const hex = capHex(cap);
  return (
    <svg width="26" height="52" viewBox="0 0 26 52" aria-hidden="true">
      <rect x="5" y="1" width="16" height="9" rx="2.5" fill={hex} />
      <path
        d="M6 10 h14 v30 a7 7 0 0 1 -14 0 Z"
        fill="rgba(255,255,255,0.55)"
        stroke={hex}
        strokeWidth="1.6"
      />
      {filled && (
        <path
          d="M6.8 26 h12.4 v14 a6.2 6.2 0 0 1 -12.4 0 Z"
          fill={hex}
          opacity="0.42"
        />
      )}
      <rect x="7.5" y="13" width="2.4" height="18" rx="1.2" fill="#fff" opacity="0.6" />
    </svg>
  );
}

export default function CollectionKitWidget({
  bookingId,
  serviceLabel,
}: {
  bookingId: string;
  /** e.g. "Home collection" — what the patient booked, shown as the heading. */
  serviceLabel?: string;
}) {
  const [kit, setKit] = useState<KitData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !bookingId) return;
    try {
      const res = await fetch(
        `${apiBase}/api/phlebo/kit-requirements/${bookingId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        setError("Could not load the kit list for this run.");
        return;
      }
      setKit(await res.json());
      setError("");
    } catch {
      setError("Could not load the kit list for this run.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || (!kit && !error)) return null;

  const tubes = kit?.tubes ?? [];

  return (
    <section className="cm-kit" aria-label="Collection kit for this run">
      <style>{`
        .cm-kit {
          position: relative;
          border-radius: 20px;
          padding: 18px 20px;
          background: linear-gradient(135deg,
            rgba(255,255,255,0.82) 0%,
            rgba(244,247,255,0.62) 100%);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
          border: 1px solid rgba(255,255,255,0.7);
          box-shadow:
            0 8px 32px rgba(15,23,42,0.10),
            inset 0 1px 0 rgba(255,255,255,0.85);
          overflow: hidden;
        }
        /* Soft colour wash so the card reads as glass over something, not a
           flat white panel. Purely decorative, sits behind the content. */
        .cm-kit::before {
          content: "";
          position: absolute;
          inset: -40% -10% auto -10%;
          height: 200px;
          background: radial-gradient(ellipse at 20% 0%,
            rgba(124,58,237,0.20), transparent 62%),
            radial-gradient(ellipse at 80% 10%,
            rgba(14,165,233,0.18), transparent 60%);
          pointer-events: none;
        }
        .cm-kit > * { position: relative; }
        .cm-kit__head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 12px; flex-wrap: wrap; margin-bottom: 14px;
        }
        .cm-kit__title {
          margin: 0; font-size: 0.98rem; font-weight: 800; color: #0f172a;
          display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em;
        }
        .cm-kit__sub { margin: 3px 0 0; font-size: 0.79rem; color: #475569; }
        .cm-kit__count {
          padding: 5px 12px; border-radius: 999px; font-size: 0.74rem;
          font-weight: 800; letter-spacing: 0.02em;
          background: rgba(124,58,237,0.12); color: #6d28d9;
          border: 1px solid rgba(124,58,237,0.25); white-space: nowrap;
        }
        .cm-kit__grid {
          display: grid; gap: 10px;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        }
        .cm-kit__tube {
          display: flex; gap: 12px; align-items: flex-start;
          padding: 12px 14px; border-radius: 14px;
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(226,232,240,0.9);
          box-shadow: 0 2px 10px rgba(15,23,42,0.05);
        }
        .cm-kit__tube--done {
          background: rgba(240,253,244,0.8);
          border-color: rgba(134,239,172,0.9);
        }
        .cm-kit__tname {
          font-weight: 800; font-size: 0.85rem; color: #0f172a;
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }
        .cm-kit__qty {
          font-size: 0.7rem; font-weight: 800; color: #fff;
          background: #0f172a; border-radius: 6px; padding: 1px 7px;
        }
        .cm-kit__meta { font-size: 0.73rem; color: #64748b; margin-top: 3px; }
        .cm-kit__tests {
          display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px;
        }
        .cm-kit__test {
          font-size: 0.68rem; font-weight: 600; color: #1e40af;
          background: rgba(219,234,254,0.75);
          border: 1px solid rgba(191,219,254,0.9);
          border-radius: 999px; padding: 2px 8px;
        }
        .cm-kit__consumables {
          margin-top: 14px; padding-top: 12px;
          border-top: 1px dashed rgba(148,163,184,0.45);
        }
        .cm-kit__clabel {
          font-size: 0.72rem; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.06em; color: #64748b;
          display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
        }
        .cm-kit__chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .cm-kit__chip {
          font-size: 0.72rem; font-weight: 600; color: #334155;
          background: rgba(255,255,255,0.8);
          border: 1px solid rgba(203,213,225,0.9);
          border-radius: 999px; padding: 4px 11px;
        }
        .cm-kit__warn {
          margin-top: 12px; padding: 9px 12px; border-radius: 10px;
          font-size: 0.76rem; font-weight: 600;
          background: rgba(254,243,199,0.75); color: #92400e;
          border: 1px solid rgba(252,211,77,0.9);
          display: flex; align-items: center; gap: 7px;
        }
        @media (prefers-reduced-transparency: reduce) {
          .cm-kit { backdrop-filter: none; -webkit-backdrop-filter: none;
                    background: #f8fafc; }
        }
      `}</style>

      <div className="cm-kit__head">
        <div>
          <h3 className="cm-kit__title">
            <Icon as={TestTube} size={16} />
            Collection kit for this run
          </h3>
          <p className="cm-kit__sub">
            {serviceLabel
              ? `Patient booked: ${serviceLabel}`
              : "Carry these before you leave."}
          </p>
        </div>
        {tubes.length > 0 && (
          <span className="cm-kit__count">
            {kit?.total_tubes} tube{kit?.total_tubes === 1 ? "" : "s"} ·{" "}
            {tubes.length} type{tubes.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && (
        <div className="cm-kit__warn">
          <Icon as={AlertTriangle} size={14} />
          {error}
        </div>
      )}

      {!error && tubes.length === 0 && (
        <div className="cm-kit__warn">
          <Icon as={AlertTriangle} size={14} />
          {kit?.note ||
            "No tubes are listed for this booking. Call your centre before collecting."}
        </div>
      )}

      {tubes.length > 0 && (
        <div className="cm-kit__grid">
          {tubes.map((t) => {
            const done = t.collected >= t.count;
            return (
              <div
                key={t.tube_type_code}
                className={`cm-kit__tube${done ? " cm-kit__tube--done" : ""}`}
              >
                <TubeGlyph cap={t.cap_colour} filled={done} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="cm-kit__tname">
                    {t.name}
                    <span className="cm-kit__qty">×{t.count}</span>
                    {done && <Icon as={CheckCircle2} size={14} />}
                  </div>
                  <div className="cm-kit__meta">
                    {[t.additive, t.volume_ml ? `${t.volume_ml} ml draw` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {t.tests.length > 0 && (
                    <div className="cm-kit__tests">
                      {t.tests.map((name) => (
                        <span key={name} className="cm-kit__test">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(kit?.consumables?.length ?? 0) > 0 && (
        <div className="cm-kit__consumables">
          <div className="cm-kit__clabel">
            <Icon as={Package} size={14} /> Also carry
          </div>
          <div className="cm-kit__chips">
            {kit!.consumables.map((c) => (
              <span key={c.code} className="cm-kit__chip">
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {(kit?.unmapped_sample_count ?? 0) > 0 && (
        <div className="cm-kit__warn">
          <Icon as={AlertTriangle} size={14} />
          {kit!.unmapped_sample_count} sample
          {kit!.unmapped_sample_count === 1 ? " has" : "s have"} no tube type on
          file — confirm the container with your centre before drawing.
        </div>
      )}
    </section>
  );
}
