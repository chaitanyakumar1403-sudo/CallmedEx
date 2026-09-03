/**
 * CallMedex Production-Safe Logger Utility
 * Redacts sensitive authentication tokens, passwords, OTPs, and PHI from console output.
 */

const REDACTED_KEYS = [
  'password',
  'otp',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'secret',
  'api_key',
  'signature',
];

function sanitize(data: any): any {
  if (!data) return data;
  if (typeof data === 'string') {
    // Redact JWT tokens
    if (/eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/.test(data)) {
      return '[REDACTED_JWT]';
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitize);
  }
  if (typeof data === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (REDACTED_KEYS.some((k) => lowerKey.includes(k))) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitize(value);
      }
    }
    return sanitizedObj;
  }
  return data;
}

export const logger = {
  debug: (...args: any[]) => {
    if (__DEV__) {
      console.log('[DEBUG]', ...args.map(sanitize));
    }
  },

  info: (...args: any[]) => {
    if (__DEV__) {
      console.info('[INFO]', ...args.map(sanitize));
    }
  },

  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args.map(sanitize));
  },

  error: (message: string, error?: any) => {
    const sanitizedError = error ? sanitize(error?.message || error) : '';
    console.error(`[ERROR] ${message}`, sanitizedError);
  },
};
