/**
 * CallMedex Authentication Context Provider
 * Manages active user identity, role, tokens, and hardware biometric states.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, UserProfile, SendOTPResponse } from '../services/auth';
import { storage } from '../services/storage';
import { biometricService } from '../services/biometrics';
import { notificationService } from '../services/notifications';
import { setLogoutHandler } from '../services/api';
import { logger } from '../utils/logger';

interface AuthContextType {
  user: UserProfile | null;
  role: string | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricAvailable: boolean;
  biometricType: string;
  isBiometricEnabled: boolean;
  loginEmail: (email: string, pass: string) => Promise<void>;
  sendPhoneOTP: (phone: string) => Promise<SendOTPResponse>;
  verifyPhoneOTP: (phone: string, otp: string, fullName?: string) => Promise<void>;
  loginWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');
  const [isBiometricEnabled, setIsBiometricEnabled] = useState<boolean>(false);

  useEffect(() => {
    // Register API logout interceptor
    setLogoutHandler(() => {
      handleLocalLogout();
    });

    initAuthSession();
  }, []);

  async function initAuthSession() {
    try {
      setIsLoading(true);
      // 1. Check Biometrics
      const bioInfo = await biometricService.checkBiometricAvailability();
      setBiometricAvailable(bioInfo.hasHardware && bioInfo.isEnrolled);
      setBiometricType(bioInfo.biometryType);

      const bioEnabled = await storage.getItem(storage.KEYS.BIOMETRIC_ENABLED);
      setIsBiometricEnabled(bioEnabled === 'true');

      // 2. Restore Token & User from Secure Storage
      const storedToken = await storage.getItem(storage.KEYS.ACCESS_TOKEN);
      const storedUserData = await storage.getItem(storage.KEYS.USER_DATA);
      const storedRole = await storage.getItem(storage.KEYS.ACTIVE_ROLE);

      if (storedToken && storedUserData) {
        try {
          const parsedUser = JSON.parse(storedUserData) as UserProfile;
          setUser(parsedUser);
          setRole(storedRole || parsedUser.role);
          setToken(storedToken);

          // Register push notifications
          notificationService.registerForPushNotificationsAsync().catch(console.warn);

          // Sync fresh profile in background
          authService.getCurrentUserProfile()
            .then((freshUser) => {
              setUser(freshUser);
              setRole(freshUser.role);
            })
            .catch(() => {});
        } catch {
          await storage.clearAll();
        }
      }
    } catch (e) {
      logger.error('Error restoring session:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function loginEmail(email: string, pass: string) {
    setIsLoading(true);
    try {
      const res = await authService.loginEmail(email, pass);
      setUser(res.user);
      setRole(res.user.role);
      setToken(res.access_token);
      notificationService.registerForPushNotificationsAsync().catch(console.warn);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendPhoneOTP(phone: string): Promise<SendOTPResponse> {
    return await authService.sendPhoneOTP(phone);
  }

  async function verifyPhoneOTP(phone: string, otp: string, fullName?: string) {
    setIsLoading(true);
    try {
      const res = await authService.verifyPhoneOTP(phone, otp, fullName);
      setUser(res.user);
      setRole(res.user.role);
      setToken(res.access_token);
      notificationService.registerForPushNotificationsAsync().catch(console.warn);
    } finally {
      setIsLoading(false);
    }
  }

  async function loginWithBiometrics(): Promise<boolean> {
    try {
      const res = await biometricService.performBiometricLogin();
      if (res) {
        setUser(res.user);
        setRole(res.user.role);
        setToken(res.access_token);
        notificationService.registerForPushNotificationsAsync().catch(console.warn);
        return true;
      }
      return false;
    } catch (e) {
      logger.error('Biometric login failed:', e);
      return false;
    }
  }

  async function enableBiometrics(): Promise<boolean> {
    const success = await biometricService.enableBiometrics();
    if (success) {
      setIsBiometricEnabled(true);
    }
    return success;
  }

  function handleLocalLogout() {
    setUser(null);
    setRole(null);
    setToken(null);
  }

  async function logout() {
    setIsLoading(true);
    try {
      await notificationService.unregisterDeviceToken();
      await authService.logout();
    } finally {
      handleLocalLogout();
      setIsLoading(false);
    }
  }

  async function refreshUser() {
    if (!token) return;
    try {
      const fresh = await authService.getCurrentUserProfile();
      setUser(fresh);
      setRole(fresh.role);
    } catch (e) {
      console.warn('Failed to refresh user profile:', e);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        biometricAvailable,
        biometricType,
        isBiometricEnabled,
        loginEmail,
        sendPhoneOTP,
        verifyPhoneOTP,
        loginWithBiometrics,
        enableBiometrics,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
