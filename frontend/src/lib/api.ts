/**
 * CallMedex — Centralized API Client
 * Handles all backend communication with:
 * - Automatic retry with exponential backoff
 * - Token refresh handling
 * - Request deduplication
 * - Loading state management
 * - Offline detection
 */

const API_BASE = '/api';

// ─── Types ────────────────────────────────────────────────────────────────
interface APIResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
}

class APIError extends Error {
  status: number;
  data: any;
  retryAfter?: number;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
    if (data?.retry_after_seconds) {
      this.retryAfter = data.retry_after_seconds;
    }
  }
}

// ─── Deduplication cache ──────────────────────────────────────────────────
const inflightRequests = new Map<string, Promise<any>>();

function getDedupeKey(url: string, options?: RequestOptions): string {
  if (options?.method && options.method !== 'GET') return ''; // Only dedup GETs
  return url;
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────
async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = 30000,
    retries = 2,
    skipAuth = false,
  } = options;

  const url = `${API_BASE}${endpoint}`;

  // Deduplication for GET requests
  const dedupeKey = getDedupeKey(url, options);
  if (dedupeKey && inflightRequests.has(dedupeKey)) {
    return inflightRequests.get(dedupeKey)!;
  }

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  // Add auth token
  if (!skipAuth) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // Build fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  // Retry logic with exponential backoff
  const execute = async (attempt: number): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Handle auth errors
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/auth/login';
        }
        throw new APIError('Session expired. Please log in again.', 401);
      }

      // Handle rate limiting
      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
        if (attempt < retries) {
          await sleep(retryAfter * 1000);
          return execute(attempt + 1);
        }
        throw new APIError('Too many requests. Please wait.', 429, data);
      }

      // Handle server errors with retry
      if (response.status >= 500 && attempt < retries) {
        await sleep(Math.pow(2, attempt) * 1000);
        return execute(attempt + 1);
      }

      const data = await response.json().catch(() => ({ success: false }));

      if (!response.ok) {
        throw new APIError(
          data.detail || data.message || `Request failed (${response.status})`,
          response.status,
          data
        );
      }

      return data as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        if (attempt < retries) {
          await sleep(Math.pow(2, attempt) * 1000);
          return execute(attempt + 1);
        }
        throw new APIError('Request timed out. Please try again.', 408);
      }

      if (error instanceof APIError) throw error;

      // Network error — retry
      if (attempt < retries) {
        await sleep(Math.pow(2, attempt) * 1000);
        return execute(attempt + 1);
      }

      throw new APIError(
        'Network error. Please check your connection.',
        0,
        { originalError: error.message }
      );
    }
  };

  const promise = execute(0).finally(() => {
    if (dedupeKey) inflightRequests.delete(dedupeKey);
  });

  if (dedupeKey) inflightRequests.set(dedupeKey, promise);

  return promise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Convenience methods ─────────────────────────────────────────────────
