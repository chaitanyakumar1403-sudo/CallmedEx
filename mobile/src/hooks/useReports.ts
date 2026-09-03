/**
 * CallMedex — Reports Hooks
 * React hooks for medical report data fetching with unmount safety.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { reportsService } from '../services/reports';
import type { ReportJob } from '../types/api';

export function useMyReports() {
  const [reports, setReports] = useState<ReportJob[]>([]);
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
      const data = await reportsService.getMyReports();
      if (isMountedRef.current) {
        setReports(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load reports');
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

  return { reports, loading, error, refetch: fetch };
}

export function useReportDetail(reportJobId: string | undefined) {
  const [report, setReport] = useState<ReportJob | null>(null);
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
    if (!reportJobId) return;
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const data = await reportsService.getReportDetail(reportJobId);
      if (isMountedRef.current) {
        setReport(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load report');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [reportJobId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { report, loading, error, refetch: fetch };
}
