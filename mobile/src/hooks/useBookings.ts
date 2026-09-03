/**
 * CallMedex — Booking Hooks
 * React hooks for booking data fetching with loading/error states and unmount safety.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { bookingsService } from '../services/bookings';
import type { BookingResponse, BookingCreate, SlotResponse, HealthPackageResponse } from '../types/api';

export function useMyBookings() {
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
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
      const data = await bookingsService.getMyBookings();
      if (isMountedRef.current) {
        setBookings(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load bookings');
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

  return { bookings, loading, error, refetch: fetch };
}

export function useBookingSlots(
  providerId?: string,
  providerType?: string,
  date?: string,
  serviceType?: string
) {
  const [slots, setSlots] = useState<SlotResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (!providerId && !serviceType) return;
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const data = await bookingsService.getSlots({
        provider_id: providerId,
        provider_type: providerType,
        date,
        service_type: serviceType,
      });
      if (isMountedRef.current) {
        setSlots(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load slots');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [providerId, providerType, date, serviceType]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { slots, loading, error, refetch: fetch };
}

export function useCreateBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const createBooking = useCallback(async (data: BookingCreate) => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const result = await bookingsService.createBooking(data);
      return result;
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to create booking');
      }
      throw e;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  return { createBooking, loading, error };
}

export function useHealthPackages() {
  const [packages, setPackages] = useState<HealthPackageResponse[]>([]);
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
      const data = await bookingsService.getHealthPackages();
      if (isMountedRef.current) {
        setPackages(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load packages');
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

  return { packages, loading, error, refetch: fetch };
}
