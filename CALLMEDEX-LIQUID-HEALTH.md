# CallMedex — Liquid Health
### Single-file build spec: design system, mobile rebuild, web parity, and the patient feature program
**v2.0 · 21 Aug 2026 · supersedes the split plan**

---

## 0. How to read this

This document is the whole job in one file. Every code block marked `FILE:` is a real file — create it at that exact path and paste the block verbatim. Everything else is decision, spec, or sequencing.

Three parts:

- **§1–§7** — the rebuild: platform unblock → design system → shell → parity → widgets → maps.
- **§8–§10** — the feature program: ten patient-facing features nobody in Indian healthtech ships, sized against what CallMedex *already* has in the database. Most need a few dozen lines of backend.
- **§11–§14** — guardrails, roadmap, risks, checklists.

Read §1 before touching anything. The sequencing is the plan; the code is the easy part.

---

## 1. Verdict and sequencing

Two separate problems, and the order is not negotiable:

1. **The app physically cannot render this design on Expo SDK 52.** Native Liquid Glass and stable Android blur don't exist there. Platform first.
2. **The mobile app was built screen-by-screen with no shared widget layer.** That is why the dashboards feel templated, why tracking looks copy-pasted across roles, and why parity keeps slipping. Fix the layer, not the screens.

Do **not** start redesigning screens. Build tokens plus primitives once — about a week and a half — after which every screen is a mechanical rewrite and every missing feature is a compose-from-parts job.

```
Week 1   Phase 0  platform unblock
Week 2   Phase 1  design system foundation
Week 3   Phase 2  shell, tab bar, Omnibar
Week 4   Phase 4  widget kit (10 primitives, mock data)
Week 5   Patient P0 parity + maps
Week 6   Phlebotomist P0 parity + attendance gate
Week 7   Processing Center + Supervisor (new groups)
Week 8   Admin / Pharmacy / Org / Doctor P1 + audits
Week 9+  The Ten (§8), shipped one per sprint, web and app together
```

Phases 0–3 are a single sequential spine and should be one person's work. Phase 4 onward parallelises cleanly.

---

## 2. Phase 0 — Platform unblock (2–3 days)

`mobile/package.json` is on Expo SDK 52 / RN 0.76. Target the current SDK (56+).

```bash
cd mobile
npx expo install expo@latest --fix
npx expo install --fix
npx expo-doctor
npx expo prebuild --clean
```

Four migrations that will break the build if skipped:

| Issue | Why | Fix |
|---|---|---|
| `expo-barcode-scanner` | Deprecated and removed; used in `(phlebotomist)/scanner.tsx` | `expo-camera` → `<CameraView barcodeScannerSettings={{ barcodeTypes: ['code128','qr','ean13'] }} onBarcodeScanned={…} />` |
| `experimentalBlurMethod` | Renamed to `blurMethod` in SDK 55; Android blur now needs `<BlurTargetView>` + a `blurTarget` ref | Handled by `Glass.tsx` + `AppShell.tsx` below |
| `FCM_SERVER_KEY` | Legacy FCM keys are dead; Expo push needs FCM v1 | Upload the FCM v1 service-account JSON to EAS, drop the env var |
| React Native `<Modal>` | Android `BlurView` cannot blur across a Modal's native window (expo #44165) | Use expo-router `presentation: 'modal'` or `@gorhom/bottom-sheet` for every glass overlay |

Dependencies:

```bash
npx expo install expo-glass-effect expo-blur expo-haptics expo-font expo-speech \
  expo-notifications expo-camera expo-secure-store expo-local-authentication \
  @shopify/react-native-skia react-native-reanimated react-native-gesture-handler \
  react-native-svg @gorhom/bottom-sheet @maplibre/maplibre-react-native \
  @pchmn/expo-material3-theme react-native-qrcode-svg \
  @expo-google-fonts/inter @expo-google-fonts/inter-tight
```

**Done when:** the app boots on an iOS 26 device, an Android 14 device and an Android 11 device, and `npx expo-doctor` is clean.

---

## 3. Phase 1 — Design system foundation (4–5 days)

### 3.1 Colors come from the web app, not from a guess

`scripts/sync-web-tokens.mjs` (§3.9) reads `frontend/src/app/globals.css` and `frontend/tailwind.config.*`, converts hsl/rgb to hex, and rewrites the `brand` block in `tokens.ts`. Run it before trusting any value in this document, and wire `--check` into CI so a web palette change can never silently skip mobile.

### 3.2 The four glass tiers — this is the entire system

| Tier | Where | Renderer | Rule |
|---|---|---|---|
| **G1 `card`** | Content cards, list rows | Translucent fill, **no blur** | Unlimited; safe inside FlatList |
| **G2 `chrome`** | Tab bar, Omnibar, sticky header | Real blur / GlassView | **Max 2 visible at once** |
| **G3 `overlay`** | Bottom sheets, dialogs | Heaviest blur | **One at a time** |
| **G4 `clinical`** | Lab values, doses, barcodes, verification decisions | **Opaque, always** | Never transparent, on any platform |

G4 is not a style preference. Glassmorphism has a documented legibility cost, and this is a product where a misread decimal is a clinical incident. Aurora and glass carry navigation, chrome and delight; the moment a number carries medical meaning it sits on a solid card. Apple says the same about Liquid Glass — chrome, not content.

### 3.3 The renderer ladder

`Glass.tsx` picks automatically so no screen ever branches on platform:

1. **iOS 26+** → `expo-glass-effect` `<GlassView>` (real `UIGlassEffect`), guarded by `isLiquidGlassAvailable()` — some iOS 26 builds ship without the API and crash without the check.
2. **iOS < 26, Android 12+** → `expo-blur` `<BlurView>` with `blurMethod="dimezisBlurViewSdk31Plus"` pointed at the shell's `<BlurTargetView>`.
3. **Android 11 and below, reduce-transparency on, low-tier device** → tinted opaque view, zero GPU cost.

Tier 3 matters more than it looks. A large share of your Vizag base is on sub-₹15k Android, where the pre-Android-12 RenderScript blur path visibly tanks scroll performance. `dimezisBlurViewSdk31Plus` falls back to `none` there by design — take the fallback, don't fight it.

### 3.4 Material You, seeded from CallMedex — not from wallpaper

`@pchmn/expo-material3-theme` can pull wallpaper colors, but a healthcare brand should not repaint itself pink because of someone's lock screen. Generate the M3 tonal palette from `brand.primary` as the seed; use wallpaper harmonisation only for neutral surfaces behind an opt-in "Match my theme" toggle in Settings. On iOS, `GlassView` inherits system materials automatically.

### 3.5 Typography

Ship the fonts, don't inherit them — OEM Android skins substitute system fonts and layouts shift.

- **Display / titles:** Inter Tight SemiBold — geometric, tight tracking, the closest free analogue to Google Sans.
- **Body:** Inter Regular / Medium.
- **Data:** Inter Medium with `fontVariant: ['tabular-nums']`. Mandatory for vitals, doses, prices, barcodes, timers. Non-tabular digits make a live ETA jitter sideways.

### 3.6 Role-tinted shell

Ten dashboards, one shell. `roleAccent` tints exactly two things: the aurora's primary blob and the active glass border. Everything else is identical across roles. That is what makes it feel like one product instead of ten.

---

### 3.7 FILE: `mobile/src/theme/tokens.ts`

```ts
/**
 * CallMedex Mobile — Design Tokens
 * Single source of truth for the "Liquid Health" design language.
 *
 * DO NOT hand-edit `brand` below. Run:
 *    node mobile/scripts/sync-web-tokens.mjs
 * which reads frontend/src/app/globals.css + tailwind.config.* and rewrites
 * the BRAND block so web and mobile can never drift apart.
 */

// ─────────────────────────────────────────────────────────────
// BRAND (auto-generated block — placeholder values until sync runs)
// ─────────────────────────────────────────────────────────────
export const brand = {
  primary: '#0B6FD1',      // CallMedex action blue
  primaryDeep: '#064B8F',
  primarySoft: '#3D9BFF',
  teal: '#12B5A6',         // diagnostics / sample lifecycle
  violet: '#7C5CFF',       // AI surfaces (report analysis, voice intake)
  coral: '#FF6B6B',        // emergency / SOS
  amber: '#F5A524',        // warnings, pending states
  ink: '#0A1020',          // darkest surface
  inkSoft: '#131B2E',
} as const;

// ─────────────────────────────────────────────────────────────
// SEMANTIC — clinical meaning. Never reuse brand colors for these.
// ─────────────────────────────────────────────────────────────
export const semantic = {
  normal: '#1FBF75',
  low: '#3D9BFF',
  high: '#F5A524',
  critical: '#FF4D4F',
  rejected: '#FF4D4F',
  verified: '#1FBF75',
  inTransit: '#7C5CFF',
  pending: '#8A93A6',
} as const;

/**
 * ROLE ACCENTS — the reason 10 dashboards can share one shell.
 * Each role tints the aurora backdrop and the glass border, nothing else.
 */
export const roleAccent = {
  patient: brand.primary,
  doctor: '#2E7DF7',
  phlebotomist: brand.teal,
  processing_center: '#00A3A3',
  pharmacy: '#22A45D',
  organization: '#5B6BFF',
  nurse: '#E0629B',
  staff: '#6C7A93',
  admin: '#8A5CF6',
  supervisor: '#F5A524',
} as const;

export type Role = keyof typeof roleAccent;

// ─────────────────────────────────────────────────────────────
// GLASS TIERS — the whole design system is these four rules.
// ─────────────────────────────────────────────────────────────
export const glass = {
  /** G1 — content cards. NEVER blurred. Translucent fill only. Safe inside lists. */
  card: {
    blur: 0,
    fillDark: 'rgba(255,255,255,0.06)',
    fillLight: 'rgba(255,255,255,0.60)',
    borderDark: 'rgba(255,255,255,0.12)',
    borderLight: 'rgba(255,255,255,0.75)',
  },
  /** G2 — floating chrome: tab bar, omnibar, sticky headers. Real blur. Max 2 on screen. */
  chrome: {
    blur: 40,
    fillDark: 'rgba(18,24,40,0.55)',
    fillLight: 'rgba(255,255,255,0.55)',
    borderDark: 'rgba(255,255,255,0.18)',
    borderLight: 'rgba(255,255,255,0.85)',
  },
  /** G3 — overlays: bottom sheets, modals, dialogs. Heaviest blur, one at a time. */
  overlay: {
    blur: 70,
    fillDark: 'rgba(10,16,32,0.72)',
    fillLight: 'rgba(255,255,255,0.72)',
    borderDark: 'rgba(255,255,255,0.20)',
    borderLight: 'rgba(255,255,255,0.90)',
  },
  /** G4 — CLINICAL. Opaque by mandate. Any surface showing a lab value, dose,
   *  barcode, or verification decision must use this. No transparency, ever. */
  clinical: {
    blur: 0,
    fillDark: '#151D30',
    fillLight: '#FFFFFF',
    borderDark: 'rgba(255,255,255,0.10)',
    borderLight: 'rgba(10,16,32,0.10)',
  },
} as const;

export type GlassTier = keyof typeof glass;

export const radius = {
  pill: 999, chip: 14, card: 24, sheet: 32, screen: 28,
} as const;

export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 20,
} as const;

/**
 * TYPE — geometric sans for scannability across dense clinical data.
 * Ship the variable fonts with expo-font; OEM Android skins substitute
 * system fonts and will shift your layouts.
 */
export const type = {
  display: 'InterTight_600SemiBold',
  title: 'InterTight_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  /** Tabular numerals — mandatory for vitals, doses, prices, barcodes. */
  data: 'Inter_500Medium',
  scale: {
    hero: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
    h1: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
    h2: { fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
    body: { fontSize: 15, lineHeight: 22 },
    caption: { fontSize: 13, lineHeight: 18 },
    micro: { fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
    metric: { fontSize: 28, lineHeight: 32, letterSpacing: -0.5, fontVariant: ['tabular-nums'] as const },
  },
} as const;

export const motion = {
  /** Fast in, soft settle. Use withSpring for anything the finger touched. */
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  fast: 160,
  base: 240,
  slow: 420,
  /** Aurora drift — one full cycle. Long enough to never read as a loop. */
  aurora: 18000,
} as const;

export const elevation = {
  chrome: {
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  card: {
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
} as const;

/** Minimum contrast the text-over-glass audit enforces (WCAG AA body text). */
export const A11Y_MIN_CONTRAST = 4.5;

/** Shared alpha helper — used by every glass surface and Skia layer. */
export function hexA(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
```

