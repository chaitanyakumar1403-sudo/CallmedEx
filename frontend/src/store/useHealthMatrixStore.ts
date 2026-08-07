'use client';

import { useSyncExternalStore } from 'react';

export interface BiomarkerPoint {
  recordedAt: string;
  observationCode: string;
  observationName: string;
  valueNumber: number;
  unit: string;
}

export interface RiskCompassScore {
  cardiovascularRisk: number;
  metabolicRisk: number;
  inflammationRisk: number;
  overallScore: number;
  summaryText: string;
}

export interface DoctorBriefingData {
  specialtyType: string;
  patientId: string;
  compiledAt: string;
  chiefAnomalies: string[];
  activeMedicationsCount: number;
  recentReportCount: number;
  riskSummary: string;
  recommendedFocusPoints: string[];
}

export interface HealthMatrixState {
  biomarkers: BiomarkerPoint[];
  selectedCode: string;
  riskScore: RiskCompassScore | null;
  activeBriefing: DoctorBriefingData | null;
  isLoading: boolean;
  error: string | null;
  setSelectedCode: (code: string) => void;
  setBiomarkers: (data: BiomarkerPoint[]) => void;
  setRiskScore: (score: RiskCompassScore | null) => void;
  setActiveBriefing: (briefing: DoctorBriefingData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

let state: HealthMatrixState = {
  biomarkers: [],
  selectedCode: '',
  riskScore: null,
  activeBriefing: null,
  isLoading: false,
  error: null,
  setSelectedCode: (code: string) => updateState({ selectedCode: code }),
  setBiomarkers: (data: BiomarkerPoint[]) => updateState({ biomarkers: data }),
  setRiskScore: (score: RiskCompassScore | null) => updateState({ riskScore: score }),
  setActiveBriefing: (briefing: DoctorBriefingData | null) => updateState({ activeBriefing: briefing }),
  setLoading: (loading: boolean) => updateState({ isLoading: loading }),
  setError: (err: string | null) => updateState({ error: err }),
};

const listeners = new Set<() => void>();

function updateState(partial: Partial<HealthMatrixState>) {
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

export const healthMatrixStore = {
  getState: () => state,
  setSelectedCode: (code: string) => updateState({ selectedCode: code }),
  setBiomarkers: (data: BiomarkerPoint[]) => updateState({ biomarkers: data }),
  setRiskScore: (score: RiskCompassScore | null) => updateState({ riskScore: score }),
};

export function useHealthMatrixStore(): HealthMatrixState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
