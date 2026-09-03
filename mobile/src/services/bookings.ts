/**
 * CallMedex Bookings API Service
 * Consumes: GET /api/bookings/my, POST /api/bookings, GET /api/bookings/slots,
 *           PATCH /api/bookings/{id}/status, GET /api/bookings/health-packages
 */
import { api } from './api';
import type {
  APIResponse,
  BookingCreate,
  BookingResponse,
  BookingStatus,
  SlotResponse,
  HealthPackageResponse,
} from '../types/api';

export const bookingsService = {
  /** Get current user's bookings */
  async getMyBookings(): Promise<BookingResponse[]> {
    const res = await api.get<APIResponse<BookingResponse[]>>('/api/bookings/my');
    return res.data ?? [];
  },

  /** Create a new booking */
  async createBooking(data: BookingCreate): Promise<BookingResponse> {
    const res = await api.post<APIResponse<BookingResponse>>('/api/bookings', data);
    return res.data as BookingResponse;
  },

  /** Get available slots for a provider */
  async getSlots(params: {
    provider_id?: string;
    provider_type?: string;
    date?: string;
    service_type?: string;
  }): Promise<SlotResponse[]> {
    const query = new URLSearchParams();
    if (params.provider_id) query.set('provider_id', params.provider_id);
    if (params.provider_type) query.set('provider_type', params.provider_type);
    if (params.date) query.set('date', params.date);
    if (params.service_type) query.set('service_type', params.service_type);
    const res = await api.get<APIResponse<SlotResponse[]>>(
      `/api/bookings/slots?${query.toString()}`
    );
    return res.data ?? [];
  },

  /** Update booking status (cancel, checkin, etc.) */
  async updateStatus(
    bookingId: string,
    status: BookingStatus,
    notes?: string
  ): Promise<void> {
    await api.patch(`/api/bookings/${bookingId}/status`, { status, notes });
  },

  /** Get health packages catalog */
  async getHealthPackages(): Promise<HealthPackageResponse[]> {
    const res = await api.get<APIResponse<HealthPackageResponse[]>>(
      '/api/bookings/health-packages'
    );
    return res.data ?? [];
  },

  /** Get organization bookings (for org role) */
  async getOrgBookings(orgId: string): Promise<BookingResponse[]> {
    const res = await api.get<APIResponse<BookingResponse[]>>(
      `/api/bookings/organization/${orgId}`
    );
    return res.data ?? [];
  },

  /** Check-in a patient at front desk */
  async checkinBooking(bookingId: string): Promise<void> {
    await api.patch(`/api/bookings/${bookingId}/checkin`);
  },
};