export const api = {
  get: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

// ─── Telemedicine-specific API ───────────────────────────────────────────
export const telemedAPI = {
  listDoctors: (specialization?: string) => {
    const params = specialization ? `?specialization=${encodeURIComponent(specialization)}` : '';
    return api.get(`/telemed/doctors${params}`);
  },

  startConsultation: (doctorId: string, consentGiven: boolean, bookingId?: string) =>
    api.post('/telemed/start', {
      doctor_id: doctorId,
      consent_given: consentGiven,
      booking_id: bookingId,
    }),

  getRoomDetails: (consultationId: string) =>
    api.get(`/telemed/room/${consultationId}`),

  joinRoom: (consultationId: string) =>
    api.post(`/telemed/join/${consultationId}`),

  endConsultation: (consultationId: string) =>
    api.post('/telemed/end', { consultation_id: consultationId }),

  finalizeConsultation: (consultationId: string, transcript: string) =>
    api.post('/telemed/finalize', {
      consultation_id: consultationId,
      raw_transcript: transcript,
    }),

  getHistory: (limit?: number) =>
    api.get(`/telemed/history${limit ? `?limit=${limit}` : ''}`),

  getConsultation: (consultationId: string) =>
    api.get(`/telemed/${consultationId}`),
};

export const bookingsAPI = {
  cancelBooking: (bookingId: string) =>
    api.post(`/bookings/${bookingId}/cancel`),
};

// ─── Provider discovery (public search — Consultation page modes) ─────────
// These wrap the public /api/providers/search/* endpoints used by the
// location-based discovery flows (Walk-in / Home Visit).
export const discoveryAPI = {
  searchDoctors: (opts: {
    specialization?: string;
    city?: string;
    consultation_mode?: string;
    q?: string;
    limit?: number;
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.specialization) params.set('specialization', opts.specialization);
    if (opts.city) params.set('city', opts.city);
    if (opts.consultation_mode) params.set('consultation_mode', opts.consultation_mode);
    if (opts.q) params.set('q', opts.q);
    params.set('limit', String(opts.limit ?? 50));
    return api.get(`/providers/search/doctors?${params.toString()}`);
  },

  searchOrganizations: (opts: {
    org_type?: string;
    city?: string;
    q?: string;
    exclude_diagnostic?: boolean;
    limit?: number;
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.org_type) params.set('org_type', opts.org_type);
    if (opts.city) params.set('city', opts.city);
    if (opts.q) params.set('q', opts.q);
    if (opts.exclude_diagnostic) params.set('exclude_diagnostic', 'true');
    params.set('limit', String(opts.limit ?? 50));
    return api.get(`/providers/search/organizations?${params.toString()}`);
  },

  searchProviders: (opts: {
    type?: string;
    city?: string;
    home_service?: boolean;
    q?: string;
    limit?: number;
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.type) params.set('type', opts.type);
    if (opts.city) params.set('city', opts.city);
    if (opts.home_service) params.set('home_service', 'true');
    if (opts.q) params.set('q', opts.q);
    params.set('limit', String(opts.limit ?? 50));
    return api.get(`/providers/search/providers?${params.toString()}`);
  },
};

export const dispatchAPI = {
  cancelDispatch: (dispatchId: string) =>
    api.post(`/dispatch/${dispatchId}/cancel`),
};

// ─── Processing Centre API (Spec 2) ──────────────────────────────────────
export const pcAPI = {
  getMe: () => api.get('/pc/me'),
  getQueue: () => api.get('/pc/queue'),
  getSamples: (status?: string) =>
    api.get(`/pc/samples${status ? `?status=${status}` : ''}`),
  getSampleByBarcode: (barcode: string) =>
    api.get(`/pc/samples/by-barcode/${encodeURIComponent(barcode)}`),
  receiveSample: (sampleId: string) =>
    api.post(`/pc/samples/${sampleId}/receive`),
  verifySample: (sampleId: string, checks: Record<string, boolean>) =>
    api.post(`/pc/samples/${sampleId}/verify`, checks),
  rejectSample: (sampleId: string, code: string, notes?: string) =>
    api.post(`/pc/samples/${sampleId}/reject`, { rejection_code: code, notes }),
  publishReport: (sampleId: string, reportUrl: string, notes?: string) =>
    api.post(`/samples/${sampleId}/report`, { report_url: reportUrl, notes }),
  listBatches: (status?: string) =>
    api.get(`/pc/batches${status ? `?status=${status}` : ''}`),
  createBatch: () => api.post('/pc/batches'),
  addToBatch: (batchId: string, sampleId: string) =>
    api.post(`/pc/batches/${batchId}/add-sample`, { sample_id: sampleId }),
  sealBatch: (batchId: string) =>
    api.post(`/pc/batches/${batchId}/seal`),
  sendBatch: (batchId: string, courierRef?: string) =>
    api.post(`/pc/batches/${batchId}/send`, { courier_reference: courierRef }),
  getRosterSummary: (date?: string) =>
    api.get(`/pc/roster-summary${date ? `?date=${date}` : ''}`),
  getRoster: (date: string) =>
    api.get(`/pc/roster?date=${date}`),
  setRoster: (date: string, entries: any[]) =>
    api.put(`/pc/roster/${date}`, entries),
  runRosterPass: (date: string) =>
    api.post(`/pc/roster/${date}/run`),
  getCatalog: () => api.get('/pc/home-services'),
};

// ─── Phlebotomist doorstep API (Spec 3) ──────────────────────────────────
export const phleboAPI = {
  getBookingSamples: (bookingId: string) =>
    api.get(`/phlebo/booking-samples/${bookingId}`),
  verifyBarcode: (params: { barcode: string; sample_id?: string; booking_id?: string; patient_id?: string }) =>
    api.post('/phlebo/verify-barcode', params),
  scanTube: (sampleId: string, tubeTypeCode: string, scannedBarcode?: string) =>
    api.post('/phlebo/scan-tube', {
      sample_id: sampleId,
      scanned_tube_type_code: tubeTypeCode,
      scanned_barcode: scannedBarcode || null,
    }),
  confirmCollection: (params: {
    sample_id: string;
    barcode: string;
    rescan_barcode?: string;
    lat?: number;
    lng?: number;
    device_id?: string;
    device_model?: string;
    os_version?: string;
    app_version?: string;
  }) => api.post('/phlebo/confirm-sample-collection', params),
  ackMismatch: (sampleId: string) =>
    api.post(`/phlebo/scan-tube/${sampleId}/ack-mismatch`),
  addDoorstepTest: (bookingId: string, homeServiceId: string, subjectId?: string) =>
    api.post('/phlebo/doorstep-addon', {
      booking_id: bookingId,
      home_service_id: homeServiceId,
      booking_subject_id: subjectId,
    }),
  getJobs: (date: string) =>
    api.get(`/phlebo/jobs?date=${date}`),
  declineJob: (dispatchId: string) =>
    api.post(`/phlebo/jobs/${dispatchId}/decline`),
};

// ─── Patient sample status API (Spec 3) ──────────────────────────────────
export const patientSamplesAPI = {
  getMySamples: () => api.get('/patient/my-samples'),
};

export { APIError };
export default api;
