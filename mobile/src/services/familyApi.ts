/**
 * CallMedex Family Members API Service
 * Consumes: /api/family-members/ endpoints from family_members.py router
 */
import { api } from './api';
import type { APIResponse, FamilyMember, FamilyMemberCreate } from '../types/api';

export const familyService = {
  /** Get all family members for current user */
  async getFamilyMembers(): Promise<FamilyMember[]> {
    const res = await api.get<APIResponse<FamilyMember[]>>('/api/family-members');
    return res.data ?? (Array.isArray(res) ? res : []);
  },

  /** Add a new family member */
  async addFamilyMember(data: FamilyMemberCreate): Promise<FamilyMember> {
    const res = await api.post<APIResponse<FamilyMember>>('/api/family-members', data);
    return res.data as FamilyMember;
  },

  /** Update an existing family member */
  async updateFamilyMember(
    memberId: string,
    data: Partial<FamilyMemberCreate>
  ): Promise<FamilyMember> {
    const res = await api.patch<APIResponse<FamilyMember>>(
      `/api/family-members/${memberId}`,
      data
    );
    return res.data as FamilyMember;
  },

  /** Delete a family member */
  async deleteFamilyMember(memberId: string): Promise<void> {
    await api.delete(`/api/family-members/${memberId}`);
  },
};