---

### 3.8 FILE: `mobile/src/theme/GlassProvider.tsx`

```tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View, useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { roleAccent, type Role } from './tokens';

/**
 * Android SDK 55+ requires BlurView to point at a <BlurTargetView> ref — it can
 * only blur content rendered INSIDE that target. We mount exactly one target
 * around the aurora backdrop and hand the ref down through context.
 *
 * Known limitation (expo #44165): a BlurView inside a React Native <Modal>
 * cannot reach a target outside it. Use expo-router modal presentation or
 * @gorhom/bottom-sheet for overlays — never RN's <Modal> for glass surfaces.
 */
type GlassContextValue = {
  blurTarget: React.RefObject<View | null>;
  scheme: 'light' | 'dark';
  role: Role;
  accent: string;
  /** True when blur must be skipped entirely: reduce-transparency, or low-tier device. */
  degradeGlass: boolean;
  reduceMotion: boolean;
};

const GlassContext = createContext<GlassContextValue | null>(null);

export function useGlass() {
  const ctx = useContext(GlassContext);
  if (!ctx) throw new Error('useGlass must be used inside <GlassProvider>');
  return ctx;
}

export function GlassProvider({
  children,
  role = 'patient',
  lowTierDevice = false,
}: {
  children: React.ReactNode;
  role?: Role;
  /** Set from a device-tier probe at boot (§11.2). Android 11 and below → true. */
  lowTierDevice?: boolean;
}) {
  const blurTarget = useRef<View | null>(null);
  const scheme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  const reduceMotion = useReducedMotion();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let alive = true;
    if (Platform.OS === 'ios') {
      AccessibilityInfo.isReduceTransparencyEnabled().then((v) => alive && setReduceTransparency(v));
      const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
      return () => { alive = false; sub.remove(); };
    }
    return () => { alive = false; };
  }, []);

  const value = useMemo<GlassContextValue>(
    () => ({
      blurTarget,
      scheme,
      role,
      accent: roleAccent[role],
      degradeGlass: reduceTransparency || lowTierDevice,
      reduceMotion,
    }),
    [scheme, role, reduceTransparency, lowTierDevice, reduceMotion],
  );

  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}
```

---

### 3.9 FILE: `mobile/src/components/glass/Glass.tsx`

```tsx
import React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useGlass } from '../../theme/GlassProvider';
import { glass, radius as R, elevation, hexA, type GlassTier } from '../../theme/tokens';

/**
 * ONE primitive for every translucent surface in the app. Every screen uses
 * this and nothing else — no ad-hoc BlurView, no hand-rolled rgba cards.
 *
 * Renderer ladder (first that applies wins):
 *   1. iOS 26+               → expo-glass-effect GlassView (real UIGlassEffect)
 *   2. iOS <26 / Android 12+ → expo-blur BlurView against the shell's BlurTargetView
 *   3. everything else       → tinted translucent View (no GPU cost)
 *
 * tier="clinical" always renders opaque, on every platform, by design.
 */
export type GlassProps = ViewProps & {
  tier?: GlassTier;
  radius?: number;
  /** Tints the glass with the active role accent. Active/selected surface only. */
  accented?: boolean;
  /** The light-catching micro-border. On by default — it's what sells the material. */
  border?: boolean;
  /** iOS 26 only: system interactive glass response to touch. */
  interactive?: boolean;
};

export function Glass({
  tier = 'card', radius, accented = false, border = true,
  interactive = false, style, children, ...rest
}: GlassProps) {
  const { scheme, accent, blurTarget, degradeGlass } = useGlass();
  const t = glass[tier];
  const dark = scheme === 'dark';
  const r = radius ?? (tier === 'overlay' ? R.sheet : tier === 'chrome' ? R.pill : R.card);

  const shell = [
    styles.base,
    { borderRadius: r },
    border && {
      borderWidth: StyleSheet.hairlineWidth * 1.5,
      borderColor: accented ? hexA(accent, 0.55) : dark ? t.borderDark : t.borderLight,
    },
    tier === 'chrome' || tier === 'overlay' ? elevation.chrome : elevation.card,
    style,
  ];

  const fill = dark ? t.fillDark : t.fillLight;
  const tint = accented ? hexA(accent, dark ? 0.16 : 0.10) : 'transparent';

  // 3 — no blur: clinical surfaces, reduce-transparency, low-tier Android.
  if (t.blur === 0 || degradeGlass) {
    const opaqueFill = tier === 'clinical' ? fill : degradeGlass ? (dark ? '#151D30' : '#FFFFFF') : fill;
    return (
      <View style={[...shell, { backgroundColor: opaqueFill }]} {...rest}>
        {accented && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, borderRadius: r }]} />}
        {children}
      </View>
    );
  }

  // 1 — iOS 26 native Liquid Glass.
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView
        style={[...shell, styles.clip]}
        glassEffectStyle={tier === 'overlay' ? 'regular' : 'clear'}
        isInteractive={interactive}
        tintColor={accented ? hexA(accent, 0.18) : undefined}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  // 2 — BlurView. Android needs blurTarget + the SDK31+ method so Android 11
  //     and below fall back to a cheap tint instead of RenderScript jank.
  return (
    <View style={[...shell, styles.clip]} {...rest}>
      <BlurView
        style={StyleSheet.absoluteFill}
        intensity={t.blur}
        tint={dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
        blurReductionFactor={4}
        {...(Platform.OS === 'android'
          ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const, blurTarget }
          : null)}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      {accented && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />}
      {children}
    </View>
  );
}

/** Groups adjacent glass elements so iOS 26 merges them when they get close. */
export function GlassGroup({
  children, spacing = 12, style,
}: { children: React.ReactNode; spacing?: number; style?: ViewProps['style'] }) {
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    const { GlassContainer } = require('expo-glass-effect');
    return <GlassContainer spacing={spacing} style={style}>{children}</GlassContainer>;
  }
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' }, // required: borderRadius is not applied to BlurView directly
  clip: { overflow: 'hidden' },
});
```

---

### 3.10 FILE: `mobile/src/components/glass/AuroraBackdrop.tsx`

```tsx
import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Blur, Canvas, Circle, Fill, Group, Paint } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useGlass } from '../../theme/GlassProvider';
import { brand, hexA, motion } from '../../theme/tokens';

/**
 * Layer 0 of the three-layer stack: slow-drifting colour blobs, heavily blurred
 * on the GPU. Everything else in the app floats above this.
 *
 * Cost: one Skia canvas, four circles, one blur layer — driven entirely by
 * Reanimated shared values on the UI thread, zero JS per frame.
 *
 * reduceMotion  → blobs freeze at their mid positions.
 * degradeGlass  → the canvas collapses to a flat colour.
 *
 * `tint` lets Health Weather (§9.4) recolour the backdrop from clinical status.
 */
export function AuroraBackdrop({ accent, intensity = 1 }: { accent?: string; intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const { scheme, reduceMotion, degradeGlass, accent: roleColor } = useGlass();
  const dark = scheme === 'dark';
  const a = accent ?? roleColor;

  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || degradeGlass) { t.value = 0.5; return; }
    t.value = withRepeat(
      withTiming(1, { duration: motion.aurora, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [reduceMotion, degradeGlass, t]);

  const base = dark ? brand.ink : '#F2F6FF';
  const r = Math.max(width, height) * 0.55;

  const b1x = useDerivedValue(() => width * (0.18 + 0.22 * t.value));
  const b1y = useDerivedValue(() => height * (0.12 + 0.10 * t.value));
  const b2x = useDerivedValue(() => width * (0.92 - 0.28 * t.value));
  const b2y = useDerivedValue(() => height * (0.30 + 0.16 * t.value));
  const b3x = useDerivedValue(() => width * (0.28 + 0.34 * t.value));
  const b3y = useDerivedValue(() => height * (0.86 - 0.14 * t.value));
  const b4x = useDerivedValue(() => width * (0.70 - 0.20 * t.value));
  const b4y = useDerivedValue(() => height * (0.62 + 0.12 * t.value));

  if (degradeGlass) {
    return <Canvas style={StyleSheet.absoluteFill}><Fill color={base} /></Canvas>;
  }

  const alpha = (dark ? 0.55 : 0.42) * intensity;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Fill color={base} />
      <Group layer={<Paint><Blur blur={110} /></Paint>}>
        <Circle cx={b1x} cy={b1y} r={r} color={hexA(a, alpha)} />
        <Circle cx={b2x} cy={b2y} r={r * 0.9} color={hexA(brand.violet, alpha * 0.8)} />
        <Circle cx={b3x} cy={b3y} r={r * 1.05} color={hexA(brand.teal, alpha * 0.7)} />
        <Circle cx={b4x} cy={b4y} r={r * 0.75} color={hexA(brand.primarySoft, alpha * 0.6)} />
      </Group>
    </Canvas>
  );
}
```

---

### 3.11 FILE: `mobile/src/components/glass/AppShell.tsx`

