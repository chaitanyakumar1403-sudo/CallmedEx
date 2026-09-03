import { Platform, TextStyle } from 'react-native';

const platformFont = Platform.select({
  web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  fontFamily: {
    regular: platformFont,
    medium: platformFont,
    semibold: platformFont,
    bold: platformFont,
    heavy: platformFont,
  },
  fontSize: {
    hero: 36,        // --cm-text-3xl (2.25rem / 36px)
    h1: 28,          // --cm-text-2xl (1.75rem / 28px)
    h2: 22,          // --cm-text-xl (1.375rem / 22px)
    h3: 18,          // --cm-text-lg (1.125rem / 18px)
    bodyLarge: 16,   // --cm-text-base (1rem / 16px)
    body: 14,        // --cm-text-sm (0.875rem / 14px)
    caption: 12,     // --cm-text-xs (0.75rem / 12px)
    tiny: 10,
  },
  lineHeight: {
    hero: 42,
    h1: 34,
    h2: 28,
    h3: 24,
    bodyLarge: 22,
    body: 20,
    caption: 16,
    tiny: 14,
  },
  fontWeight: {
    regular: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
    heavy: '800' as TextStyle['fontWeight'],
  },
};
