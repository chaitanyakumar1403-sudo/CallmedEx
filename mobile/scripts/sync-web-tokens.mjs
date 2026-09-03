// mobile/scripts/sync-web-tokens.mjs
// Extracts CSS custom properties from frontend/src/app/styles/foundation.css
// and emits mobile/src/theme/tokens.ts. Run via `npm run tokens:sync`.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §3.13

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, '../../frontend/src/app/styles/foundation.css');
const tsPath  = resolve(__dirname, '../src/theme/tokens.ts');

const css = readFileSync(cssPath, 'utf8');

const colors = {};
const typography = {};
const elevation = {};
const motion = {};

for (const line of css.split('\n')) {
  const m = line.match(/^\s*--cm-([a-z0-9-]+)\s*:\s*([^;]+);/i);
  if (!m) continue;
  const [, rawKey, val] = m;
  const v = val.trim();
  const k = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  if (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl')) {
    colors[k] = v;
  } else if (rawKey.startsWith('font-') || rawKey.startsWith('text-')) {
    typography[k] = v;
  } else if (rawKey.startsWith('shadow-') || rawKey.startsWith('elevation-')) {
    elevation[k] = v;
  } else if (rawKey.startsWith('dur-') || rawKey.startsWith('ease-')) {
    motion[k] = v;
  }
}

const banner = `// AUTO-GENERATED from foundation.css via mobile/scripts/sync-web-tokens.mjs.
// DO NOT EDIT DIRECTLY. Run \`npm run tokens:sync\` in /mobile to regenerate.
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

export const ColorTokens = ${JSON.stringify(colors, null, 2)} as const;
export const TypographyTokens = ${JSON.stringify(typography, null, 2)} as const;
export const ElevationTokens = ${JSON.stringify(elevation, null, 2)} as const;
export const MotionTokens = ${JSON.stringify(motion, null, 2)} as const;
`;

writeFileSync(tsPath, banner, 'utf8');
console.log(`[sync-web-tokens] Emitted ${tsPath} (${Object.keys(colors).length} color tokens synced)`);
