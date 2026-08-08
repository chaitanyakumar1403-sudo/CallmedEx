'use client';

import React, { useState } from 'react';
import { useHealthMatrixStore } from '@/store/useHealthMatrixStore';
import { Activity, TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';

export const BiomarkerMatrix: React.FC = () => {
  const { biomarkers, selectedCode, setSelectedCode, riskScore } = useHealthMatrixStore();
  const [viewMode, setViewMode] = useState<'compass' | 'chart'>('compass');

  const availableCodes = Array.from(new Set(biomarkers.map((b) => b.observationCode)));
  const filteredData = biomarkers.filter((b) => b.observationCode === selectedCode);
  const activeObservationName = filteredData[0]?.observationName || selectedCode;
  const activeTrend = riskScore?.trends.find((t) => t.observationCode === selectedCode);

  return (
    <div className="cm-panel">
      <div className="cm-row-between" style={{ marginBottom: 'var(--cm-5)' }}>
        <div>
          <h3 className="cm-panel__title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--cm-2)' }}>
            <Activity className="cm-icon" size={18} style={{ color: 'var(--cm-done)' }} />
            Preventive Biomarker Matrix
          </h3>
          <p className="cm-panel__note" style={{ marginBottom: 0 }}>
            Lab observations on file. Clinical risk interpretation requires doctor review.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--cm-surface-3)', padding: 4, borderRadius: 'var(--cm-radius)' }}>
          <button
            type="button"
            className={`cm-btn cm-btn--sm ${viewMode === 'compass' ? 'cm-btn--primary' : 'cm-btn--ghost'}`}
            onClick={() => setViewMode('compass')}
          >
            Risk Compass
          </button>
          <button
            type="button"
            className={`cm-btn cm-btn--sm ${viewMode === 'chart' ? 'cm-btn--primary' : 'cm-btn--ghost'}`}
            onClick={() => setViewMode('chart')}
          >
            Time-Series Trend
          </button>
        </div>
      </div>

      {!riskScore || biomarkers.length === 0 ? (
        <div className="cm-empty">
          <span className="cm-empty__icon">
            <Activity size={22} />
          </span>
          <p className="cm-empty__title">No Lab Biomarkers Recorded Yet</p>
          <p className="cm-empty__body">
            Book a diagnostic lab test to start building your biomarker history and trend view.
          </p>
        </div>
      ) : viewMode === 'compass' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--cm-5)', alignItems: 'start' }}>
          <div className="cm-stat cm-stat--done" style={{ alignItems: 'center', textAlign: 'center' }}>
            <span className="cm-stat__label">Readings On File</span>
            <span className="cm-stat__value">{riskScore.totalReadings}</span>
            <span className="cm-pill cm-pill--done" style={{ marginTop: 'var(--cm-2)' }}>
              <FileText size={12} /> {riskScore.distinctBiomarkers} biomarker(s)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cm-3)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cm-2)' }}>
              {riskScore.trends.map((t) => (
                <div
                  key={t.observationCode}
                  className="cm-card"
                  style={{ padding: 'var(--cm-3) var(--cm-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 'var(--cm-text-sm)', fontWeight: 600, color: 'var(--cm-ink-2)' }}>{t.observationName}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--cm-2)' }}>
                    <span style={{ fontSize: 'var(--cm-text-sm)', fontWeight: 700, color: 'var(--cm-ink)' }}>{t.latestValue} {t.unit}</span>
                    {t.direction === 'up' && <TrendingUp size={14} style={{ color: 'var(--cm-waiting)' }} />}
                    {t.direction === 'down' && <TrendingDown size={14} style={{ color: 'var(--cm-done)' }} />}
                    {t.direction === 'flat' && <Minus size={14} style={{ color: 'var(--cm-ink-faint)' }} />}
                  </span>
                </div>
              ))}
            </div>

            <div className="cm-notes" style={{ marginTop: 0 }}>
              {riskScore.summaryText}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cm-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--cm-2)', overflowX: 'auto', paddingBottom: 4 }}>
            {availableCodes.map((code) => {
              const isSelected = selectedCode === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSelectedCode(code)}
                  className="cm-btn cm-btn--sm"
                  style={{
                    borderRadius: 'var(--cm-radius-pill)',
                    border: isSelected ? '2px solid var(--cm-navy)' : '1px solid var(--cm-line-strong)',
                    background: isSelected ? 'var(--cm-active-bg)' : 'var(--cm-surface)',
                    color: isSelected ? 'var(--cm-navy)' : 'var(--cm-ink-2)',
                  }}
                >
                  {code}
                </button>
              );
            })}
          </div>

          <div className="cm-card">
            <div className="cm-row-between" style={{ marginBottom: 'var(--cm-3)' }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--cm-text-base)', color: 'var(--cm-ink)' }}>{activeObservationName} Trend</span>
              <span className={`cm-pill ${activeTrend?.direction === 'up' ? 'cm-pill--waiting' : activeTrend?.direction === 'down' ? 'cm-pill--done' : 'cm-pill--halted'}`}>
                {activeTrend?.direction === 'up' && <TrendingUp size={12} />}
                {activeTrend?.direction === 'down' && <TrendingDown size={12} />}
                {(!activeTrend || activeTrend.direction === 'flat') && <Minus size={12} />}
                {activeTrend?.direction === 'up' ? 'Trending Up' : activeTrend?.direction === 'down' ? 'Trending Down' : 'Stable'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--cm-3)' }}>
              {filteredData.map((item, idx) => (
                <div key={idx} style={{ background: 'var(--cm-surface-2)', padding: 'var(--cm-3)', borderRadius: 'var(--cm-radius)', border: '1px solid var(--cm-line)', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--cm-text-xs)', color: 'var(--cm-ink-3)', fontWeight: 600 }}>{item.recordedAt}</div>
                  <div style={{ fontSize: 'var(--cm-text-lg)', fontWeight: 800, color: 'var(--cm-ink)', margin: '2px 0' }}>
                    {item.valueNumber} <span style={{ fontSize: 'var(--cm-text-xs)', fontWeight: 500, color: 'var(--cm-ink-3)' }}>{item.unit}</span>
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
