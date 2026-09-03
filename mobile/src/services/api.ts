/**
 * CallMedex Production Mobile API Client
 * Includes automatic Bearer token injection, 401 refresh token rotation,
 * conservative transient network retries for safe operations, and error handling.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storage } from './storage';
import { logger } from '../utils/logger';

function getDefaultBaseUrl(): string {
  if (__DEV__) {
    // Android emulator cannot access host localhost directly
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8000';
    }
    // iOS simulator & web browser dev mode
    return 'http://localhost:8000';
  }

  // Explicitly configured build-time URL (e.g. from EAS build secrets)
  const configuredUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (configuredUrl) {
    return configuredUrl;
  }

  // Authoritative Production API Gateway
  return 'https://api.callmedex.com';
}

export let API_BASE_URL = getDefaultBaseUrl();

export function setApiBaseUrl(url: string) {
  API_BASE_URL = url;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  ok: boolean;
}

// Token refresh queue management to prevent multiple simultaneous refresh calls
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function onTokenRefreshed(newToken: string | null) {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string | null) => void) {
  refreshSubscribers.push(callback);
}

// Logout listener callback
let logoutHandler: (() => void) | null = null;
export function setLogoutHandler(handler: () => void) {
  logoutHandler = handler;
}

async function executeRefreshToken(): Promise<string | null> {
  const currentRefreshToken = await storage.getItem(storage.KEYS.REFRESH_TOKEN);
  if (!currentRefreshToken) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: currentRefreshToken }),
    });

    if (!res.ok) {
      await storage.clearAll();
      if (logoutHandler) logoutHandler();
      return null;
    }

    const data = await res.json();
    if (data.access_token && data.refresh_token) {
      await storage.setItem(storage.KEYS.ACCESS_TOKEN, data.access_token);
      await storage.setItem(storage.KEYS.REFRESH_TOKEN, data.refresh_token);
      if (data.user) {
        await storage.setItem(storage.KEYS.USER_DATA, JSON.stringify(data.user));
      }
      return data.access_token;
    }
    return null;
  } catch (error) {
    await storage.clearAll();
    if (logoutHandler) logoutHandler();
    return null;
  }
}

/**
 * Execute a single HTTP request with abort timeout and token refresh handling.
 */
async function executeRequest<T = any>(
  url: string,
  options: RequestOptions,
  endpoint: string
): Promise<T> {
  const { skipAuth = false, timeoutMs = 25000, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await storage.getItem(storage.KEYS.ACCESS_TOKEN);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 401 Unauthorized by attempting a token refresh
    if (response.status === 401 && !skipAuth && !endpoint.includes('/api/auth/')) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newAccessToken = await executeRefreshToken();
        isRefreshing = false;
        onTokenRefreshed(newAccessToken);

        if (newAccessToken) {
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          response = await fetch(url, {
            ...fetchOptions,
            headers,
          });
        } else {
          throw new Error('Session expired. Please log in again.');
        }
      } else {
        // Wait for ongoing refresh
        const retryToken = await new Promise<string | null>((resolve) => {
          addRefreshSubscriber((token) => resolve(token));
        });

        if (retryToken) {
          headers['Authorization'] = `Bearer ${retryToken}`;
          response = await fetch(url, {
            ...fetchOptions,
            headers,
          });
        } else {
          throw new Error('Session expired. Please log in again.');
        }
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        const text = await response.text();
        if (text) errorMessage = text;
      }
      const error: any = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    // Parse JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return (await response.text()) as unknown as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeoutError: any = new Error('Request timed out. Please check your network connection.');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    throw error;
  }
}

/**
 * Main request wrapper with conservative retry logic for idempotent GET requests or transient 5xx errors.
 */
export async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  // Only retry idempotent read operations or if explicitly configured
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const maxRetries = options.maxRetries ?? (isIdempotent ? 2 : 0);

  let attempt = 0;
  while (true) {
    try {
      return await executeRequest<T>(url, options, endpoint);
    } catch (error: any) {
      attempt++;
      const isTransientStatus = error.status === 502 || error.status === 503 || error.status === 504;
      const isNetworkOrTimeout = error.isTimeout || error.message?.includes('network');
      const canRetry = isIdempotent && (isTransientStatus || isNetworkOrTimeout) && attempt <= maxRetries;

      if (!canRetry) {
        logger.error(`API Request failed [${method} ${endpoint}]:`, error.message);
        throw error;
      }

      // Exponential backoff with jitter: delay = base * 2^attempt + jitter
      const delayMs = Math.min(300 * Math.pow(2, attempt - 1) + Math.random() * 100, 2000);
      logger.info(`Retrying request [${method} ${endpoint}] (Attempt ${attempt}/${maxRetries}) after ${Math.round(delayMs)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),
};
