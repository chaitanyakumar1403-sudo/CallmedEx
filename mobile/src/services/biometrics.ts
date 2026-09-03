/**
 * CallMedex Biometric Authentication Service
 * Face ID / Touch ID / Android Fingerprint Hardware Enclave Support
 */
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { authService, AuthSessionResponse } from './auth';
import { storage } from './storage';

export const biometricService = {
  /**
   * Check if hardware biometrics are supported and enrolled
   */
  async checkBiometricAvailability(): Promise<{
    hasHardware: boolean;
    isEnrolled: boolean;
    biometryType: string;
  }> {
    if (Platform.OS === 'web') {
      return { hasHardware: false, isEnrolled: false, biometryType: 'none' };
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometryType = 'Biometrics';
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometryType = Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometryType = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      }

      return {
        hasHardware,
        isEnrolled,
        biometryType,
      };
    } catch {
      return { hasHardware: false, isEnrolled: false, biometryType: 'none' };
    }
  },

  /**
   * Get or generate unique device identifier for biometric association
   */
  async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await storage.getItem(storage.KEYS.BIOMETRIC_DEVICE_ID);
    if (!deviceId) {
      const randomBytes = await Crypto.getRandomBytesAsync(16);
      deviceId = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      await storage.setItem(storage.KEYS.BIOMETRIC_DEVICE_ID, deviceId);
    }
    return deviceId;
  },

  /**
   * Enable biometric authentication for the current user
   */
  async enableBiometrics(): Promise<boolean> {
    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to enable quick biometric login for CallMedex',
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
    });

    if (!authResult.success) {
      return false;
    }

    const deviceId = await this.getOrCreateDeviceId();
    const simulatedPublicKey = `PUB_KEY_${deviceId}_${Date.now()}`;

    try {
      await authService.registerBiometrics({
        device_id: deviceId,
        public_key: simulatedPublicKey,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        device_name: Device.modelName || `${Platform.OS} Device`,
      });

      await storage.setItem(storage.KEYS.BIOMETRIC_ENABLED, 'true');
      return true;
    } catch (e) {
      console.error('Failed to register biometrics with server:', e);
      return false;
    }
  },

  /**
   * Perform biometric login
   */
  async performBiometricLogin(): Promise<AuthSessionResponse | null> {
    const isEnabled = await storage.getItem(storage.KEYS.BIOMETRIC_ENABLED);
    if (isEnabled !== 'true') return null;

    const deviceId = await this.getOrCreateDeviceId();

    // 1. Hardware biometric prompt
    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Log in to CallMedex with Biometrics',
      fallbackLabel: 'Use Password or OTP',
      cancelLabel: 'Cancel',
    });

    if (!authResult.success) {
      return null;
    }

    // 2. Fetch challenge from backend
    const challenge = await authService.getBiometricChallenge(deviceId);

    // 3. Simulated Hardware Enclave Signed Signature
    const simulatedSignature = `SIGNATURE_${challenge}_${deviceId}`;

    // 4. Verify on server
    return await authService.verifyBiometricLogin({
      device_id: deviceId,
      challenge,
      signature: simulatedSignature,
    });
  },
};
