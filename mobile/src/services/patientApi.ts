/**
 * CallMedex Patient SOS & Medications API Service
 * Consumes: /api/v1/patient/ endpoints from patient_sos.py router
 */
import { api } from './api';
import type { APIResponse, SOSTriggerRequest, Medication } from '../types/api';

export const patientService = {
  /** Trigger emergency SOS with GPS coordinates */
  async triggerSOS(data: SOSTriggerRequest): Promise<{ sos_id: string }> {
    const res = await api.post<APIResponse<{ sos_id: string }>>(
      '/api/v1/patient/sos/trigger',
      data
    );
    return res.data as { sos_id: string };
  },

  /** Get emergency contacts */
  async getEmergencyContacts(): Promise<any[]> {
    const res = await api.get<APIResponse>('/api/v1/patient/sos/contacts');
    return res.data ?? [];
  },

  /** Get current medications */
  async getMedications(): Promise<Medication[]> {
    const res = await api.get<APIResponse<Medication[]>>('/api/v1/patient/medications');
    return res.data ?? [];
  },

  /** Add a medication */
  async addMedication(data: Omit<Medication, 'id'>): Promise<Medication> {
    const res = await api.post<APIResponse<Medication>>(
      '/api/v1/patient/medications',
      data
    );
    return res.data as Medication;
  },
};
