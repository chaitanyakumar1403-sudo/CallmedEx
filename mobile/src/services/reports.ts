/**
 * CallMedex Reports API Service
 * Consumes: /api/reports/ endpoints from ai_reports.py router
 */
import { api } from './api';
import type { APIResponse, ReportJob, BiomarkerHistory } from '../types/api';

export const reportsService = {
  /** Get patient's report history */
  async getMyReports(): Promise<ReportJob[]> {
    const res = await api.get<APIResponse<ReportJob[]>>('/api/reports/history');
    return res.data ?? (Array.isArray(res) ? res : []);
  },

  /** Get single report job with AI analysis */
  async getReportDetail(reportJobId: string): Promise<ReportJob> {
    const res = await api.get<APIResponse<ReportJob>>(
      `/api/reports/jobs/${reportJobId}`
    );
    return res.data as ReportJob;
  },

  /** Upload report for AI analysis (multipart) */
  async uploadReport(formData: FormData): Promise<{ job_id: string }> {
    const res = await api.post<APIResponse<{ job_id: string }>>(
      '/api/reports/analyze',
      undefined,
      {
        body: formData as any,
        headers: {
          // Let fetch set Content-Type with boundary for multipart
        } as any,
      }
    );
    return res.data as { job_id: string };
  },

  /** Get biomarker timeline data */
  async getBiomarkerHistory(markerName?: string): Promise<BiomarkerHistory[]> {
    const query = markerName ? `?marker=${encodeURIComponent(markerName)}` : '';
    const res = await api.get<APIResponse<BiomarkerHistory[]>>(
      `/api/v1/patient/biomarkers/matrix${query}`
    );
    return res.data ?? [];
  },
};
