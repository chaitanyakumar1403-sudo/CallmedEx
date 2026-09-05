/**
 * CallMedex — Auth Hook
 * React hook for auth state management with:
 * - Persistent state from localStorage
 * - Auto-redirect on token expiry
 * - Role-based access helpers
 * - Login/logout utilities
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, refreshAccessToken } from './sessionKeeper';

interface User {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  role: string;
  city?: string;
  gender?: string;
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface UseAuthReturn extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  getDashboardPath: () => string;
  requireAuth: (allowedRoles?: string[]) => boolean;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const router = useRouter();

  // Load auth state from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const expiresAt = localStorage.getItem('token_expires_at');

      // An expired ACCESS token is not an expired session — the refresh
      // token outlives it by days. Tearing the session down here logged
      // people out mid-task an hour after login; hand it to the refresh
      // flow instead and only drop the session if that fails.
      const refreshToken = localStorage.getItem('refresh_token');
      if (expiresAt && Date.now() > parseInt(expiresAt, 10)) {
        if (!refreshToken) {
          clearSession();
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }
        refreshAccessToken().then((fresh) => {
          if (!fresh) {
            clearSession();
            setState((prev) => ({ ...prev, isLoading: false }));
            return;
          }
          const stored = localStorage.getItem('user');
          setState({
            user: stored ? JSON.parse(stored) : null,
            token: fresh,
            isAuthenticated: true,
            isLoading: false,
          });
        });
        return;
      }

      if (token && userStr) {
        const user = JSON.parse(userStr);
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('token_expires_at');
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    router.push('/auth/login');
  }, [router]);

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!state.user) return false;
      return roles.includes(state.user.role);
    },
    [state.user]
  );

  const getDashboardPath = useCallback(() => {
    if (!state.user) return '/';
    const slug = state.user.role === 'processing_center' ? 'processing-center' : state.user.role;
    return `/dashboard/${slug}`;
  }, [state.user]);

  const requireAuth = useCallback(
    (allowedRoles?: string[]) => {
      if (state.isLoading) return false;

      if (!state.isAuthenticated) {
        router.push('/auth/login');
        return false;
      }

      if (allowedRoles && state.user && !allowedRoles.includes(state.user.role)) {
        router.push(getDashboardPath());
        return false;
      }

      return true;
    },
    [state.isLoading, state.isAuthenticated, state.user, router, getDashboardPath]
  );

  return {
    ...state,
    login,
    logout,
    hasRole,
    getDashboardPath,
    requireAuth,
  };
}

export default useAuth;
