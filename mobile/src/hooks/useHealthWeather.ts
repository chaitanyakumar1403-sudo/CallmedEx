// mobile/src/hooks/useHealthWeather.ts
// Ambient biomarker weather status and atmospheric metaphor hook.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §9.4

import { useState, useEffect } from 'react';

export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'rainy' | 'stormy';

export interface HealthWeatherReport {
  condition: WeatherCondition;
  headline: string;
  narrative: string;
  colorAccent: string;
  biomarkersReviewed: number;
  anomaliesCount: number;
  lastUpdated: string;
}

export const useHealthWeather = (biomarkers: Array<{
  code: string;
  name: string;
  value: number;
  unit: string;
  isNormal?: boolean;
}> = []): HealthWeatherReport => {
  const [report, setReport] = useState<HealthWeatherReport>({
    condition: 'sunny',
    headline: 'Atmospheric Health: Clear Skies',
    narrative: 'All recent laboratory biomarkers and vitals indicate stable biological equilibrium.',
    colorAccent: '#38bdf8',
    biomarkersReviewed: 0,
    anomaliesCount: 0,
    lastUpdated: new Date().toISOString(),
  });

  useEffect(() => {
    if (!biomarkers || biomarkers.length === 0) {
      setReport({
        condition: 'sunny',
        headline: 'Clear Skies Ahead',
        narrative: 'No acute abnormal indicators detected. Continue regular hydration and medication routines.',
        colorAccent: '#38bdf8',
        biomarkersReviewed: 0,
        anomaliesCount: 0,
        lastUpdated: new Date().toISOString(),
      });
      return;
    }

    const abnormalCount = biomarkers.filter((b) => b.isNormal === false).length;

    let condition: WeatherCondition = 'sunny';
    let headline = 'Clear Skies';
    let narrative = 'All vital biomarkers within expected clinical boundaries.';
    let colorAccent = '#38bdf8';

    if (abnormalCount === 0) {
      condition = 'sunny';
      headline = 'Atmospheric Health: Clear Skies';
      narrative = 'Optimal equilibrium observed across all monitored metabolic and vital indicators.';
      colorAccent = '#38bdf8';
    } else if (abnormalCount === 1) {
      condition = 'partly_cloudy';
      headline = 'Mild Weather Shift';
      narrative = `One biomarker (${biomarkers.find(b => b.isNormal === false)?.name || 'observation'}) is slightly outside baseline. Worth discussing at your next routine follow-up.`;
      colorAccent = '#fbbf24';
    } else if (abnormalCount === 2) {
      condition = 'rainy';
      headline = 'Scattered Showers';
      narrative = 'Two readings warrant attention. Review active diet, hydration, and medication compliance.';
      colorAccent = '#f97316';
    } else {
      condition = 'stormy';
      headline = 'Clinical Storm Advisory';
      narrative = 'Multiple readings flagged outside reference ranges. Doctor consultation recommended today.';
      colorAccent = '#ef4444';
    }

    setReport({
      condition,
      headline,
      narrative,
      colorAccent,
      biomarkersReviewed: biomarkers.length,
      anomaliesCount: abnormalCount,
      lastUpdated: new Date().toISOString(),
    });
  }, [biomarkers]);

  return report;
};
