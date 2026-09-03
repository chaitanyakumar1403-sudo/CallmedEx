// mobile/src/theme/GlassProvider.tsx
// Manages active role accent, glass performance degradation, and ambient lighting context.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §3.8

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { RoleAccents, RoleName } from './tokens';

interface GlassContextValue {
  activeRole: RoleName;
  setActiveRole: (role: RoleName) => void;
  roleAccent: (typeof RoleAccents)[RoleName];
  degradeGlass: boolean;
  highPerformance: boolean;
}

const GlassContext = createContext<GlassContextValue>({
  activeRole: 'patient',
  setActiveRole: () => {},
  roleAccent: RoleAccents.patient,
  degradeGlass: false,
  highPerformance: true,
});

export const GlassProvider: React.FC<{
  children: ReactNode;
  initialRole?: RoleName;
}> = ({ children, initialRole = 'patient' }) => {
  const [activeRole, setActiveRole] = useState<RoleName>(initialRole);
  const [degradeGlass, setDegradeGlass] = useState(false);
  const [highPerformance, setHighPerformance] = useState(true);

  useEffect(() => {
    // Probe device capability to ensure 60fps on Android low-tier devices (§3.3 & §3.8)
    const checkPerformanceTier = async () => {
      try {
        if (Platform.OS === 'android') {
          // Android SDK 31+ is required for native hardware blur
          const sdkInt = Platform.Version as number;
          const totalMem = Device.totalMemory || 4 * 1024 * 1024 * 1024; // bytes
          const isLowRam = totalMem < 3.5 * 1024 * 1024 * 1024; // < 3.5GB RAM
          
          if (sdkInt < 31 || isLowRam) {
            setDegradeGlass(true);
            setHighPerformance(false);
          }
        } else if (Platform.OS === 'web') {
          // Web supports CSS backdrop-filter directly
          setDegradeGlass(false);
          setHighPerformance(true);
        }
      } catch (e) {
        // Safe fallback: keep normal glass
      }
    };
    checkPerformanceTier();
  }, []);

  const roleAccent = RoleAccents[activeRole] || RoleAccents.patient;

  return (
    <GlassContext.Provider
      value={{
        activeRole,
        setActiveRole,
        roleAccent,
        degradeGlass,
        highPerformance,
      }}
    >
      {children}
    </GlassContext.Provider>
  );
};

export const useGlass = () => useContext(GlassContext);
