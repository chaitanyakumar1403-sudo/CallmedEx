/**
 * CallMedex Mobile Dynamic Environment Configuration
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type AppEnvironment = 'development' | 'staging' | 'production';

interface EnvironmentConfig {
  appEnv: AppEnvironment;
  apiBaseUrl: string;
  dailyDomain: string;
  razorpayKeyId: string;
  appName: string;
  version: string;
  bundleId: string;
  isProduction: boolean;
}

const resolveApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const extraUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (extraUrl) {
    return extraUrl;
  }

  // Local development host fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
};

const appEnv: AppEnvironment = (process.env.EXPO_PUBLIC_APP_ENV as AppEnvironment) || 'development';

export const ENV: EnvironmentConfig = {
  appEnv,
  apiBaseUrl: resolveApiBaseUrl(),
  dailyDomain: process.env.EXPO_PUBLIC_DAILY_DOMAIN || 'callmedex.daily.co',
  razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_callmedex',
  appName: 'CallMedex',
  version: Constants.expoConfig?.version || '1.0.0',
  bundleId: 'com.callmedex.app',
  isProduction: appEnv === 'production',
};
