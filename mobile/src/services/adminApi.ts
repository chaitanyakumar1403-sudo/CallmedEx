/**
 * CallMedex Admin API Service
 * Consumes: /api/admin/ and /api/admin/verifications/ endpoints
 */
import { api } from './api';
import type {
  APIResponse,
  AdminMetrics,
  AdminUser,
  VerificationReview,
  UserRole,
} from '../types/api';

export const adminService = {
  /** Get platform-wide metrics */
  async getMetrics(): Promise<AdminMetrics> {
    const res = await api.get<APIResponse<AdminMetrics>>('/api/admin/metrics');
    return res.data as AdminMetrics;
  },

  /** Get paginated user list with optional filters */
  async getUsers(params?: {
    role?: UserRole;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const res = await api.get<APIResponse<AdminUser[]>>(
      `/api/admin/users${qs ? `?${qs}` : ''}`
    );
    return res.data ?? (Array.isArray(res) ? res : []);
  },

  /** Update a user (activate/deactivate/modify role) */
  async updateUser(
    userId: string,
    data: Partial<{ is_active: boolean; role: UserRole }>
  ): Promise<void> {
    await api.patch(`/api/admin/users/${userId}`, data);
  },

  /** Delete a user (admin only) */
  async deleteUser(userId: string): Promise<void> {
    await api.delete(`/api/admin/users/${userId}`);
  },

  /** Get pending provider verification reviews */
  async getVerifications(): Promise<VerificationReview[]> {
    const res = await api.get<APIResponse<VerificationReview[]>>(
      '/api/admin/verifications'
    );
    return res.data ?? (Array.isArray(res) ? res : []);
  },

  /** Approve or reject a verification */
  async decideVerification(
    reviewId: string,
    decision: 'approve' | 'reject',
    reason?: string
  ): Promise<void> {
    await api.post(`/api/admin/verifications/${reviewId}/decide`, {
      decision,
      reason,
    });
  },

  /** Get executive analytics */
  async getExecutiveAnalytics(): Promise<any> {
    return await api.get('/api/admin-analytics/executive');
  },

  /** Get live dashboard analytics */
  async getLiveAnalytics(): Promise<any> {
    return await api.get('/api/admin-analytics/live');
  },
};
