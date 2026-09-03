// mobile/src/components/widgets/HandoffQR.tsx
// Doctor Handoff QR code generator with 15-minute countdown timer and consented scopes.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §9.5

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { QrCode, Clock, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { Glass } from '../glass/Glass';

export interface HandoffQRProps {
  token: string;
  expiresInMinutes?: number;
  scopes?: string[];
  onRegenerate?: () => void;
}

export const HandoffQR: React.FC<HandoffQRProps> = ({
  token,
  expiresInMinutes = 15,
  scopes = ['vitals', 'medications', 'abnormal_biomarkers'],
  onRegenerate,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(expiresInMinutes * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [token]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isExpired = secondsLeft === 0;

  return (
    <Glass tier="G1" style={styles.container} specular>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShieldCheck size={16} color="#34d399" />
          <Text style={styles.title}>DOCTOR HANDOFF QR</Text>
        </View>
        <View
          style={[
            styles.timerBadge,
            isExpired && { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.4)' },
          ]}
        >
          <Clock size={12} color={isExpired ? '#f87171' : '#38bdf8'} />
          <Text style={[styles.timerText, isExpired && { color: '#f87171' }]}>
            {isExpired ? 'Expired' : formatTime(secondsLeft)}
          </Text>
        </View>
      </View>

      {/* QR Code Presentation (G4 Clinical Opaque Card) */}
      <Glass tier="G4" style={styles.qrCard} specular={false}>
        <View style={styles.qrPlaceholder}>
          <QrCode size={140} color="#f8fafc" />
        </View>
        <Text style={styles.qrPrompt}>Point clinic camera or scanner at this QR code</Text>
      </Glass>

      {/* Consented Scopes List */}
      <View style={styles.scopesSection}>
        <Text style={styles.scopesTitle}>CONSENTED OBSERVATION SCOPES</Text>
        <View style={styles.scopesChips}>
          {scopes.map((s, idx) => (
            <View key={idx} style={styles.scopeChip}>
              <Text style={styles.scopeChipText}>{s.replace('_', ' ').toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer Regenerate Action */}
      {onRegenerate && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onRegenerate}
          style={styles.regenerateBtn}
        >
          <RefreshCw size={14} color="#38bdf8" />
          <Text style={styles.regenerateText}>Regenerate New 15-Min Token</Text>
        </TouchableOpacity>
      )}
    </Glass>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 22,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(14,116,144,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
  },
  timerText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  qrCard: {
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  qrPlaceholder: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 12,
  },
  qrPrompt: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  scopesSection: {
    marginTop: 14,
  },
  scopesTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  scopesChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scopeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scopeChipText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  regenerateText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
});
