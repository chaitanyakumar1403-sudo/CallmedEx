/**
 * CallMedex Theme Provider
 * Supports system auto-detection and manual toggle between Light & Dark modes.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors } from '../theme/colors';
import { storage } from '../services/storage';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  themeColors: typeof colors.light & {
    primary: typeof colors.primary;
    accent: typeof colors.accent;
    secondary: typeof colors.secondary;
    urgent: typeof colors.urgent;
    active: typeof colors.active;
    done: typeof colors.done;
    waiting: typeof colors.waiting;
    halted: typeof colors.halted;
    danger: typeof colors.danger;
    success: typeof colors.success;
    warning: typeof colors.warning;
    info: typeof colors.info;
    roles: typeof colors.roles;
  };
}

const THEME_STORAGE_KEY = 'callmedex_theme_preference';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(systemColorScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    storage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setMode(stored);
      }
    });
  }, []);

  const toggleTheme = () => {
    const nextMode = mode === 'light' ? 'dark' : 'light';
    setMode(nextMode);
    storage.setItem(THEME_STORAGE_KEY, nextMode);
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
    storage.setItem(THEME_STORAGE_KEY, newMode);
  };

  const activeSurface = mode === 'dark' ? colors.dark : colors.light;

  const themeColors = {
    ...activeSurface,
    primary: colors.primary,
    accent: colors.accent,
    secondary: colors.secondary,
    urgent: colors.urgent,
    active: colors.active,
    done: colors.done,
    waiting: colors.waiting,
    halted: colors.halted,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    info: colors.info,
    roles: colors.roles,
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark: mode === 'dark',
        toggleTheme,
        setTheme,
        themeColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