```tsx
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlass } from '../../theme/GlassProvider';
import { AuroraBackdrop } from './AuroraBackdrop';

/**
 * Wrap every screen in this. It establishes the three layers:
 *
 *   L0  aurora backdrop  ← inside BlurTargetView so Android BlurView can sample it
 *   L1  screen content   ← glass cards, lists
 *   L2  floating chrome  ← tab bar, Omnibar (rendered by the layout, above children)
 *
 * On Android, BlurView only blurs what lives inside BlurTargetView. That is
 * intentional: we blur the aurora, not the scrolling content — both correct
 * looking and an order of magnitude cheaper.
 */
export function AppShell({
  children,
  tint,
  edges = ['top'],
}: {
  children: React.ReactNode;
  /** Health Weather override for the aurora (§9.4). */
  tint?: string;
  edges?: ReadonlyArray<'top' | 'bottom' | 'left' | 'right'>;
}) {
  const { blurTarget } = useGlass();

  const backdrop =
    Platform.OS === 'android' ? (
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill} pointerEvents="none">
        <AuroraBackdrop accent={tint} />
      </BlurTargetView>
    ) : (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AuroraBackdrop accent={tint} />
      </View>
    );

  return (
    <View style={styles.root}>
      {backdrop}
      <SafeAreaView style={styles.content} edges={edges as any}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
```

---

### 3.12 FILE: `mobile/src/components/glass/GlassTabBar.tsx`

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useGlass } from '../../theme/GlassProvider';
import { Glass } from './Glass';
import { hexA, motion, radius, space, type as T } from '../../theme/tokens';

/**
 * Floating capsule tab bar. Detached from the screen edge — the aurora runs
 * underneath it, which is what makes the glass read as glass.
 *
 * Usage in a role layout:
 *   <Tabs tabBar={(p) => <GlassTabBar {...p} />} screenOptions={{ headerShown: false }}>
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { accent, scheme } = useGlass();
  const dark = scheme === 'dark';

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]} pointerEvents="box-none">
      <Glass tier="chrome" radius={radius.pill} style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = (options.tabBarLabel ?? options.title ?? route.name) as string;

          const onPress = () => {
            Haptics.selectionAsync();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              accent={accent}
              dark={dark}
              label={label}
              icon={options.tabBarIcon?.({
                focused,
                color: focused ? accent : dark ? '#9AA6BF' : '#5A667F',
                size: 22,
              })}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </Glass>
    </View>
  );
}

function TabItem({
  focused, accent, dark, label, icon, onPress, onLongPress,
}: {
  focused: boolean; accent: string; dark: boolean; label: string;
  icon: React.ReactNode; onPress: () => void; onLongPress: () => void;
}) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      hitSlop={8}
      onPressIn={() => (press.value = withSpring(0.92, motion.spring))}
      onPressOut={() => (press.value = withSpring(1, motion.spring))}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
    >
      <Animated.View style={[styles.itemInner, style]}>
        {focused && <View style={[styles.activePill, { backgroundColor: hexA(accent, dark ? 0.22 : 0.14) }]} />}
        {icon}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: focused ? accent : dark ? '#9AA6BF' : '#5A667F', fontFamily: focused ? T.bodyMedium : T.body },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter },
  bar: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: space.sm },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInner: {
    alignItems: 'center', justifyContent: 'center', gap: 3,
    paddingVertical: 6, paddingHorizontal: 4, minHeight: 48,
  },
  activePill: { ...StyleSheet.absoluteFillObject, borderRadius: radius.pill },
  label: { ...T.scale.micro },
});
```

---

### 3.13 FILE: `mobile/scripts/sync-web-tokens.mjs`

```js
#!/usr/bin/env node
/**
 * sync-web-tokens.mjs
 * Reads the CallMedex web design tokens and rewrites the BRAND block in
 * mobile/src/theme/tokens.ts. Run from the repo root:
 *
 *   node mobile/scripts/sync-web-tokens.mjs
 *   node mobile/scripts/sync-web-tokens.mjs --check   # CI mode: fail if drifted
 *
 * Sources, in priority order:
 *   1. frontend/src/app/globals.css          → CSS custom properties
 *   2. frontend/tailwind.config.{ts,js,mjs}  → theme.extend.colors
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CSS = path.join(ROOT, 'frontend/src/app/globals.css');
const TW = ['ts', 'js', 'mjs', 'cjs']
  .map((e) => path.join(ROOT, `frontend/tailwind.config.${e}`))
  .find(fs.existsSync);
const OUT = path.join(ROOT, 'mobile/src/theme/tokens.ts');
const CHECK = process.argv.includes('--check');

/** Map web token names → mobile brand keys. Extend as your palette grows. */
const MAP = {
  primary: ['--brand-primary', '--primary', '--color-primary', 'primary'],
  primaryDeep: ['--brand-primary-dark', '--primary-dark', '--primary-700', 'primaryDark'],
  primarySoft: ['--brand-primary-light', '--primary-light', '--primary-300', 'primaryLight'],
  teal: ['--brand-teal', '--accent-teal', '--secondary', 'teal'],
  violet: ['--brand-violet', '--accent-ai', '--accent', 'violet'],
  coral: ['--brand-danger', '--destructive', '--danger', 'danger'],
  amber: ['--brand-warning', '--warning', 'warning'],
  ink: ['--background-dark', '--ink', '--foreground', 'ink'],
  inkSoft: ['--surface-dark', '--ink-soft', '--muted', 'inkSoft'],
};

const found = {};

// 1. CSS custom properties
if (fs.existsSync(CSS)) {
  const css = fs.readFileSync(CSS, 'utf8');
  for (const [key, names] of Object.entries(MAP)) {
    for (const n of names) {
      if (!n.startsWith('--')) continue;
      const m = css.match(new RegExp(`${n}\\s*:\\s*([^;]+);`));
      if (m) { const v = normalize(m[1].trim()); if (v) { found[key] = v; break; } }
    }
  }
} else { warn(`globals.css not found at ${CSS}`); }

// 2. tailwind.config theme.extend.colors
if (TW) {
  const tw = fs.readFileSync(TW, 'utf8');
  for (const [key, names] of Object.entries(MAP)) {
    if (found[key]) continue;
    for (const n of names) {
      if (n.startsWith('--')) continue;
      const m = tw.match(new RegExp(`['"\`]?${n}['"\`]?\\s*:\\s*['"\`](#[0-9a-fA-F]{3,8})['"\`]`));
      if (m) { found[key] = m[1].toUpperCase(); break; }
    }
  }
} else { warn('tailwind.config not found — relying on globals.css only'); }

if (!Object.keys(found).length) {
  fail('No brand tokens extracted. Check MAP names against your actual CSS variables.');
}

// 3. Rewrite the BRAND block
const src = fs.readFileSync(OUT, 'utf8');
const current = src.match(/export const brand = \{[\s\S]*?\} as const;/);
if (!current) fail('Could not locate the `export const brand` block in tokens.ts');

const existing = Object.fromEntries(
  [...current[0].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{3,8})'/g)].map((m) => [m[1], m[2].toUpperCase()]),
);
const merged = { ...existing, ...found };
const block =
  'export const brand = {\n' +
  Object.entries(merged).map(([k, v]) => `  ${k}: '${v}',`).join('\n') +
  '\n} as const;';

if (block === current[0]) { console.log('✓ mobile tokens already match the web palette'); process.exit(0); }

if (CHECK) {
  console.error('✗ Mobile brand tokens have drifted from the web palette.');
  console.error('  Run: node mobile/scripts/sync-web-tokens.mjs');
  for (const [k, v] of Object.entries(merged)) {
    if (existing[k] !== v) console.error(`    ${k}: ${existing[k] ?? '—'} → ${v}`);
  }
  process.exit(1);
}

fs.writeFileSync(OUT, src.replace(current[0], block));
console.log('✓ wrote brand tokens to mobile/src/theme/tokens.ts');
for (const [k, v] of Object.entries(merged)) {
  console.log(`    ${k.padEnd(12)} ${v}${existing[k] !== v ? '  (updated)' : ''}`);
}

