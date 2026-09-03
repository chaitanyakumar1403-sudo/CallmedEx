/**
 * CallMedex Secure Storage Service
 * Uses Hardware Enclave / Keychain / Keystore via expo-secure-store
 */
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'callmedex_access_token',
  REFRESH_TOKEN: 'callmedex_refresh_token',
  USER_DATA: 'callmedex_user_data',
  ACTIVE_ROLE: 'callmedex_active_role',
  BIOMETRIC_DEVICE_ID: 'callmedex_biometric_device_id',
  BIOMETRIC_ENABLED: 'callmedex_biometric_enabled',
  PUSH_TOKEN: 'callmedex_push_token',
} as const;

// In-memory fallback for test environments or web
const memoryFallback: Record<string, string> = {};

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const SecureStore = await import('expo-secure-store');
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync(key, value);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      } else {
        memoryFallback[key] = value;
      }
    } catch (e) {
      memoryFallback[key] = value;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (await isSecureStoreAvailable()) {
        const SecureStore = await import('expo-secure-store');
        return await SecureStore.getItemAsync(key);
      } else if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      } else {
        return memoryFallback[key] || null;
      }
    } catch {
      return memoryFallback[key] || null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        const SecureStore = await import('expo-secure-store');
        await SecureStore.deleteItemAsync(key);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      delete memoryFallback[key];
    } catch {
      delete memoryFallback[key];
    }
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      this.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      this.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      this.removeItem(STORAGE_KEYS.USER_DATA),
      this.removeItem(STORAGE_KEYS.ACTIVE_ROLE),
    ]);
  },

  KEYS: STORAGE_KEYS,
};
