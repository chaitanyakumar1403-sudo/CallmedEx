/**
 * CallMedex Push Notification Service (FCM + APNs)
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';
import { storage } from './storage';

// Configure foreground notification behavior
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export const notificationService = {
  /**
   * Request push notification permissions and register token with CallMedex backend
   */
  async registerForPushNotificationsAsync(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // 1. Check & Request Permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to obtain push notification permissions');
        return null;
      }

      // 2. Fetch Device Push Token
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const pushToken = tokenData.data;

      // 3. Setup Android Notification Channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('emergency_sos', {
          name: 'Emergency SOS & Dispatch',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250, 500, 500],
          lightColor: '#E63946',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('telemedicine', {
          name: 'Telemedicine Calls & Consultations',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('lab_reports', {
          name: 'Lab Reports & Test Results',
          importance: Notifications.AndroidImportance.DEFAULT,
        });

        await Notifications.setNotificationChannelAsync('appointments', {
          name: 'Appointment Reminders & Queue Updates',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      // 4. Save locally and register with backend
      await storage.setItem(storage.KEYS.PUSH_TOKEN, pushToken);
      
      try {
        await api.post('/api/notifications/register-device', {
          push_token: pushToken,
          platform: Platform.OS,
          device_name: Device.modelName || `${Platform.OS} Device`,
          app_version: Constants.expoConfig?.version || '1.0.0',
        });
      } catch (err) {
        console.warn('Device push token backend registration queued or skipped:', err);
      }

      return pushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  },

  /**
   * Unregister token on logout
   */
  async unregisterDeviceToken(): Promise<void> {
    const pushToken = await storage.getItem(storage.KEYS.PUSH_TOKEN);
    if (!pushToken) return;

    try {
      await api.delete('/api/notifications/unregister-device', { push_token: pushToken });
    } catch {
      // Best effort
    } finally {
      await storage.removeItem(storage.KEYS.PUSH_TOKEN);
    }
  },

  /**
   * Add listener for incoming notifications in foreground
   */
  addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  },

  /**
   * Add listener for when user taps on a notification
   */
  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },
};
