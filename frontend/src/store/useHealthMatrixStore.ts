import { create } from 'zustand';

export interface BiomarkerPoint {
  recordedAt: string;
  observationCode: string;
  observationName: string;
  valueNumber: number;
  unit: string;
}

export interface RiskCompassScore {
  cardiovascularRisk: number; // 0 - 100
  metabolicRisk: number;     // 0 - 100
  inflammationRisk: number;  // 0 - 100
  overallScore: number;       // 0 - 100 (100 is ideal health)
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

interface HealthMatrixState {
  biomarkers: BiomarkerPoint[];
  selectedCode: string;
  riskScore: RiskCompassScore;
  activeBriefing: DoctorBriefingData | null;
  isLoading: boolean;
  error: string | null;
  setSelectedCode: (code: string) => void;
  setBiomarkers: (data: BiomarkerPoint[]) => void;
  setRiskScore: (score: RiskCompassScore) => void;
  setActiveBriefing: (briefing: DoctorBriefingData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useHealthMatrixStore = create<HealthMatrixState>((set) => ({
  biomarkers: [
    { recordedAt: '2026-03-10', observationCode: 'HB', observationName: 'Hemoglobin', valueNumber: 13.5, unit: 'g/dL' },
    { recordedAt: '2026-05-15', observationCode: 'HB', observationName: 'Hemoglobin', valueNumber: 13.8, unit: 'g/dL' },
    { recordedAt: '2026-07-20', observationCode: 'HB', observationName: 'Hemoglobin', valueNumber: 14.1, unit: 'g/dL' },
    { recordedAt: '2026-03-10', observationCode: 'HBA1C', observationName: 'HbA1c', valueNumber: 5.6, unit: '%' },
    { recordedAt: '2026-05-15', observationCode: 'HBA1C', observationName: 'HbA1c', valueNumber: 5.8, unit: '%' },
    { recordedAt: '2026-07-20', observationCode: 'HBA1C', observationName: 'HbA1c', valueNumber: 5.7, unit: '%' },
    { recordedAt: '2026-03-10', observationCode: 'CHOL', observationName: 'Total Cholesterol', valueNumber: 195, unit: 'mg/dL' },
    { recordedAt: '2026-05-15', observationCode: 'CHOL', observationName: 'Total Cholesterol', valueNumber: 188, unit: 'mg/dL' },
    { recordedAt: '2026-07-20', observationCode: 'CHOL', observationName: 'Total Cholesterol', valueNumber: 182, unit: 'mg/dL' },
  ],
  selectedCode: 'HB',
  riskScore: {
    cardiovascularRisk: 18,
    metabolicRisk: 22,
    inflammationRisk: 14,
    overallScore: 88,
    summaryText: 'Low 5-year cardiovascular and metabolic risk profile. Preventive trajectory stable.',
  },
  activeBriefing: null,
  isLoading: false,
  error: null,
  setSelectedCode: (code) => set({ selectedCode: code }),
  setBiomarkers: (data) => set({ biomarkers: data }),
  setRiskScore: (score) => set({ riskScore: score }),
  setActiveBriefing: (briefing) => set({ activeBriefing: briefing }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error: error }),
}));
