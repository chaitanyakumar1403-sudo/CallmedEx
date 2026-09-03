/**
 * CallMedex Native GPS Location & Emergency SOS Dispatch Service
 */
import * as Location from 'expo-location';
import { api } from './api';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  is_active: boolean;
}

export interface SOSTriggerResult {
  success: boolean;
  alert_id?: string;
  message: string;
  notified_contacts_count?: number;
}

let locationSubscription: Location.LocationSubscription | null = null;

export const locationService = {
  /**
   * Request GPS permission and fetch current precise coordinates
   */
  async getCurrentLocation(): Promise<Coordinates> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission is required for emergency SOS and doorstep tracking.');
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      heading: loc.coords.heading,
      speed: loc.coords.speed,
    };
  },

  /**
   * Start live GPS background/foreground tracking for on-duty providers
   */
  async startTracking(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    if (locationSubscription) {
      locationSubscription.remove();
    }

    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 50,
      },
      async (loc) => {
        try {
          await api.post('/api/dispatch/update-location', {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
          });
        } catch {
          // Silent ignore
        }
      }
    );
  },

  /**
   * Stop GPS tracking when going off duty
   */
  async stopTracking(): Promise<void> {
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }
  },

  /**
   * Reverse geocode coordinates to human-readable address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        return [addr.name, addr.street, addr.city, addr.region, addr.postalCode]
          .filter(Boolean)
          .join(', ');
      }
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch {
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  },

  /**
   * Trigger emergency SOS alert to CallMedex Dispatch Center and emergency contacts
   */
  async triggerSOS(notes?: string): Promise<SOSTriggerResult> {
    let lat: number | undefined;
    let lng: number | undefined;

    try {
      const coords = await this.getCurrentLocation();
      lat = coords.latitude;
      lng = coords.longitude;
    } catch {
      // Best effort - send without coords if GPS denied
    }

    return await api.post<SOSTriggerResult>('/api/v1/patient/sos/trigger', {
      lat,
      lng,
      notes: notes || 'Emergency SOS initiated from CallMedex Mobile App',
    });
  },

  /**
   * Fetch active emergency contacts for patient
   */
  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    const res = await api.get<{ success: boolean; contacts: EmergencyContact[] }>(
      '/api/v1/patient/sos/contacts'
    );
    return res.contacts || [];
  },

  /**
   * Add a new emergency contact
   */
  async addEmergencyContact(
    name: string,
    phone: string,
    relationship: string
  ): Promise<EmergencyContact> {
    return await api.post('/api/v1/patient/sos/contacts', {
      name,
      phone,
      relationship,
    });
  },
};
