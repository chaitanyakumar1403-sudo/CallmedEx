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
  members: [],
  activeMemberId: 'self',
  emergencyContacts: [],
  medications: [],
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

export const familyHubStore = {
  getState: () => state,
  setMembers: (members: FamilyMemberContext[]) => updateState({ members }),
  setEmergencyContacts: (contacts: EmergencyContact[]) => updateState({ emergencyContacts: contacts }),
  setMedications: (meds: MedicationItem[]) => updateState({ medications: meds }),
};

export function useFamilyHubStore(): FamilyHubState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
