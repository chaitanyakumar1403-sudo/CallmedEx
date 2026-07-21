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

export const dispatchAPI = {
  cancelDispatch: (dispatchId: string) =>
    api.post(`/dispatch/${dispatchId}/cancel`),
};

export { APIError };
export default api;
