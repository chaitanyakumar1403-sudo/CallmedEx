/**
 * CallMedex — Family Members Hooks
 * React hooks for family member CRUD operations with unmount safety.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { familyService } from '../services/familyApi';
import type { FamilyMember, FamilyMemberCreate } from '../types/api';

export function useFamilyMembers() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
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
      const data = await familyService.getFamilyMembers();
      if (isMountedRef.current) {
        setMembers(data);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to load family members');
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

  const addMember = useCallback(
    async (data: FamilyMemberCreate) => {
      const newMember = await familyService.addFamilyMember(data);
      if (isMountedRef.current) {
        setMembers((prev) => [...prev, newMember]);
      }
      return newMember;
    },
    []
  );

  const updateMember = useCallback(
    async (memberId: string, data: Partial<FamilyMemberCreate>) => {
      const updated = await familyService.updateFamilyMember(memberId, data);
      if (isMountedRef.current) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? updated : m))
        );
      }
      return updated;
    },
    []
  );

  const deleteMember = useCallback(
    async (memberId: string) => {
      await familyService.deleteFamilyMember(memberId);
      if (isMountedRef.current) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      }
    },
    []
  );

  return {
    members,
    loading,
    error,
    refetch: fetch,
    addMember,
    updateMember,
    deleteMember,
  };
}
