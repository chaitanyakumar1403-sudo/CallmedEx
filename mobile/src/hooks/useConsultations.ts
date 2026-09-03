/**
 * CallMedex — Consultation Hooks
 * React hooks for telemedicine doctor listing and consultation history with unmount safety.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { consultationService } from '../services/consultationApi';
import type { DoctorListing, ConsultationResponse } from '../types/api';

export function useDoctorList(params?: {
  specialization?: string;
  available_for_online?: boolean;
}) {
  const [doctors, setDoctors] = useState<DoctorListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const data = await consultationService.getDoctors(params);
      if (isMountedRef.current) {
        setDoctors(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load doctors');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [params?.specialization, params?.available_for_online]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { doctors, loading, error, refetch: fetch };
}

export function useConsultationHistory() {
  const [consultations, setConsultations] = useState<ConsultationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const data = await consultationService.getHistory();
      if (isMountedRef.current) {
        setConsultations(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load consultation history');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { consultations, loading, error, refetch: fetch };
}

export function useActiveConsultations() {
  const [consultations, setConsultations] = useState<ConsultationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const data = await consultationService.getActive();
      if (isMountedRef.current) {
        setConsultations(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load active consultations');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { consultations, loading, error, refetch: fetch };
}
