/**
 * CallMedex Spatial Grid System
 * Aligned with Web foundation.css (--cm-1 through --cm-12, 44px tap target, 16px card radius)
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,

  // Web 4px Foundation scale mapping
  cm1: 4,
  cm2: 8,
  cm3: 12,
  cm4: 16,
  cm5: 20,
  cm6: 24,
  cm8: 32,
  cm10: 40,
  cm12: 48,

  // Healthcare Layout Constants
  screenPaddingHorizontal: 16,
  screenPaddingVertical: 16,
  cardPadding: 16,
  cardRadius: 16,        // Aligned with Web --cm-radius-lg: 16px
  cardRadiusSm: 10,      // Aligned with Web --cm-radius: 10px
  buttonRadius: 10,      // Aligned with Web --cm-radius: 10px
  pillRadius: 999,       // Aligned with Web --cm-radius-pill: 999px
  minTapTarget: 44,      // Aligned with Web --cm-tap: 44px (WCAG 2.5.5)
  headerHeight: 56,
  bottomBarHeight: 64,
  sosButtonSize: 68,
};
