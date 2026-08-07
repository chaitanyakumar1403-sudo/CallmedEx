'use client';

import React, { useState } from 'react';
import { useHealthMatrixStore } from '@/store/useHealthMatrixStore';
import { Activity, TrendingDown, ShieldCheck, Compass, LineChart, Heart, Zap } from 'lucide-react';

export const BiomarkerMatrix: React.FC = () => {
  const { biomarkers, selectedCode, setSelectedCode, riskScore } = useHealthMatrixStore();
  const [viewMode, setViewMode] = useState<'compass' | 'chart'>('compass');

  const availableCodes = Array.from(new Set(biomarkers.map((b) => b.observationCode)));
  const filteredData = biomarkers.filter((b) => b.observationCode === selectedCode);
  const activeObservationName = filteredData[0]?.observationName || selectedCode;
  const maxVal = Math.max(...filteredData.map((d) => d.valueNumber), 1);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        padding: 24,
        boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.05)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity style={{ width: 18, height: 18, color: '#059669' }} />
            Preventive Biomarker Matrix & Risk Projections
            <span style={{ backgroundColor: '#d1fae5', color: '#047857', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700 }}>
              AI Risk Engine
            </span>
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            5-year health trajectory analysis based on lab observations & ABDM history.
          </p>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 12, border: '1px solid #cbd5e1' }}>
          <button
            onClick={() => setViewMode('compass')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: viewMode === 'compass' ? '#0284c7' : 'transparent',
              color: viewMode === 'compass' ? '#fff' : '#64748b',
              transition: 'all 0.2s',
            }}
          >
            Risk Compass
          </button>
          <button
            onClick={() => setViewMode('chart')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: viewMode === 'chart' ? '#0284c7' : 'transparent',
              color: viewMode === 'chart' ? '#fff' : '#64748b',
              transition: 'all 0.2s',
            }}
          >
            Time-Series Trend
          </button>
        </div>
      </div>

      {!riskScore || biomarkers.length === 0 ? (
        <div style={{ padding: '24px', background: '#f8fafc', borderRadius: 14, border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
          <Activity style={{ width: 32, height: 32, color: '#94a3b8', margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155', marginBottom: 4 }}>No Lab Biomarkers Recorded Yet</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Book a diagnostic lab test to generate your 5-year AI health trajectory and risk projections.
          </div>
        </div>
      ) : viewMode === 'compass' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, alignItems: 'center' }}>
          {/* Health Index Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              padding: 20,
              borderRadius: 16,
              border: '1px solid #a7f3d0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Overall Health Index
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#065f46', margin: '4px 0' }}>
              {riskScore.overallScore} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#059669' }}>/ 100</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, color: '#047857', border: '1px solid #6ee7b7' }}>
              <ShieldCheck style={{ width: 14, height: 14 }} /> Optimal Trajectory
            </div>
          </div>

          {/* Subsystem Risk Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div style={{ background: '#fff', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Cardio Risk</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: 2 }}>{riskScore.cardiovascularRisk}%</div>
                <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600, marginTop: 2 }}>Low Risk</div>
              </div>

              <div style={{ background: '#fff', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Metabolic</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginTop: 2 }}>{riskScore.metabolicRisk}%</div>
                <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 600, marginTop: 2 }}>Mild Watch</div>
              </div>

              <div style={{ background: '#fff', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Inflammation</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7', marginTop: 2 }}>{riskScore.inflammationRisk}%</div>
                <div style={{ fontSize: '0.68rem', color: '#0284c7', fontWeight: 600, marginTop: 2 }}>Normal</div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#334155' }}>
              <strong style={{ color: '#0f172a' }}>AI Insight:</strong> {riskScore.summaryText}
            </div>
          </div>
        </div>
      ) : (
        /* Time-Series Trend View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {availableCodes.map((code) => (
              <button
                key={code}
                onClick={() => setSelectedCode(code)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: selectedCode === code ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: selectedCode === code ? '#e0f2fe' : '#fff',
                  color: selectedCode === code ? '#0369a1' : '#475569',
                  fontWeight: selectedCode === code ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {code}
              </button>
            ))}
          </div>

          <div style={{ background: '#fff', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{activeObservationName} Trend</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingDown style={{ width: 14, height: 14 }} /> Baseline Stable
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {filteredData.map((item, idx) => (
                <div key={idx} style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{item.recordedAt}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>
                    {item.valueNumber} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
