'use client';

import { useSyncExternalStore } from 'react';

export interface FamilyMemberContext {
  id: string;
  fullName: string;
  relationship: string;
  avatarUrl?: string;
  hasActiveAlert: boolean;
  alertCount: number;
  healthStatus: 'optimal' | 'attention' | 'critical';
}

export interface EmergencyContact {
  id: string;
  contactName: string;
  phone: string;
  relationship: string;
  isActive: boolean;
}

export interface MedicationItem {
  id: string;
  medicineName: string;
  dosage: string;
  totalPills: number;
  remainingPills: number;
  pillsPerDay: number;
  refillDate?: string;
}

export interface FamilyHubState {
  members: FamilyMemberContext[];
  activeMemberId: string;
  emergencyContacts: EmergencyContact[];
  medications: MedicationItem[];
  sosActive: boolean;
  sosCountdownSeconds: number;
  setActiveMemberId: (id: string) => void;
  setMembers: (members: FamilyMemberContext[]) => void;
  setEmergencyContacts: (contacts: EmergencyContact[]) => void;
  setMedications: (meds: MedicationItem[]) => void;
  triggerSOS: () => void;
  cancelSOS: () => void;
  decrementSOSCountdown: () => void;
}

let state: FamilyHubState = {
  members: [
    { id: 'self', fullName: 'Self (Account Owner)', relationship: 'Primary', hasActiveAlert: false, alertCount: 0, healthStatus: 'optimal' },
    { id: 'fam-1', fullName: 'Sita Sharma (Mother)', relationship: 'Mother', hasActiveAlert: true, alertCount: 1, healthStatus: 'attention' },
    { id: 'fam-2', fullName: 'Ramesh Sharma (Father)', relationship: 'Father', hasActiveAlert: false, alertCount: 0, healthStatus: 'optimal' },
  ],
  activeMemberId: 'self',
  emergencyContacts: [
    { id: 'c-1', contactName: 'Dr. Anita Roy', phone: '+919876543210', relationship: 'Primary Physician', isActive: true },
    { id: 'c-2', contactName: 'Rajesh Sharma', phone: '+919812345678', relationship: 'Brother', isActive: true },
  ],
  medications: [
    { id: 'm-1', medicineName: 'Metformin 500mg', dosage: '1 tablet twice daily after meals', totalPills: 60, remainingPills: 14, pillsPerDay: 2, refillDate: '2026-08-14' },
    { id: 'm-2', medicineName: 'Atorvastatin 10mg', dosage: '1 tablet at bedtime', totalPills: 30, remainingPills: 5, pillsPerDay: 1, refillDate: '2026-08-12' },
    { id: 'm-3', medicineName: 'Multivitamin Complex', dosage: '1 capsule daily morning', totalPills: 30, remainingPills: 22, pillsPerDay: 1, refillDate: '2026-08-29' },
  ],
  sosActive: false,
  sosCountdownSeconds: 5,
  setActiveMemberId: (id: string) => updateState({ activeMemberId: id }),
  setMembers: (members: FamilyMemberContext[]) => updateState({ members }),
  setEmergencyContacts: (contacts: EmergencyContact[]) => updateState({ emergencyContacts: contacts }),
  setMedications: (meds: MedicationItem[]) => updateState({ medications: meds }),
  triggerSOS: () => updateState({ sosActive: true, sosCountdownSeconds: 5 }),
  cancelSOS: () => updateState({ sosActive: false, sosCountdownSeconds: 5 }),
  decrementSOSCountdown: () => updateState({ sosCountdownSeconds: Math.max(0, state.sosCountdownSeconds - 1) }),
};

const listeners = new Set<() => void>();

function updateState(partial: Partial<FamilyHubState>) {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function useFamilyHubStore(): FamilyHubState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