function normalize(v) {
  if (v.startsWith('#')) return v.toUpperCase();
  const hsl = v.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (hsl) return hslToHex(+hsl[1], +hsl[2], +hsl[3]);
  const rgb = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return null;
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function warn(m) { console.warn(`  ! ${m}`); }
function fail(m) { console.error(`✗ ${m}`); process.exit(1); }
```

**Phase 1 done when:** a scratch screen renders `AppShell` + three `Glass` cards + `GlassTabBar` at a locked 60fps on your worst Android test device, and turning on reduce-transparency produces a clean opaque app.

---

## 4. Phase 2 — Shell, navigation and the Omnibar (3 days)

```
mobile/app/_layout.tsx
  └── GlassProvider (role from auth store, lowTierDevice from boot probe)
        └── Stack / role group
              └── AppShell            L0 aurora inside BlurTargetView
                    └── <Slot />      L1 content
              └── Omnibar             L2 floating glass pill
              └── GlassTabBar         L2 floating capsule tab bar
```

### 4.1 The Omnibar is the signature element

The Gemini floating input pill, repurposed for what CallMedex actually does. One glass capsule pinned above the tab bar, with three states:

| State | Looks like | Does |
|---|---|---|
| **Idle** | Pill: "Ask or book — try *CBC for amma tomorrow*" + mic | Type or speak → `POST /api/ai/voice-intake` → prefilled booking sheet |
| **Live** | Strip: phlebo avatar, name, ETA countdown, distance, a breathing dot | A booking is in flight. Tap expands to full tracking |
| **Expanded** | Sheet: map, custody rail, call/OTP, share-my-visit | The tracking screen, reached without leaving the current screen |

One element, three states, always in reach. **This is where the entire animation budget goes** — a spring morph between pill → strip → sheet. Everything else stays quiet. `GlassContainer` on iOS 26 makes the Omnibar and tab bar merge fluidly when they approach: free polish, use it.

Voice input is not a gimmick here. A 58-year-old in Vizag will speak Telugu into it faster than they will navigate a catalogue, and `/api/ai/voice-intake` already exists.

### 4.2 FILE: `mobile/src/components/omnibar/Omnibar.tsx`

```tsx
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  interpolate, useAnimatedStyle, useDerivedValue, useSharedValue,
  withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Mic, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '../glass/Glass';
import { useGlass } from '../../theme/GlassProvider';
import { hexA, motion, radius, space, type as T } from '../../theme/tokens';

export type LiveJob = {
  bookingId: string;
  providerName: string;
  etaMinutes: number;
  distanceKm: number;
  status: 'assigned' | 'en_route' | 'arrived' | 'collecting';
};

/**
 * Floating glass omnibar. Sits above the tab bar, morphs between an input pill
 * and a live tracking strip. Both states are the SAME view — we animate height
 * and cross-fade the contents so the glass never unmounts and re-blurs.
 */
export function Omnibar({
  live, onSubmit, onVoice, onExpand,
}: {
  live?: LiveJob | null;
  onSubmit: (text: string) => void;
  onVoice: () => void;
  onExpand: (bookingId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { accent, scheme, reduceMotion } = useGlass();
  const dark = scheme === 'dark';

  // 0 = idle pill, 1 = live strip
  const morph = useSharedValue(live ? 1 : 0);
  const pulse = useSharedValue(0);
  const [text, setText] = React.useState('');

  useEffect(() => {
    morph.value = withSpring(live ? 1 : 0, motion.spring);
    if (live) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [live, morph]);

  useEffect(() => {
    if (reduceMotion) { pulse.value = 0.6; return; }
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [reduceMotion, pulse]);

  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(morph.value, [0, 1], [56, 68]),
  }));
  const idleStyle = useAnimatedStyle(() => ({
    opacity: 1 - morph.value,
    transform: [{ translateY: interpolate(morph.value, [0, 1], [0, -12]) }],
  }));
  const liveStyle = useAnimatedStyle(() => ({
    opacity: morph.value,
    transform: [{ translateY: interpolate(morph.value, [0, 1], [12, 0]) }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.8, 1.15]) }],
  }));

  const submit = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSubmit(t);
    setText('');
  }, [text, onSubmit]);

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 84 }]} pointerEvents="box-none">
      <Pressable
        disabled={!live}
        onPress={() => live && onExpand(live.bookingId)}
        accessibilityRole={live ? 'button' : 'search'}
        accessibilityLabel={
          live
            ? `${live.providerName} arriving in ${live.etaMinutes} minutes. Tap to track.`
            : 'Ask or book'
        }
      >
        <Glass tier="chrome" radius={radius.pill} accented={!!live} interactive>
          <Animated.View style={[styles.inner, containerStyle]}>

            {/* IDLE — input pill */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.row, idleStyle]} pointerEvents={live ? 'none' : 'auto'}>
              <Search size={19} color={dark ? '#9AA6BF' : '#5A667F'} />
              <TextInput
                value={text}
                onChangeText={setText}
                onSubmitEditing={submit}
                returnKeyType="search"
                placeholder="Ask or book — try “CBC for amma tomorrow”"
                placeholderTextColor={dark ? '#7D89A3' : '#7A879E'}
                style={[styles.input, { color: dark ? '#EAF0FF' : '#0A1020' }]}
              />
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onVoice(); }}
                hitSlop={10}
                accessibilityLabel="Speak your request"
                style={[styles.mic, { backgroundColor: hexA(accent, dark ? 0.22 : 0.12) }]}
              >
                <Mic size={18} color={accent} />
              </Pressable>
            </Animated.View>

            {/* LIVE — tracking strip */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.row, liveStyle]} pointerEvents={live ? 'auto' : 'none'}>
              <View style={[styles.avatar, { backgroundColor: hexA(accent, 0.22) }]}>
                <Animated.View style={[styles.dot, { backgroundColor: accent }, dotStyle]} />
              </View>
              <View style={styles.liveText}>
                <Text numberOfLines={1} style={[styles.liveTitle, { color: dark ? '#EAF0FF' : '#0A1020' }]}>
                  {live?.providerName ?? ''} · {statusLabel(live?.status)}
                </Text>
                <Text numberOfLines={1} style={[styles.liveSub, { color: dark ? '#9AA6BF' : '#5A667F' }]}>
                  {live ? `${live.etaMinutes} min away · ${live.distanceKm.toFixed(1)} km` : ''}
                </Text>
              </View>
              <View style={[styles.eta, { backgroundColor: hexA(accent, dark ? 0.22 : 0.12) }]}>
                <Text style={[styles.etaNum, { color: accent }]}>{live?.etaMinutes ?? 0}</Text>
                <Text style={[styles.etaUnit, { color: accent }]}>min</Text>
              </View>
            </Animated.View>

          </Animated.View>
        </Glass>
      </Pressable>
    </View>
  );
}

