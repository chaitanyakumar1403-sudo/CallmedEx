/**
 * CallMedex Authentication API Service
 * Supports Email/Password, MSG91 Phone OTP, Biometric Auth, and Refresh Tokens.
 */
import { api } from './api';
import { storage } from './storage';

export interface UserProfile {
  id: string;
  email?: string;
  mobile?: string;
  full_name: string;
  role: 'patient' | 'doctor' | 'phlebotomist' | 'organization' | 'pharmacy' | 'nurse' | 'staff' | 'admin';
  registration_status?: string;
  is_active?: boolean;
  avatar_url?: string;
  is_new_user?: boolean;
}

export interface AuthSessionResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
  phone: string;
  expires_in_minutes: number;
  dev_otp?: string;
}

export const authService = {
  /**
   * Request MSG91 SMS OTP for phone number
   */
  async sendPhoneOTP(phone: string): Promise<SendOTPResponse> {
    const res = await api.post<any>('/api/auth/otp/send', { phone }, { skipAuth: true });
    return res.data || res;
  },

  /**
   * Verify MSG91 SMS OTP and establish user session (handles auto-creation or headless claiming)
   */
  async verifyPhoneOTP(phone: string, otp: string, fullName?: string): Promise<AuthSessionResponse> {
    const res = await api.post<AuthSessionResponse>(
      '/api/auth/otp/verify',
      {
        phone,
        otp,
        full_name: fullName,
      },
      { skipAuth: true }
    );

    if (res.access_token && res.refresh_token) {
      await storage.setItem(storage.KEYS.ACCESS_TOKEN, res.access_token);
      await storage.setItem(storage.KEYS.REFRESH_TOKEN, res.refresh_token);
      await storage.setItem(storage.KEYS.USER_DATA, JSON.stringify(res.user));
      await storage.setItem(storage.KEYS.ACTIVE_ROLE, res.user.role);
    }

    return res;
  },

  /**
   * Traditional Email and Password login (returns access_token and refresh_token)
   */
  async loginEmail(email: string, password: string): Promise<AuthSessionResponse> {
    const res = await api.post<AuthSessionResponse>(
      '/api/auth/login',
      { email, password },
      { skipAuth: true }
    );

    if (res.access_token && res.refresh_token) {
      await storage.setItem(storage.KEYS.ACCESS_TOKEN, res.access_token);
      await storage.setItem(storage.KEYS.REFRESH_TOKEN, res.refresh_token);
      await storage.setItem(storage.KEYS.USER_DATA, JSON.stringify(res.user));
      await storage.setItem(storage.KEYS.ACTIVE_ROLE, res.user.role);
    }

    return res;
  },

  /**
   * User Registration for healthcare roles
   */
  async register(payload: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    mobile?: string;
    organization_name?: string;
    license_number?: string;
    specialization?: string;
  }): Promise<AuthSessionResponse> {
    const res = await api.post<AuthSessionResponse>('/api/auth/register', payload, {
      skipAuth: true,
    });

    if (res.access_token && res.refresh_token) {
      await storage.setItem(storage.KEYS.ACCESS_TOKEN, res.access_token);
      await storage.setItem(storage.KEYS.REFRESH_TOKEN, res.refresh_token);
      await storage.setItem(storage.KEYS.USER_DATA, JSON.stringify(res.user));
      await storage.setItem(storage.KEYS.ACTIVE_ROLE, res.user.role);
    }

    return res;
  },

  /**
   * Register device biometric key with backend
   */
  async registerBiometrics(payload: {
    device_id: string;
    public_key: string;
    platform: 'ios' | 'android';
    device_name?: string;
  }): Promise<{ success: boolean; message: string }> {
    return await api.post('/api/auth/biometric/register', payload);
  },

  /**
   * Request cryptographic challenge for biometric login
   */
  async getBiometricChallenge(deviceId: string): Promise<string> {
    const res = await api.post<{ challenge: string; device_id: string }>(
      '/api/auth/biometric/challenge',
      { device_id: deviceId },
      { skipAuth: true }
    );
    return res.challenge;
  },

  /**
   * Complete biometric login with signed challenge
   */
  async verifyBiometricLogin(payload: {
    device_id: string;
    challenge: string;
    signature: string;
  }): Promise<AuthSessionResponse> {
    const res = await api.post<AuthSessionResponse>(
      '/api/auth/biometric/verify',
      payload,
      { skipAuth: true }
    );

    if (res.access_token && res.refresh_token) {
      await storage.setItem(storage.KEYS.ACCESS_TOKEN, res.access_token);
      await storage.setItem(storage.KEYS.REFRESH_TOKEN, res.refresh_token);
      await storage.setItem(storage.KEYS.USER_DATA, JSON.stringify(res.user));
      await storage.setItem(storage.KEYS.ACTIVE_ROLE, res.user.role);
    }

    return res;
  },

  /**
   * Get Current User Profile from backend
   */
  async getCurrentUserProfile(): Promise<UserProfile> {
    const res = await api.get<any>('/api/auth/me');
    const user = res.user || res.data || res;
    await storage.setItem(storage.KEYS.USER_DATA, JSON.stringify(user));
    return user;
  },

  /**
   * Logout user, clear storage and invalidate session on server
   */
  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Best effort server logout
    } finally {
      await storage.clearAll();
    }
  },
};
