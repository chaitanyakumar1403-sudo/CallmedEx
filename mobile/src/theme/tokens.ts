// AUTO-GENERATED from foundation.css via mobile/scripts/sync-web-tokens.mjs.
// DO NOT EDIT DIRECTLY. Run `npm run tokens:sync` in /mobile to regenerate.
// Liquid Health design system contract (§3.7)

export const GlassTokens = {
  G1: { fill: 'rgba(255,255,255,0.06)', blur: 0,  stroke: 'rgba(255,255,255,0.12)', specular: 'rgba(255,255,255,0.18)' },
  G2: { fill: 'rgba(255,255,255,0.09)', blur: 16, stroke: 'rgba(255,255,255,0.18)', specular: 'rgba(255,255,255,0.26)' },
  G3: { fill: 'rgba(255,255,255,0.14)', blur: 24, stroke: 'rgba(255,255,255,0.24)', specular: 'rgba(255,255,255,0.32)' },
  G4: { fill: '#132032',                 blur: 0,  stroke: 'rgba(255,255,255,0.16)', specular: 'rgba(255,255,255,0.12)' },
} as const;

export type GlassTier = keyof typeof GlassTokens;

export const RoleAccents = {
  patient:           { primary: '#0284c7', glow: 'rgba(2,132,199,0.35)',   name: 'Sky' },
  phlebotomist:      { primary: '#d97706', glow: 'rgba(217,119,6,0.35)',   name: 'Amber' },
  processingCenter:  { primary: '#059669', glow: 'rgba(5,150,105,0.35)',  name: 'Emerald' },
  deliveryRider:     { primary: '#7c3aed', glow: 'rgba(124,58,237,0.35)',  name: 'Violet' },
  doctor:            { primary: '#2563eb', glow: 'rgba(37,99,235,0.35)',   name: 'Cobalt' },
  nurse:             { primary: '#db2777', glow: 'rgba(219,39,119,0.35)',  name: 'Pink' },
  physiotherapist:   { primary: '#0d9488', glow: 'rgba(13,148,136,0.35)',  name: 'Teal' },
  pharmacy:          { primary: '#16a34a', glow: 'rgba(22,163,74,0.35)',   name: 'Green' },
  hospital:          { primary: '#dc2626', glow: 'rgba(220,38,38,0.35)',   name: 'Red' },
  supervisor:        { primary: '#475569', glow: 'rgba(71,85,105,0.35)',   name: 'Slate' },
} as const;

export type RoleName = keyof typeof RoleAccents;

export const ColorTokens = {
  "navy": "#1a2b4a",
  "navyDeep": "#0f1d33",
  "navySoft": "#2a3d5e",
  "urgent": "#d92020",
  "urgentBg": "#fef2f2",
  "urgentLine": "#fca5a5",
  "active": "#0369a1",
  "activeBg": "#eff6ff",
  "activeLine": "#93c5fd",
  "done": "#15803d",
  "doneBg": "#f0fdf4",
  "doneLine": "#86efac",
  "waiting": "#b45309",
  "waitingBg": "#fffbeb",
  "waitingLine": "#fcd34d",
  "halted": "#57534e",
  "haltedBg": "#fafaf9",
  "haltedLine": "#d6d3d1",
  "ink": "#0f172a",
  "ink-2": "#334155",
  "ink-3": "#475569",
  "inkFaint": "#64748b",
  "line": "#94a3b8",
  "lineStrong": "#cbd5e1",
  "surface": "#ffffff",
  "surface-2": "#f8fafc",
  "surface-3": "#f1f5f9"
} as const;
export const TypographyTokens = {
  "fontUi": "var(--font-ui, 'Inter', system-ui, sans-serif)",
  "fontTe": "var(--font-te, 'Noto Sans Telugu', sans-serif)",
  "textXs": "0.75rem",
  "textSm": "0.875rem",
  "textBase": "1rem",
  "textLg": "1.125rem",
  "textXl": "1.375rem",
  "text-2xl": "1.75rem",
  "text-3xl": "2.25rem"
} as const;
export const ElevationTokens = {
  "shadow-1": "0 1px 2px rgba(15, 23, 42, 0.06)",
  "shadow-2": "0 2px 8px rgba(15, 23, 42, 0.08)",
  "shadow-3": "0 8px 24px rgba(15, 23, 42, 0.12)"
} as const;
export const MotionTokens = {} as const;