function statusLabel(s?: LiveJob['status']) {
  switch (s) {
    case 'assigned': return 'on the way soon';
    case 'en_route': return 'on the way';
    case 'arrived': return 'at your door';
    case 'collecting': return 'collecting now';
    default: return '';
  }
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.gutter, right: space.gutter },
  inner: { justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.md },
  input: { flex: 1, ...T.scale.body, fontFamily: T.body, paddingVertical: 0 },
  mic: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  liveText: { flex: 1 },
  liveTitle: { ...T.scale.caption, fontFamily: T.bodyMedium },
  liveSub: { ...T.scale.micro, fontFamily: T.body },
  eta: { minWidth: 52, paddingVertical: 4, borderRadius: radius.chip, alignItems: 'center' },
  etaNum: { ...T.scale.h2, fontFamily: T.data, fontVariant: ['tabular-nums'] },
  etaUnit: { ...T.scale.micro, fontFamily: T.body, marginTop: -2 },
});
```

**Phase 2 done when:** all ten role groups route through one shell, no screen imports `BlurView` directly, and the tab bar plus Omnibar are the only navigation chrome in the app.

---

## 5. Phase 3 — Web → mobile parity

Almost every gap is client-only. The endpoints already exist and are marked `VERIFIED` in your audit. Ship in this order.

### 5.1 P0 — Patient (the revenue surface)

| Missing on mobile | Existing endpoint | New route / component |
|---|---|---|
| BiomarkerMatrix + trends | `GET /api/v1/patient/biomarkers`, `/trends` | `(patient)/health.tsx` → `MetricTile` + `TrendSpark` |
| SampleStatusRail | `GET /api/patient/samples/{id}/timeline` | `StatusRail` on home + report screens |
| PhlebotomistRadar | `GET /api/dispatch/track/{booking_id}` | `LiveTrack` in radar mode |
| Quick reorder | `POST /api/bookings/quick-reorder` | Home "Book again" row |
| MedicineCabinetGrid | `GET /api/v1/patient/medications` | `(patient)/medicines.tsx` |
| DrugShield | `POST /api/ai/drug-shield` | `DrugShieldSheet` from medicines + prescriptions |
| DoctorBriefing | `GET /api/v1/patient/biomarkers/doctor-briefing` | Sheet inside the consultation flow |
| InteractiveBodyMap | symptom entry → `/api/ai/voice-intake` | `BodyMap` (react-native-svg) inside Omnibar intake |
| ABHA linking | `patients.abha_*` via profile | Profile → ABHA card |
| AI voice intake | `POST /api/ai/voice-intake` | **Omnibar** (§4) |

### 5.2 P0 — Phlebotomist (field ops; broken parity costs collections)

| Missing | Endpoint | Route |
|---|---|---|
| Stock panel | `/api/phlebo/stock/{my,request,consume,return}` | `(phlebotomist)/stock.tsx` |
| Wallet + earnings | `/api/phlebo/earnings`, `/incentives` | `(phlebotomist)/wallet.tsx` → `Ledger` |
| Performance | `/api/phlebo/performance`, `/stats` | Segmented tab inside wallet |
| Roster / schedule | `/api/roster/my-jobs`, `/pass`, `/decline` | `(phlebotomist)/roster.tsx` → `RosterStrip` |
| Selfie + attendance | `/api/verification/selfie`, `/api/lab/attendance` | Blocking gate before the 05:15 IST cutoff |

Build the attendance gate as a **full-screen glass takeover**. The 05:30 beat job marks them absent; the app should make check-in unmissable, not a card they can scroll past.

### 5.3 P1 — Processing Center (no mobile presence today)

New `(processing-center)/` group: `queue`, `intake`, `batches`, `roster`.
Endpoints: `/api/pc/queue`, `/intake/scan`, `/intake/verify`, `/intake/reject`, `/batches`, `/batches/{id}/seal`, `/batches/{id}/dispatch`, `/roster`.

Five-point verification is a phone-shaped task — scan, checklist, photo, decide — and it is currently desktop-only. `VerifyChecklist` + `ScanSheet` cover it. Highest operational ROI of any P1 item.

### 5.4 P1 — Supervisor (no mobile presence today)

New `(supervisor)/` group: `radar`, `sla`, `heatmap`.
Endpoints: `/api/admin/analytics/dispatch-heatmap`, `/sample-turnaround`, `/overview`, `/api/dispatch/track/*`.
This is the heat map you asked for, at fleet level — same `HeatLayer` component as the patient-side radar, different data source.

### 5.5 P1 — Admin, Pharmacy, Organization, Doctor

| Role | Missing | Endpoint |
|---|---|---|
| Admin | Verification queue, analytics, audit logs | `/api/admin/verifications/*`, `/api/admin/analytics/*`, `/api/admin/audit-logs` |
| Pharmacy | Inventory management | `/api/pharmacy/inventory`, `/inventory/update` |
| Organization | Doctors directory, services catalog, slot calendar, lab team | `/api/providers/organizations/*`, `/availability`, `/slots`, `/blocked-dates`, `/api/lab/team` |
| Doctor | AI scribe finalise, report review, telemed intake, order-prescribed | `/api/telemed/finalize`, `/intake`, `/order-prescribed`, `/api/reports/doctor-review` |

### 5.6 P2 — Nurse

Vitals recording and wound-care/IV logs have **no backend endpoint** in the audit. This is the only parity gap needing server work: a `nurse_visit_logs` table plus `POST /api/nurse/visits/{id}/vitals`. Everything else on this list is client-only.

---

## 6. Phase 4 — The shared widget kit (this is the actual fix)

Ten primitives. Every dashboard composes them. Nothing gets written twice, and parity stops regressing because adding a role means wiring data, not building UI.

| Primitive | Used by |
|---|---|
| `StatusRail` — horizontal/vertical FSM stepper | samples, report jobs, batches, pharmacy orders, dispatch |
| `LiveTrack` — map + ETA + provider card | patient tracking, phlebo navigation, pharmacy delivery, supervisor radar |
| `HeatLayer` — density overlay | supervisor heatmap, admin analytics, "phlebos near you" |
| `MetricTile` — big tabular number + delta | every dashboard home |
| `TrendSpark` — Skia sparkline | biomarkers, earnings, turnaround, revenue |
| `Ledger` — signed-amount transaction list | phlebo wallet, admin settlements, pharmacy payouts |
| `ScanSheet` — camera barcode + manual entry | phlebo doorstep, PC intake, pharmacy dispense |
| `VerifyChecklist` — n-point pass/fail + photo + reason | PC 5-point intake, doorstep verify, admin credential review |
| `QueueList` — prioritised work list with SLA chip | PC queue, pharmacy queue, admin verifications, doctor consults |
| `RosterStrip` — day shift strip | phlebo roster, PC roster, doctor schedule, org calendar |

Build them against the **G4 clinical** tier by default. Glass is the frame; data sits on solid.

**The one rule that keeps this from eroding in three months:** a screen file may not contain a `StyleSheet` entry that sets `backgroundColor` with alpha. If it needs a surface, it uses `<Glass>`. Enforce it with an ESLint rule (§14.3), not with code review discipline.

---

## 7. Phase 5 — Maps, tracking, heat map

You are on Leaflet + Geoapify on web. Keep one map vendor.

- **`@maplibre/maplibre-react-native` + Geoapify vector tiles.** MapLibre has a native `heatmap` layer type and native clustering, so `HeatLayer` is a style layer rather than 500 markers. It also avoids Google Maps mobile billing entirely.
- Provider positions come from `provider_locations` / `GET /api/dispatch/track/{booking_id}`. Poll at 10–15s to match the existing `mobile/src/services/location.ts` throttle rather than fighting it.
- Dark map style tinted with `brand.ink` so the aurora and the map read as one surface.
- The tracking card floats over the map as **G2 chrome**. This is the one screen where the glass language genuinely earns its keep.

`react-native-maps` is the fallback if MapLibre's config plugin fights your prebuild, but you pay for Google tiles and get a weaker heatmap.

---

# PART II — THE FEATURE PROGRAM

## 8. The Ten: patient features nobody in Indian healthtech ships

Everything below is sized against what CallMedex **already has in the database**. That is the whole argument for building these: your architecture accidentally contains the raw material for a category-defining patient experience, and right now none of it reaches the patient.

Each feature lists the web surface too — build both together or the WhatsApp-native promise breaks.

Effort key: **S** ≤ 3 days · **M** ≤ 1 sprint · **L** > 1 sprint.

---

### 8.1 Specimen Passport — "watch your own blood travel"

**The idea.** The patient opens their sample and sees its entire life: barcode bound at their door at 07:12, tube type and colour, temperature logged at each touchpoint, every custody handover with the person's name and role, batch sealed at the processing centre, courier tracking, report published. A cold-chain sparkline runs down the side. If it ever crossed 8°C, they see exactly when and what happened next.

**Why nobody has it.** Every lab in India has this data. None of them show it, because none of them are confident enough in their own chain of custody. You built a 5-point verification FSM and a `sample_events` audit table — you can afford to be transparent, and transparency is the single biggest unmet need in Indian diagnostics. The universal fear is *"did they even test my sample, or mix it up?"* This answers it visually, permanently.

**Data you already have.** `samples` (barcode, tube_type, temperature_celsius, is_verified, verification_details), `sample_events` (event_type, actor_role, lat/lng, temperature, created_at), `sample_handovers`, `sample_batches`, `report_jobs`.

**Backend delta (S).** Extend `GET /api/patient/samples/{id}/timeline` to return, per event: `event_type`, `actor_role`, `actor_display_name` (first name only), `temperature_celsius`, `created_at`, and the 5-point `verification_details` when the event is an intake. No new table.

**UI.** `SpecimenPassport` widget (§9.1) — a vertical glass rail with a Skia temperature ribbon. On **web**, the same component as a full-page share view at `/samples/[barcode]`.

**The moment that sells it.** A push notification at the moment the PC verifies: *"Your sample passed all 5 checks at 11:04. Temperature held at 4.2°C the whole way."* Nobody in this market sends that message.

---

### 8.2 Trust Handshake + Guardian Link — "she is not letting a stranger in blind"

**The idea.** Before a phlebotomist arrives, the patient sees a verified identity card: photo, first name, certification number status, jobs completed, rating, vehicle. A **4-digit handshake code** appears — the phlebo must read it out or scan it; the patient never gives the code first. One tap on **Guardian Link** sends a live-tracking web link to a family member: they watch the ETA, see the visit start and end, and get an automatic "visit completed safely" message.

**Why nobody has it.** Home collection in India is disproportionately booked by women, elderly people alone during the day, and families with a parent at home. The safety anxiety is real and completely unaddressed by every competitor. This is not a feature; it is the reason someone chooses you over a ₹50-cheaper alternative.

**Data you already have.** `dispatch_offers`/`dispatch_requests` (assigned provider), `phlebotomists` (certification_number, verification_status), `provider_locations`, `sample_handovers.otp_code`, masked calling via `/api/comm/masked-call/initiate`, phlebo performance stats.

**Backend delta (S–M).** `POST /api/dispatch/track/{booking_id}/share` → returns a short-lived signed token (reuse the `MAGIC_LINK_SECRET` pattern already in `config.py`). Public `GET /api/track/{token}` returns provider first name, coarse position, ETA and status only — never patient address, never test names. Auto-expires at visit completion + 30 minutes.

**UI.** Identity card as a G4 clinical surface (never blurred — it's a verification decision). Guardian Link is a single share-sheet action. On **web**, the recipient's view is a public Next.js route `/track/[token]` — mobile-first, no login, works over WhatsApp.

---

### 8.3 Doctor Handoff QR — "walk into any clinic and hand over your whole history in 2 seconds"

**The idea.** One button generates a QR on the patient's screen. Any doctor — inside CallMedex or completely outside it — scans it with a phone camera and gets a clean, read-only web page: current medications, allergies, blood group, last 6 months of abnormal biomarkers, the AI doctor-briefing summary, and the last three reports. It expires in 15 minutes. Every scan is logged to `consent_records`.

**Why nobody has it.** ABHA exists but almost no small clinic in Vizag has an ABDM-connected HMS to pull records with. Patients still carry plastic folders of paper. This bridges the gap: the FHIR bundle you *already generate* is the payload, and the QR is the delivery mechanism that works with zero adoption effort on the doctor's side. It makes your ABDM investment visible to the patient for the first time.

**Data you already have.** `fhir.py` already produces R4 `DiagnosticReport` / `Observation` / `Patient` / `Practitioner` bundles. `GET /api/reports/fhir/{id}` exists. `patient_biomarkers`, `patient_medications`, `doctor_briefings`, `consent_records`.

**Backend delta (M).** `POST /api/v1/patient/handoff` → short-lived signed token + scope list, writes a `consent_records` row. `GET /api/v1/handoff/{token}` → assembled FHIR bundle + a rendered HTML view. Rate-limit and single-use-per-scan-window. Rendering the bundle as a printable page is the whole trick — the doctor gets something readable, and the FHIR JSON is there for anyone who wants it.

**UI.** `HandoffQR` — a G4 card that flips to reveal the QR with a live expiry ring around it (§9.5). On **web**, the same button in the patient dashboard, plus a "print / save PDF" fallback for patients without a smartphone.

---

### 8.4 Prep Coach — "the test that doesn't get wasted"

**The idea.** The moment a fasting test is booked, the app takes over the prep: a countdown ring showing exactly when to stop eating, a "you can still drink water" reassurance (the single most-asked question), a bedtime nudge, a morning wake alarm 30 minutes before the slot, and a plain-language card explaining which tube colours will be drawn and roughly how much blood. If they're on medication, it flags which ones typically pause before that test — routed as *ask your doctor*, never as an instruction.

**Why nobody has it.** Failed fasting is a genuine cost centre: the phlebo travels, the collection aborts or the result is invalid, the patient blames the lab. You already store `fasting_required` per service and `slot_start` per booking, and you already have local notifications. Nobody joins those three facts.

**Data you already have.** `home_services.fasting_required`, `sample_type`, `turnaround_hours`; `home_service_tubes` → `tube_types` (colour, volume); `bookings.slot_start`; `patient_medications`; `expo-notifications`.

**Backend delta: none.** Pure client work plus a `tube_types` read you already expose via `/api/home-services/tubes`.

**UI.** `PrepRing` (§9.6) — a Skia countdown ring on the home screen that turns from teal to amber as the fasting window opens. Scheduled local notifications; an optional real alarm via the alarm intent. On **web**, the same card plus an "add to calendar" `.ics` download and a WhatsApp reminder through MediAssist (`send_notification`) — which is where most patients will actually see it.

---

### 8.5 Care Circle — "your son in Bengaluru manages your health from there"

**The idea.** A patient invites a family member as a **caregiver** with scoped permissions: book and pay, view reports, receive alerts, join consultations — each toggled independently and revocable at any time. The caregiver gets their own view: a switcher between the people they care for, with the same widgets, plus notifications when a report lands, a medicine is missed, or a sample is rejected. The patient always sees who has access and what they looked at.

**Why nobody has it.** This is the actual shape of Indian healthcare — the adult child in another city is the decision-maker and the payer, while the parent is the patient. Every app models one account, one body. You already have `family_members` (dependants) but not the inverse relationship (guardians), and the inverse is where the money and the retention are.

**Data you already have.** `family_members`, `device_tokens`, `consent_records`, `booking_subjects` (already supports booking on behalf of a family member), WhatsApp notification delivery.

**Backend delta (M).** New table `care_circle_members(id, patient_id, member_user_id, scopes JSONB, status, invited_at, accepted_at, revoked_at)`, an invite/accept flow over WhatsApp or SMS OTP, scope enforcement in the auth dependency, and a notification fan-out that respects scopes. Every access writes to `consent_records` — this is DPDP-critical, and doing it properly is also the feature's selling point.

**UI.** Role switcher inside the Omnibar's long-press menu; caregiver home is the same patient dashboard with an identity chip at top. On **web**, identical — caregivers will often use the web dashboard from an office desk.

---

### 8.6 Report in Your Voice — "amma understands her own report"

**The idea.** Every report gets a play button. The AI plain-language summary is translated to the patient's `preferred_language` and read aloud in a natural voice — Telugu, Hindi, English. Speed control, and a "what should I ask my doctor?" list generated alongside. Abnormal values are read with their reference range in context, never as a verdict.

**Why nobody has it.** Report literacy is the real barrier, not report access. A 62-year-old in Vizag with a PDF of numbers has nothing. You already generate `plain_language_summary` and already store `preferred_language`; you already run live translated captions in telemedicine. The capability exists and is not being pointed at the highest-value moment.

**Data you already have.** `ai_report_analyses.plain_language_summary`, `abnormal_flags`, `recommendations`; `patients.preferred_language`; Groq for translation; `expo-speech` on device.

**Backend delta (S).** `GET /api/reports/{id}/summary?lang=te` returns the translated summary (cache it on `ai_report_analyses` as a `summary_translations` JSONB column so you translate once). Device TTS handles playback; upgrade to server-side neural TTS later if device voices sound poor in Telugu.

**UI.** A waveform play button on the report card; the text highlights word-by-word as it reads. On **web**, the same, plus a WhatsApp voice-note delivery through MediAssist — which is the version that will actually get listened to.

**Guardrail.** The audio must open with the standing disclaimer already in your compliance matrix: this is decision support, not a diagnosis. Critical flags say "call your doctor today" and surface the call button — they never get a soothing summary.

---

### 8.7 Generic Savings Ledger — "you've saved ₹4,280 this year"

**The idea.** NMC 2026 forces generic prescribing, and your `drug_shield` service already enforces it. Turn that compliance obligation into a running, visible rupee counter: every prescription shows the branded price alongside the generic price, and a lifetime savings number rolls up on the patient's home screen like an odometer.

**Why nobody has it.** Pharmacies have every incentive *not* to show this. You are a marketplace, not a pharmacy, so you can. It converts an abstract regulation into the most persuasive number in the product, and it makes the pharmacy leg of your marketplace something patients actively seek out instead of tolerate.

**Data you already have.** `drug_shield.py` (generic enforcement), `pharmacy_orders.items` (JSONB with prices), `consultations.prescription_id`.

**Backend delta (S).** `GET /api/v1/patient/savings` → `{ lifetime, this_year, by_order[] }`, computed from `pharmacy_orders.items`. Requires storing `branded_mrp` alongside `price` in the items payload at order time — a one-line change at write, not a migration.

**UI.** `Odometer` counter (§9.7) — digits roll on change, with a subtle accent glow. Placed on the home screen next to Health Weather. On **web**, the same tile plus a downloadable annual statement, which is genuinely useful at tax and insurance time.

---

### 8.8 Health Weather — the aurora *is* your health status

**The idea.** The animated backdrop you're building for aesthetic reasons becomes the app's most-glanced piece of information. Its tint is derived from the patient's current biomarker status: calm teal when everything is in range, warm amber when something needs attention, and a slow deliberate pulse when a critical flag is unread. Open the app and you know before you read anything.

**Why nobody has it.** This is the one place where the Gemini aesthetic and clinical utility line up perfectly instead of fighting. Ambient status is a design pattern from weather and finance apps that healthcare has never borrowed. It costs almost nothing to build because the backdrop already exists.

**Data you already have.** `patient_biomarkers.status` (`normal | high | low | critical`), report read state.

**Backend delta: none.** Derive client-side from the biomarkers you already fetch.

**UI.** Pass `tint` into `AppShell` (§3.11 already supports it). Rules in §9.4. Extend to a **home-screen widget** (iOS WidgetKit / Android Glance) — that's native module work, **L**, and worth doing in a later sprint.

**Guardrail.** Never let colour be the only signal — pair it with an explicit status line for accessibility and colour-blind users, and never let "amber" be ambiguous. A critical unread flag also gets a real notification, not just a mood.

---

### 8.9 Retest Radar — "your Vitamin D was low seven months ago"

**The idea.** The app watches the gap between what was found and what was never followed up. Low Vitamin D in January with no retest since, an HbA1c trending up across three tests, a thyroid panel due at its interval — each surfaces as a single card with the trend, the plain reason, and one tap to rebook at a locked price.

**Why nobody has it.** Diagnostics in India is transactional: you book, you get a PDF, the relationship ends. Nobody owns the follow-up loop, so nothing gets retested and conditions get caught late. You already store longitudinal biomarkers and already have `quick-reorder` — the loop is one rules table away, and it is the single highest-value retention mechanic available to you.

**Data you already have.** `patient_biomarkers` (value, status, recorded_at), `home_services` catalog, `POST /api/bookings/quick-reorder`.

**Backend delta (S–M).** A small `biomarker_retest_rules(biomarker_type, status, interval_days, suggested_service_id)` seed table plus `GET /api/v1/patient/retest-radar`. Keep the rules clinical and conservative, sourced from standard intervals, and label every card as a suggestion to discuss with a doctor.

**UI.** `TrendSpark` + a G4 card in a "Worth checking" section. On **web**, the same, plus a monthly WhatsApp digest through MediAssist — that's the channel that will actually drive the rebooking.

**Guardrail.** Suggest, never alarm. No countdown timers, no red badges, no "you are overdue" framing. The copy is *"worth discussing at your next visit"*, and the doctor is always the next step.

---

### 8.10 Offline Emergency Card — "works with 2% battery and no signal"

**The idea.** A single card, cached encrypted on the device, readable without network: blood group, allergies, current medications with doses, chronic conditions, ABHA number, emergency contacts, and the treating doctor. Reachable from the lock screen. One long-press triggers SOS — which fires the existing endpoint when there is signal, and falls back to a direct dial plus a pre-written SMS with location when there isn't.

**Why nobody has it.** Every health app assumes connectivity and an unlocked phone. Emergencies assume neither. The data is already in your database; keeping an encrypted copy on the device is cheap, and the one time it matters, it matters enormously.

**Data you already have.** `patients.blood_group`, `medical_history`, `emergency_contact`; `patient_medications`; `emergency_sos_contacts`; `/api/v1/patient/emergency-sos/trigger`; `expo-secure-store`.

**Backend delta: none** for v1. Encrypted local cache refreshed on every successful sync.

**UI.** `HoldToTrigger` ring (§9.3) — a deliberate 1.5s press with escalating haptics, so it can't fire in a pocket, and a 5-second cancel window after firing. Lock-screen access is native work (iOS Live Activity / Android quick-settings tile), **L**, sprint 2 of this feature. On **web**, a printable wallet-sized card PDF — genuinely useful for elderly patients and for keeping in a vehicle.

---

### 8.11 Two more worth queuing

**Price Lock + cashless eligibility upfront.** You have `home_service_city_pricing` and an AB-PMJAY eligibility check on the landing page. Show the final price, including home-collection charges, *before* booking, and lock it for 24 hours. Indian diagnostics is riddled with quiet price variation; being the platform that shows one honest number is a positioning claim, not just a feature. **S.**

**Zero-Report-Left-Behind inbox.** Your WhatsApp front door creates headless patients who never see the app. When a headless patient verifies their phone, sweep every historical report, sample and booking into the app inbox and greet them with it: *"We found 6 reports from the last year."* Turns your dual front door from an architecture note into an onboarding moment. **S.**

---

## 9. Signature widget designs

These are the pieces that make the app feel unlike anything else in the category. Each is specified as behaviour first, then code where the implementation is non-obvious.

### 9.1 `SpecimenPassport` — the cold-chain rail

**Behaviour.** A vertical rail down the left edge with a node per custody event. Each node carries an icon, actor role, and time. Running alongside is a **temperature ribbon**: a Skia line whose colour shifts from teal to red as it approaches 8°C, with the safe band drawn as a translucent zone behind it. Nodes complete with a spring pop and a light haptic as they arrive in real time. The 5-point verification node expands into the checklist with each point ticked, and a seal animation plays when the batch is sealed.

**Why it lands.** It reads like a courier tracking screen, which every Indian user already understands — but the cargo is their own blood, and the temperature line is proof nobody else offers.

**FILE: `mobile/src/components/widgets/SpecimenPassport.tsx`**

```tsx
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Path, Skia, LinearGradient, vec, Rect } from '@shopify/react-native-skia';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Glass } from '../glass/Glass';
import { useGlass } from '../../theme/GlassProvider';
import { hexA, semantic, space, type as T, radius } from '../../theme/tokens';

export type CustodyEvent = {
  id: string;
  eventType: string;              // collected | in_transit | received | verified | batched | dispatched | report_ready
  label: string;                  // human copy, already localised
  actorRole: string;              // phlebotomist | processing_center | lab
  actorName?: string;             // first name only
  temperatureCelsius?: number | null;
  at: string;                     // ISO
  verification?: { point: string; passed: boolean }[] | null;
};

const SAFE_MAX = 8.0;             // cold-chain ceiling from the PC intake spec
const SAFE_MIN = 2.0;

/**
 * The cold-chain rail. Left column: custody nodes. Right column: a Skia
 * temperature ribbon drawn against the 2–8°C safe band.
 *
 * Clinical surface → G4. Never blurred, never translucent.
 */
