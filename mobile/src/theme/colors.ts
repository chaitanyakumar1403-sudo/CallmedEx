/**
 * CallMedex Healthcare Design System — Color Tokens
 * Aligned with Web Foundation design system tokens (foundation.css / CLARITY UNDER PRESSURE).
 */

export const colors = {
  // Brand Primaries (--cm-navy, --cm-navy-deep, --cm-navy-soft)
  primary: {
    DEFAULT: '#1a2b4a',      // Primary Medical Navy (--cm-navy)
    dark: '#0f1d33',         // Deep Navy (--cm-navy-deep)
    light: '#2a3d5e',        // Soft Navy (--cm-navy-soft)
    muted: '#E8F0FE',
  },
  accent: {
    DEFAULT: '#00D4B2',      // Clean Emerald Teal
    dark: '#00A88F',
    light: '#70EBD8',
    subtle: '#E6FAF7',
  },
  secondary: {
    DEFAULT: '#008080',      // Deep Clinical Teal
    dark: '#006666',
    light: '#20B2AA',
    subtle: '#F0FDF4',
  },

  // Semantic Status Colors (foundation.css escalation order)
  // --cm-urgent: reserved for priority dispatch and critical emergency
  urgent: {
    DEFAULT: '#d92020',
    light: '#fef2f2',
    line: '#fca5a5',
    text: '#d92020',
  },
  // --cm-active: in progress, en route
  active: {
    DEFAULT: '#0369a1',
    light: '#eff6ff',
    line: '#93c5fd',
    text: '#0369a1',
  },
  // --cm-done: completed, verified, received
  done: {
    DEFAULT: '#15803d',
    light: '#f0fdf4',
    line: '#86efac',
    text: '#15803d',
  },
  // --cm-waiting: pending action
  waiting: {
    DEFAULT: '#b45309',
    light: '#fffbeb',
    line: '#fcd34d',
    text: '#b45309',
  },
  // --cm-halted: cancelled, rejected, expired
  halted: {
    DEFAULT: '#57534e',
    light: '#fafaf9',
    line: '#d6d3d1',
    text: '#57534e',
  },

  // Aliases for compatibility
  danger: {
    DEFAULT: '#d92020',
    light: '#fef2f2',
    dark: '#991B1B',
    text: '#d92020',
  },
  success: {
    DEFAULT: '#15803d',
    light: '#f0fdf4',
    dark: '#065F46',
    text: '#15803d',
  },
  warning: {
    DEFAULT: '#b45309',
    light: '#fffbeb',
    dark: '#92400E',
    text: '#b45309',
  },
  info: {
    DEFAULT: '#0369a1',
    light: '#eff6ff',
    dark: '#1E40AF',
    text: '#0369a1',
  },

  // Role Color Tags
  roles: {
    patient: '#00D4B2',
    doctor: '#1a2b4a',
    phlebotomist: '#8B5CF6',
    organization: '#0369a1',
    pharmacy: '#EC4899',
    nurse: '#15803d',
    staff: '#6366F1',
    admin: '#d92020',
  },

  // Light Mode Surfaces (--cm-surface, --cm-surface-2, --cm-surface-3, --cm-ink)
  light: {
    background: '#F8FAFC',
    surface2: '#F8FAFC',
    surface3: '#F1F5F9',
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    divider: '#CBD5E1',
    inputBackground: '#FFFFFF',
    inputBorder: '#CBD5E1',
    bottomTabBackground: '#FFFFFF',
    headerBackground: '#1a2b4a',
    headerText: '#FFFFFF',
  },

  // Dark Mode Surfaces
  dark: {
    background: '#0B1320',
    surface2: '#111D30',
    surface3: '#152238',
    card: '#152238',
    cardElevated: '#1E2E4A',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#24344D',
    borderLight: '#1C293E',
    divider: '#334155',
    inputBackground: '#152238',
    inputBorder: '#334155',
    bottomTabBackground: '#0B1320',
    headerBackground: '#0f1d33',
    headerText: '#F8FAFC',
  },
};
