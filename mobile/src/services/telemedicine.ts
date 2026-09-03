/**
 * CallMedex Telemedicine Service (Daily.co Native & NMC 2026 Telehealth Compliant)
 */
import { api } from './api';

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification?: string;
  experience?: string;
  fee: number;
  rating?: number;
  available?: boolean;
}

export interface ConsultationSession {
  consultation_id: string;
  video_url: string;
  room_name: string;
  message?: string;
  status?: string;
}

export interface VideoCallControls {
  isMuted: boolean;
  isCameraOff: boolean;
  isFrontCamera: boolean;
  callDurationSeconds: number;
}

export const telemedicineService = {
  /**
   * List verified doctors available for video consultation
   */
  async listAvailableDoctors(specialization?: string): Promise<Doctor[]> {
    const query = specialization ? `?specialization=${encodeURIComponent(specialization)}` : '';
    const res = await api.get<{ success: boolean; doctors: Doctor[]; count: number }>(
      `/api/telemed/doctors${query}`
    );
    return res.doctors || [];
  },

  /**
   * Start consultation with NMC 2026 Digital Consent
   */
  async startConsultation(
    doctorId: string,
    bookingId?: string,
    consentGiven: boolean = true
  ): Promise<ConsultationSession> {
    return await api.post<ConsultationSession>('/api/telemed/start', {
      doctor_id: doctorId,
      booking_id: bookingId,
      consent_given: consentGiven,
    });
  },

  /**
   * Fetch video room details
   */
  async getRoomDetails(consultationId: string): Promise<any> {
    return await api.get(`/api/telemed/room/${consultationId}`);
  },

  /**
   * Finalize consultation and trigger AI prescription & clinical summary
   */
  async finalizeConsultation(consultationId: string, transcript: string): Promise<any> {
    return await api.post('/api/telemed/finalize', {
      consultation_id: consultationId,
      raw_transcript: transcript,
    });
  },

  /**
   * End ongoing consultation session
   */
  async endConsultation(consultationId: string): Promise<any> {
    return await api.post('/api/telemed/end', {
      consultation_id: consultationId,
    });
  },
};