export function SpecimenPassport({ barcode, events }: { barcode: string; events: CustodyEvent[] }) {
  const { scheme } = useGlass();
  const dark = scheme === 'dark';
  const temps = events.map((e) => e.temperatureCelsius).filter((t): t is number => t != null);
  const breached = temps.some((t) => t > SAFE_MAX || t < SAFE_MIN);

  return (
    <Glass tier="clinical" radius={radius.card} style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: dark ? '#9AA6BF' : '#5A667F' }]}>SPECIMEN</Text>
          <Text style={[styles.barcode, { color: dark ? '#EAF0FF' : '#0A1020' }]}>{barcode}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: hexA(breached ? semantic.critical : semantic.verified, 0.16) }]}>
          <Text style={[styles.chipText, { color: breached ? semantic.critical : semantic.verified }]}>
            {breached ? 'Temperature flagged' : 'Cold chain held'}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.rail}>
          {events.map((e, i) => (
            <Animated.View key={e.id} entering={FadeInDown.delay(i * 60).springify()} style={styles.node}>
              <View style={styles.nodeGutter}>
                <View style={[styles.dot, { backgroundColor: colorFor(e) }]} />
                {i < events.length - 1 && <View style={[styles.line, { backgroundColor: dark ? '#222C44' : '#DCE3F2' }]} />}
              </View>
              <View style={styles.nodeBody}>
                <Text style={[styles.nodeLabel, { color: dark ? '#EAF0FF' : '#0A1020' }]}>{e.label}</Text>
                <Text style={[styles.nodeMeta, { color: dark ? '#9AA6BF' : '#5A667F' }]}>
                  {[e.actorName, prettyRole(e.actorRole), time(e.at)].filter(Boolean).join(' · ')}
                  {e.temperatureCelsius != null ? `  ${e.temperatureCelsius.toFixed(1)}°C` : ''}
                </Text>
                {e.verification && (
                  <View style={styles.checks}>
                    {e.verification.map((v) => (
                      <Text
                        key={v.point}
                        style={[styles.check, { color: v.passed ? semantic.verified : semantic.critical }]}
                      >
                        {v.passed ? '✓' : '✕'} {v.point}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          ))}
        </View>

        {temps.length > 1 && <TemperatureRibbon temps={temps} dark={dark} />}
      </View>
    </Glass>
  );
}

/** Skia ribbon: safe band behind, temperature path in front, gradient by breach. */
function TemperatureRibbon({ temps, dark }: { temps: number[]; dark: boolean }) {
  const W = 44, H = 200;
  const lo = Math.min(0, ...temps) - 1;
  const hi = Math.max(12, ...temps) + 1;
  const y = (t: number) => H - ((t - lo) / (hi - lo)) * H;

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    temps.forEach((t, i) => {
      const x = (i / Math.max(1, temps.length - 1)) * W;
      i === 0 ? p.moveTo(x, y(t)) : p.lineTo(x, y(t));
    });
    return p;
  }, [temps]);

  return (
    <View style={{ width: W, height: H }}>
      <Canvas style={{ width: W, height: H }}>
        <Rect x={0} y={y(SAFE_MAX)} width={W} height={y(SAFE_MIN) - y(SAFE_MAX)} color={hexA(semantic.verified, 0.14)} />
        <Path path={path} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round">
          <LinearGradient
            start={vec(0, 0)} end={vec(0, H)}
            colors={[semantic.critical, semantic.verified, semantic.low]}
          />
        </Path>
      </Canvas>
      <Text style={[styles.axis, { color: dark ? '#7D89A3' : '#7A879E' }]}>2–8°C</Text>
    </View>
  );
}

function colorFor(e: CustodyEvent) {
  if (e.verification?.some((v) => !v.passed)) return semantic.critical;
  if (e.eventType === 'verified' || e.eventType === 'report_ready') return semantic.verified;
  if (e.eventType === 'in_transit' || e.eventType === 'dispatched') return semantic.inTransit;
  return semantic.pending;
}
const prettyRole = (r: string) => r.replace(/_/g, ' ');
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const styles = StyleSheet.create({
  card: { padding: space.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.lg },
  eyebrow: { ...T.scale.micro, fontFamily: T.body },
  barcode: { ...T.scale.h2, fontFamily: T.data, fontVariant: ['tabular-nums'] },
  chip: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill },
  chipText: { ...T.scale.micro, fontFamily: T.bodyMedium },
  body: { flexDirection: 'row', gap: space.lg },
  rail: { flex: 1 },
  node: { flexDirection: 'row', gap: space.md },
  nodeGutter: { alignItems: 'center', width: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  line: { width: 2, flex: 1, marginVertical: 3 },
  nodeBody: { flex: 1, paddingBottom: space.lg },
  nodeLabel: { ...T.scale.body, fontFamily: T.bodyMedium },
  nodeMeta: { ...T.scale.micro, fontFamily: T.body, marginTop: 2 },
  checks: { marginTop: space.sm, gap: 2 },
  check: { ...T.scale.micro, fontFamily: T.body },
  axis: { ...T.scale.micro, fontFamily: T.body, textAlign: 'center', marginTop: 4 },
});
```

---

### 9.2 `VitalsConstellation` — biomarkers as an orbit, not a table

**Behaviour.** Each biomarker is a node placed on a ring, sized by how far it sits from its reference range and coloured by status. The whole constellation breathes slowly. Drag a horizontal time scrubber and the nodes travel — you literally watch your cholesterol move over eighteen months. Tap a node and it lifts out into a G4 clinical card with the exact value, range, source report and trend line.

**Why it lands.** A biomarker table is a spreadsheet; an orbit is a picture of a body. It gives non-technical patients an instant read on "what's off" without a single number, then gives the number when they ask for it. It's also the screenshot people will share.

**Implementation notes.** One Skia `Canvas`. Node positions from `useDerivedValue` driven by a single `scrub` shared value, so dragging costs zero JS. Radius `r = clamp(|value − midRange| / rangeWidth, 0.4, 1.6) * baseR`. Cap at 12 nodes on screen; anything beyond goes in a list below. Reduce-motion freezes the breathing, never the scrubbing.

**Never do:** don't animate a value *between* two real measurements as if it were continuous. Interpolate position, not meaning — show the discrete measurement points and let the eye connect them.

---

### 9.3 `HoldToTrigger` — the SOS ring

**Behaviour.** A ring that fills over 1500ms of continuous press, with haptics escalating from light to heavy as it completes, then a success notification haptic on fire. Release early and it springs back with a soft tick. After firing, a 5-second cancel bar appears. Deliberate by design — it cannot fire in a pocket, and it cannot fire from a mis-tap.

**FILE: `mobile/src/components/widgets/HoldToTrigger.tsx`**

```tsx
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import {
  Easing, runOnJS, useDerivedValue, useSharedValue, withTiming, cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { hexA, semantic, space, type as T } from '../../theme/tokens';

const SIZE = 132;
const STROKE = 8;
const HOLD_MS = 1500;

export function HoldToTrigger({
  label = 'Hold for emergency',
  color = semantic.critical,
  onTrigger,
  disabled,
}: {
  label?: string;
  color?: string;
  onTrigger: () => void;
  disabled?: boolean;
}) {
  const progress = useSharedValue(0);
  const fired = useSharedValue(false);

  const ring = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const r = (SIZE - STROKE) / 2;
    p.addArc(
      { x: STROKE / 2, y: STROKE / 2, width: SIZE - STROKE, height: SIZE - STROKE },
      -90,
      360 * progress.value,
    );
    return p;
  });

  const tick = (level: 'light' | 'medium' | 'heavy') => {
    Haptics.impactAsync(
      level === 'light' ? Haptics.ImpactFeedbackStyle.Light
      : level === 'medium' ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Heavy,
    );
  };

  const fire = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onTrigger();
  };

  // escalating haptics as the ring fills
  useEffect(() => {
    const id = setInterval(() => {
      const p = progress.value;
      if (p <= 0 || fired.value) return;
      if (p > 0.85) tick('heavy');
      else if (p > 0.5) tick('medium');
      else tick('light');
    }, 220);
    return () => clearInterval(id);
  }, [progress, fired]);

  const start = () => {
    if (disabled) return;
    fired.value = false;
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (done) => {
      'worklet';
      if (done && !fired.value) { fired.value = true; runOnJS(fire)(); }
    });
  };

  const end = () => {
    cancelAnimation(progress);
    if (!fired.value) progress.value = withTiming(0, { duration: 220 });
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={end}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Press and hold for one and a half seconds to send an emergency alert"
      style={styles.wrap}
    >
      <View style={[styles.disc, { backgroundColor: hexA(color, 0.14), borderColor: hexA(color, 0.45) }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={ring} style="stroke" strokeWidth={STROKE} strokeCap="round" color={color} />
        </Canvas>
        <Text style={[styles.sos, { color }]}>SOS</Text>
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  disc: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  sos: { ...T.scale.hero, fontFamily: T.display, letterSpacing: 2 },
  label: { ...T.scale.caption, fontFamily: T.bodyMedium },
});
```

---

### 9.4 Health Weather — status-driven aurora

**Rules.** Derive once per app foreground, pass into `AppShell`'s `tint`:

| Condition | Tint | Motion |
|---|---|---|
| No unread flags, everything in range | `brand.teal` | normal drift |
| Any `high` / `low` unread | `brand.amber` | normal drift |
| Any `critical` unread | `semantic.critical` at reduced intensity | slow pulse, plus a persistent G4 banner and a real notification |
| No data yet | `brand.primary` | normal drift |

**FILE: `mobile/src/hooks/useHealthWeather.ts`**

```ts
import { useMemo } from 'react';
import { brand, semantic } from '../theme/tokens';

export type BiomarkerStatus = 'normal' | 'high' | 'low' | 'critical';
export type Biomarker = { id: string; status: BiomarkerStatus; acknowledgedAt?: string | null };

/**
 * Ambient status → aurora tint. Colour is never the only signal: the caller
 * must also render `statusLine` as text (a11y + colour-blind users), and a
 * critical result must additionally fire a notification, not just a mood.
 */
export function useHealthWeather(biomarkers: Biomarker[] | undefined) {
  return useMemo(() => {
    const unread = (biomarkers ?? []).filter((b) => !b.acknowledgedAt);
    if (unread.some((b) => b.status === 'critical')) {
      return { tint: semantic.critical, intensity: 0.7, level: 'critical' as const,
               statusLine: 'A result needs attention today' };
    }
    if (unread.some((b) => b.status === 'high' || b.status === 'low')) {
      return { tint: brand.amber, intensity: 1, level: 'attention' as const,
               statusLine: 'Some results are outside the usual range' };
    }
    if (!biomarkers?.length) {
      return { tint: brand.primary, intensity: 1, level: 'empty' as const,
               statusLine: 'No results yet' };
    }
    return { tint: brand.teal, intensity: 1, level: 'clear' as const,
             statusLine: 'Everything in range' };
  }, [biomarkers]);
}
```

---

### 9.5 `HandoffQR` — the flip card

**Behaviour.** A G4 card showing "Share with your doctor". Tap and it flips on the Y-axis (600ms, spring) to reveal the QR, ringed by a live expiry arc that drains over 15 minutes. Below it: the scopes being shared, as toggles the patient can change before generating. Screen brightness ramps to full while the QR is visible, then restores — a small touch that makes it scan first time under clinic lighting. When it expires, the card flips back on its own and offers to regenerate.

**Notes.** Use `react-native-qrcode-svg`. Bump brightness with `expo-brightness`. Log the scope set into `consent_records` at generation time, and show the patient a "who has viewed this" list in Settings — that list is what turns a feature into trust.

### 9.6 `PrepRing` — the fasting countdown

**Behaviour.** A Skia ring that shows the fasting window rather than a countdown to zero. Teal while eating is fine, and at the fasting start it rotates a marker into the amber arc with a single haptic and a notification. Centre shows "Stop eating in 2h 10m", then "Fasting · 6h 20m so far", then "Collection in 40m". Water is always shown as allowed, in its own small chip — because that is the question every patient asks.

### 9.7 `Odometer` — the savings counter

**Behaviour.** Digits roll vertically when the value changes, staggered right to left, spring per digit. A brief accent glow on increase. Tap to expand into the per-order breakdown.

**Implementation.** One `Animated.View` column per digit inside a fixed-height clipped row, translated by `-digit * lineHeight`. Tabular numerals are mandatory or the columns jitter. Cap the animation at 800ms regardless of delta — a long roll on a large number reads as a slot machine, which is the wrong feeling for money the patient saved.

### 9.8 Interaction principles for the whole kit

1. **Haptics carry state changes, never navigation.** Selection for tabs, light for submit, success notification for a completed clinical event (verification passed, sample received). Nothing haptic for a scroll or a page push.
2. **Motion follows the finger or the data, never the clock.** No idle animation except the aurora and the live-status pulse.
3. **One hero motion per screen.** The Omnibar morph, the passport node pop, the QR flip. Never two.
4. **Skeletons match the final layout exactly**, so nothing shifts on load. On a 3G connection in Vizag this is most of the perceived quality.
5. **Every clinical widget states its provenance** — which report, which sample, what time. A number with no source is not trustworthy no matter how well it's typeset.

---

## 10. Bringing the same language to the web

The web app is Next.js 15 + Tailwind, so the design system ports as CSS variables rather than a TS token file — but it must be the *same* values, flowing the other direction from `globals.css` (§3.13).

| Mobile | Web equivalent |
|---|---|
| `AuroraBackdrop` (Skia) | Fixed-position `<canvas>` with the same four-blob shader, or a CSS `radial-gradient` stack with a slow `@keyframes` drift. Respect `prefers-reduced-motion`. |
| `Glass` G1/G2/G3 | `backdrop-filter: blur(Npx)` + the same rgba fills and hairline borders. Provide a `@supports not (backdrop-filter: blur(1px))` opaque fallback. |
| `Glass` G4 clinical | A plain opaque card class. **Same mandate as mobile** — no `backdrop-filter` anywhere near a lab value. |
| `GlassTabBar` | Not applicable; the web keeps its sidebar. Use the accent-tint rule on the active nav item so roles feel consistent across surfaces. |
| `Omnibar` | A floating command bar (⌘K) with the same voice-intake endpoint. On desktop this is a power feature for staff roles, not just patients. |
| Widget kit | Same ten primitives as React components, same names, same props. If the two implementations diverge in naming, the parity discipline collapses within a quarter. |

Three of The Ten are **web-first**, not mobile-first, and should be built there first:

- **Guardian Link recipient view** (§8.2) — a public `/track/[token]` route. The recipient will not install your app.
- **Doctor Handoff view** (§8.3) — a public `/handoff/[token]` page. The scanning doctor will not install your app either, and this is exactly the point.
- **Care Circle caregiver dashboard** (§8.5) — caregivers are frequently at a desk.

Everything else ships app-first and follows on web within the same sprint.

---

## 11. Guardrails

### 11.1 Clinical safety — non-negotiable

1. **G4 or it doesn't ship.** Any surface displaying a lab value, dose, barcode, temperature reading, or verification decision renders opaque on every platform. This is the one design rule with a clinical justification behind it.
2. **AI output is labelled every single time.** Your compliance matrix already mandates "Clinical Decision Support — Not Final Diagnosis". It appears on every AI summary, every voice readout, every retest suggestion — not once in a settings page.
3. **Critical flags escalate to a human, always.** A critical biomarker never gets a soothing plain-language summary. It gets a plain statement, a call button, and a doctor. Health Weather's critical state is accompanied by a real notification, not just a colour.
4. **No gamification of anything a patient could hurt themselves optimising.** Adherence streaks on prescribed medication are fine and useful. Streaks, scores, targets or leaderboards attached to weight, diet, calories or fasting duration are not — build none of them, and if a stakeholder asks, the answer is that a diagnostics platform inducing restrictive behaviour is a liability, not a growth loop.
5. **Suggest, never alarm.** Retest Radar copy is "worth discussing at your next visit". No red badges, no overdue framing, no countdown to a health event.
6. **Scoped consent is auditable.** Handoff QR, Guardian Link and Care Circle each write to `consent_records`, each show the patient exactly who has access, and each are revocable in one tap. Under DPDP 2023 this is required; as a product feature it's the thing that makes patients trust you with more.

### 11.2 Performance budgets — enforce in CI or they won't hold

| Budget | Target |
|---|---|
| Scroll on the slowest supported device | 60fps, no dropped frames on a 50-row list |
| Blur surfaces on screen | ≤ 2 (G2) + ≤ 1 (G3) |
| Blur inside a scrolling row | zero, always |
| Cold start to first paint | < 2.0s on mid-tier Android |
| Aurora | one Skia canvas per screen, UI thread only, zero JS per frame |
| Bundle size delta from Skia + MapLibre | measure it; budget 8MB, they are not free |

**Device-tier probe.** At boot, set `lowTierDevice = true` when `Platform.OS === 'android' && Platform.Version < 31`, or when `expo-device`'s `deviceYearClass` is below 2019, or when total memory is under 3GB. Feed it into `GlassProvider`. Every glass surface then degrades automatically and you never ship a jank complaint from a ₹9,000 phone.

### 11.3 Accessibility

| Setting | Behaviour |
|---|---|
| Reduce transparency | Whole app renders opaque and stays fully usable |
| Reduce motion | Aurora frozen, morphs become cross-fades, no pulsing |
| Text scaling to 200% | No clipped clinical values; test the passport and biomarker cards specifically |
| Contrast | ≥ 4.5:1 for body text measured against the **lightest** aurora frame, not the average |
| Colour | Never the sole signal — every status colour pairs with a label or icon |
| Touch targets | ≥ 48dp. Field staff use this wearing gloves |
| Screen reader | Every widget has a meaningful `accessibilityLabel`; the Omnibar announces ETA changes via `accessibilityLiveRegion` |

Test device floor: one iOS 26 device, one iOS 18 device, one Android 14 device, **one Android 11 device**. The Android 11 unit is not optional — it is the one that tells you whether the fallback path is good enough to ship.

---

## 12. Full roadmap

| Sprint | Work | Ships |
|---|---|---|
| **1** | Phase 0 platform unblock, package migrations, device-tier probe | Builds clean on SDK 56, all four migrations done |
| **2** | Phase 1 design system: tokens, `Glass`, aurora, fonts, M3 seeding | Scratch screen at 60fps on the Android 11 unit |
| **3** | Phase 2 shell, tab bar, Omnibar (pill → strip → sheet) | All 10 role groups on one shell |
| **4** | Phase 4 widget kit: all 10 primitives against mock data | Storybook-style gallery screen |
| **5** | Patient P0 parity + Phase 5 maps/tracking/heatmap | Patient app at web parity |
| **6** | Phlebotomist P0 parity + attendance takeover | Field roles at web parity |
| **7** | Processing Center + Supervisor groups (net-new mobile) | PC intake works on a phone |
| **8** | Admin / Pharmacy / Org / Doctor P1 + perf and a11y audit | Full parity, store submission |
| **9** | **Specimen Passport** (8.1) + **Prep Coach** (8.4) | First two differentiators, both small backend deltas |
| **10** | **Trust Handshake + Guardian Link** (8.2) + **Price Lock** (8.11) | The safety and honesty story |
| **11** | **Doctor Handoff QR** (8.3) + **Report in Your Voice** (8.6) | The ABDM investment becomes visible |
| **12** | **Health Weather** (8.8) + **Generic Savings** (8.7) + **Retest Radar** (8.9) | The retention loop |
| **13** | **Care Circle** (8.5) + **Offline Emergency Card** (8.10) | The family and safety net |
| **14+** | Native home-screen widgets, lock-screen emergency card, WidgetKit / Glance | Ambient presence |

Sprints 1–3 are one person's sequential work. From sprint 4 they parallelise. Sprints 9–13 each ship on web and app together.

### 12.1 Backend delta summary — the whole feature program

| Feature | New tables | New endpoints | Size |
|---|---|---|---|
| Specimen Passport | — | extend `/api/patient/samples/{id}/timeline` | S |
| Trust Handshake / Guardian Link | — | `POST /api/dispatch/track/{id}/share`, public `GET /api/track/{token}` | S–M |
| Doctor Handoff QR | — | `POST /api/v1/patient/handoff`, public `GET /api/v1/handoff/{token}` | M |
| Prep Coach | — | none | — |
| Care Circle | `care_circle_members` | invite / accept / revoke / scoped fan-out | M |
| Report in Your Voice | column `summary_translations` | `GET /api/reports/{id}/summary?lang=` | S |
| Generic Savings | — | `GET /api/v1/patient/savings` (+ store `branded_mrp` at order write) | S |
| Health Weather | — | none | — |
| Retest Radar | `biomarker_retest_rules` | `GET /api/v1/patient/retest-radar` | S–M |
| Offline Emergency Card | — | none (v1) | — |
| Nurse vitals (parity gap) | `nurse_visit_logs` | `POST /api/nurse/visits/{id}/vitals` | S |

Eleven features, two new tables, one new column. That is the point: the platform was already built for this.

---

## 13. Risks worth naming now

1. **iOS 26 adoption.** `GlassView` is iOS 26+. Your fallback path (BlurView) is what most users will see for another year, so tune and screenshot-review the fallback *first* and treat native Liquid Glass as the bonus tier, not the design target.
2. **Android blur is still the weak link.** The `BlurTargetView` model can only blur what's inside the target, and it breaks inside RN `<Modal>` (expo #44165). The architecture in `AppShell.tsx` works *with* that constraint. Don't "fix" it later by reaching for RN Modal.
3. **Glass versus clinical legibility.** This is the place I'd push back on a pure Gemini clone. Gemini is a chat app; a wrong-looking number there costs nothing. Keep aurora and glass in chrome and navigation, keep every clinical value on G4, and you get the aesthetic without inheriting the risk.
4. **Scope creep from The Ten.** Every one of them is genuinely buildable, and that is exactly the trap. Ship parity first (sprints 1–8). A beautiful app missing the phlebo wallet loses you collections; a plain app with Specimen Passport and no roster loses you phlebotomists. Order matters more than ambition.
5. **Consent surface area.** Handoff QR, Guardian Link and Care Circle each create a way for data to leave the patient's control. Each needs its token expiry, scope list, audit row and revocation built on day one — not retrofitted. Under DPDP the retrofit is a breach, not a backlog item.

---

## 14. Appendices

### 14.1 File tree from this document

```
mobile/
├── scripts/
│   └── sync-web-tokens.mjs              §3.13
├── src/
│   ├── theme/
│   │   ├── tokens.ts                    §3.7
│   │   └── GlassProvider.tsx            §3.8
│   ├── hooks/
│   │   └── useHealthWeather.ts          §9.4
│   └── components/
│       ├── glass/
│       │   ├── Glass.tsx                §3.9
│       │   ├── AuroraBackdrop.tsx       §3.10
│       │   ├── AppShell.tsx             §3.11
│       │   └── GlassTabBar.tsx          §3.12
│       ├── omnibar/
│       │   └── Omnibar.tsx              §4.2
│       └── widgets/
│           ├── SpecimenPassport.tsx     §9.1
│           ├── VitalsConstellation.tsx  §9.2  (spec)
│           ├── HoldToTrigger.tsx        §9.3
│           ├── HandoffQR.tsx            §9.5  (spec)
│           ├── PrepRing.tsx             §9.6  (spec)
│           ├── Odometer.tsx             §9.7  (spec)
│           └── kit/                     §6    StatusRail, LiveTrack, HeatLayer,
│                                              MetricTile, TrendSpark, Ledger,
│                                              ScanSheet, VerifyChecklist,
│                                              QueueList, RosterStrip
```

### 14.2 Package additions

```bash
npx expo install expo-glass-effect expo-blur expo-haptics expo-font expo-speech \
  expo-brightness expo-notifications expo-camera expo-secure-store \
  expo-local-authentication expo-device \
  @shopify/react-native-skia react-native-reanimated react-native-gesture-handler \
  react-native-svg @gorhom/bottom-sheet @maplibre/maplibre-react-native \
  @pchmn/expo-material3-theme react-native-qrcode-svg \
  @expo-google-fonts/inter @expo-google-fonts/inter-tight
```

### 14.3 The lint rule that keeps the system alive

```js
// .eslintrc.cjs — no ad-hoc translucent surfaces outside the glass primitives
'no-restricted-syntax': ['error', {
  selector:
    "Property[key.name='backgroundColor'] > Literal[value=/^(rgba|hsla)\\(/]",
  message:
    'Translucent surfaces must use <Glass tier="…">. See CALLMEDEX-LIQUID-HEALTH.md §3.2.',
}],
```

Pair it with a CI step running `node mobile/scripts/sync-web-tokens.mjs --check`.

### 14.4 Definition of done, per phase

| Phase | Done when |
|---|---|
| 0 | Boots on iOS 26, Android 14, Android 11; `expo-doctor` clean; all four migrations complete |
| 1 | Scratch screen: `AppShell` + 3 `Glass` cards + `GlassTabBar` at 60fps on the Android 11 unit; reduce-transparency renders a clean opaque app |
| 2 | All 10 role groups on one shell; zero direct `BlurView` imports outside `Glass.tsx`; Omnibar morphs both directions |
| 3 | Every row of the §5 parity tables closed or explicitly deferred with a reason |
| 4 | All 10 primitives render from mock data in a gallery screen; lint rule passing |
| 5 | Live tracking and heat map render from real `provider_locations` data |
| The Ten | Each ships app + web in the same sprint, with its consent/audit trail where applicable |

---

*End of spec. §1 is the part that matters most — build the layer, not the screens.*
