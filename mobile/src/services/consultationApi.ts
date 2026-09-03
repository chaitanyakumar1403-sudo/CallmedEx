/**
 * CallMedex Telemedicine / Consultation API Service
 * Consumes: /api/telemed/ endpoints from telemedicine.py router
 */
import { api } from './api';
import type { APIResponse, DoctorListing, ConsultationResponse } from '../types/api';

export const consultationService = {
  /** Get list of available doctors */
  async getDoctors(params?: {
    specialization?: string;
    available_for_online?: boolean;
  }): Promise<DoctorListing[]> {
    const query = new URLSearchParams();
    if (params?.specialization) query.set('specialization', params.specialization);
    if (params?.available_for_online != null)
      query.set('available_for_online', String(params.available_for_online));
    const qs = query.toString();
    const res = await api.get<APIResponse<DoctorListing[]>>(
      `/api/telemed/doctors${qs ? `?${qs}` : ''}`
    );
    return res.data ?? (Array.isArray(res) ? res : []);
  },

  /** Start a new video consultation */
  async startConsultation(data: {
    doctor_id: string;
    patient_id?: string;
    consultation_type?: string;
    notes?: string;
  }): Promise<ConsultationResponse> {
    const res = await api.post<APIResponse<ConsultationResponse>>(
      '/api/telemed/start',
      data
    );
    return res.data as ConsultationResponse;
  },

  /** Get room info for a consultation */
  async getRoom(consultationId: string): Promise<{
    room_url: string;
    token: string;
  }> {
    return await api.get(`/api/telemed/room/${consultationId}`);
  },

  /** Join an existing consultation (get join token) */
  async joinConsultation(consultationId: string): Promise<{
    room_url: string;
    token: string;
  }> {
    return await api.post(`/api/telemed/join/${consultationId}`);
  },

  /** End an active consultation */
  async endConsultation(data: {
    consultation_id: string;
    notes?: string;
  }): Promise<void> {
    await api.post('/api/telemed/end', data);
  },

  /** Finalize consultation with prescription */
  async finalizeConsultation(data: {
    consultation_id: string;
    diagnosis: string;
    medications: Array<{
      name: string;
      generic_name?: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    notes?: string;
    follow_up_date?: string;
  }): Promise<void> {
    await api.post('/api/telemed/finalize', data);
  },

  /** Get consultation history */
  async getHistory(): Promise<ConsultationResponse[]> {
    const res = await api.get<APIResponse<ConsultationResponse[]>>('/api/telemed/history');
    return res.data ?? (Array.isArray(res) ? res : []);
  },

  /** Get active consultations */
  async getActive(): Promise<ConsultationResponse[]> {
    const res = await api.get<APIResponse<ConsultationResponse[]>>('/api/telemed/active');
    return res.data ?? (Array.isArray(res) ? res : []);
  },
};
