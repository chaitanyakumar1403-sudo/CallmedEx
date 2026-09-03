/**
 * CallMedex Dispatch & Tracking API Service
 * Consumes: /api/dispatch/ endpoints from dispatch.py router
 */
import { api } from './api';
import type { APIResponse, DispatchTrackResponse, DispatchRequest } from '../types/api';

export const dispatchService = {
  /** Request a provider dispatch (phlebotomist, nurse, doctor, ambulance) */
  async requestDispatch(data: DispatchRequest): Promise<{ dispatch_id: string }> {
    const res = await api.post<APIResponse<{ dispatch_id: string }>>('/api/dispatch/request', data);
    return res.data as { dispatch_id: string };
  },

  /** Track a dispatch by ID */
  async trackDispatch(dispatchId: string): Promise<DispatchTrackResponse> {
    const res = await api.get<APIResponse<DispatchTrackResponse>>(
      `/api/dispatch/track/${dispatchId}`
    );
    return res.data as DispatchTrackResponse;
  },

  /** Get dispatch info for a specific booking */
  async getDispatchForBooking(bookingId: string): Promise<DispatchTrackResponse | null> {
    try {
      const res = await api.get<APIResponse<DispatchTrackResponse>>(
        `/api/dispatch/for-booking/${bookingId}`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  },

  /** Get nearby available providers */
  async getNearbyProviders(params: {
    lat: number;
    lng: number;
    provider_type: string;
    radius_km?: number;
  }): Promise<any[]> {
    const query = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      provider_type: params.provider_type,
    });
    if (params.radius_km) query.set('radius_km', String(params.radius_km));
    const res = await api.get<APIResponse>(`/api/dispatch/nearby?${query.toString()}`);
    return res.data ?? [];
  },

  /** Toggle provider online/offline status (for phlebo/nurse/doctor) */
  async toggleOnline(isOnline: boolean): Promise<void> {
    await api.post('/api/dispatch/toggle-online', { is_online: isOnline });
  },

  /** Update provider's live GPS location */
  async updateProviderLocation(lat: number, lng: number): Promise<void> {
    await api.post('/api/dispatch/location', { latitude: lat, longitude: lng });
  },

  /** Respond to a dispatch offer (accept/decline) */
  async respondToOffer(offerId: string, accepted: boolean): Promise<void> {
    await api.post(`/api/dispatch/respond/${offerId}`, { accepted });
  },

  /** Update dispatch status */
  async updateDispatchStatus(
    dispatchId: string,
    status: string,
    notes?: string
  ): Promise<void> {
    await api.post(`/api/dispatch/status/${dispatchId}`, { status, notes });
  },
};
