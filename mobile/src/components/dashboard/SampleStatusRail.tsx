import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Pill } from '../ui/Pill';

export interface SampleItem {
  id: string;
  tube_name: string;
  barcode?: string;
  cap_colour?: string;
  test_names?: string[];
  step?: number;          // 0 to 4
  stage?: string;         // "rejected" | other
  step_label?: string;
}

interface SampleStatusRailProps {
  samples?: SampleItem[];
}

const STEPS = [
  { label: 'Pending', icon: '⏳' },
  { label: 'Collected', icon: '🧪' },
  { label: 'In Transit', icon: '🚚' },
  { label: 'Verified', icon: '🛡️' },
  { label: 'Sent to Lab', icon: '🔬' },
];

const TUBE_COLOURS: Record<string, string> = {
  lavender: '#9b59b6',
  gold: '#f39c12',
  blue: '#3498db',
  grey: '#95a5a6',
  red: '#e74c3c',
  green: '#2ecc71',
  yellow: '#f1c40f',
};

export const SampleStatusRail: React.FC<SampleStatusRailProps> = ({
  samples = [],
}) => {
  const { themeColors } = useTheme();

  if (samples.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🧪</Text>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          Live Sample Tracking
        </Text>
      </View>

      {samples.map((sample) => {
        const isRejected = sample.stage === 'rejected';
        const currentStep = isRejected ? -1 : (sample.step ?? 0);
        const capColor = TUBE_COLOURS[(sample.cap_colour || '').toLowerCase()] || '#94a3b8';

        return (
          <View
            key={sample.id}
            style={[
              styles.sampleCard,
              {
                backgroundColor: themeColors.surface2 || '#f8fafc',
                borderLeftColor: isRejected ? '#dc2626' : capColor,
              },
            ]}
          >
            {/* Tube info header */}
            <View style={styles.tubeInfoRow}>
              <View style={styles.tubeNameRow}>
                <View style={[styles.capDot, { backgroundColor: capColor }]} />
                <Text style={[styles.tubeName, { color: themeColors.textPrimary }]}>
                  {sample.tube_name || 'Standard Vacutainer'}
                </Text>
                {sample.barcode && (
                  <Text style={[styles.barcode, { color: themeColors.textMuted }]}>
                    {sample.barcode}
                  </Text>
                )}
              </View>

              {sample.test_names && (
                <View style={styles.testsWrap}>
                  {sample.test_names.slice(0, 2).map((t, idx) => (
                    <Pill key={idx} label={t} variant="active" style={{ marginLeft: 4 }} />
                  ))}
                </View>
              )}
            </View>

            {/* Stepper */}
            {isRejected ? (
              <View style={styles.rejectedBanner}>
                <Text style={styles.rejectedText}>❌ Sample Rejected — Recollection Scheduled</Text>
              </View>
            ) : (
              <View style={styles.stepperContainer}>
                {STEPS.map((step, idx) => {
                  const done = currentStep > idx;
                  const active = currentStep === idx;

                  return (
                    <React.Fragment key={idx}>
                      <View style={styles.stepItem}>
                        <View
                          style={[
                            styles.stepDot,
                            {
                              backgroundColor: done ? '#15803d' : active ? '#1a2b4a' : '#e2e8f0',
                              borderColor: active ? '#00D4B2' : 'transparent',
                              borderWidth: active ? 2 : 0,
                            },
                          ]}
                        >
                          <Text style={[styles.stepIcon, { color: done || active ? '#fff' : '#94a3b8' }]}>
                            {done ? '✓' : step.icon}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.stepLabel,
                            {
                              color: done ? '#15803d' : active ? themeColors.textPrimary : themeColors.textMuted,
                              fontWeight: active ? '700' : '500',
                            },
                          ]}
                        >
                          {step.label}
                        </Text>
                      </View>

                      {idx < STEPS.length - 1 && (
                        <View
                          style={[
                            styles.connector,
                            { backgroundColor: currentStep > idx ? '#15803d' : '#e2e8f0' },
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            )}

            {/* Label */}
            {!isRejected && (
              <Text style={[styles.statusLabel, { color: currentStep >= 4 ? '#15803d' : '#1a2b4a' }]}>
                {sample.step_label || (currentStep >= 4 ? 'Results In Progress' : 'Sample in Clinical Pipeline')}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  sampleCard: {
    padding: spacing.md,
    borderRadius: spacing.cardRadiusSm,
    borderLeftWidth: 4,
    marginBottom: spacing.xs,
  },
  tubeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  tubeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  tubeName: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  barcode: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginLeft: 6,
  },
  testsWrap: {
    flexDirection: 'row',
  },
  rejectedBanner: {
    backgroundColor: '#fef2f2',
    padding: spacing.sm,
    borderRadius: 6,
  },
  rejectedText: {
    color: '#d92020',
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIcon: {
    fontSize: 11,
  },
  stepLabel: {
    fontSize: 8,
    marginTop: 4,
    textAlign: 'center',
  },
  connector: {
    height: 2,
    flex: 1,
    marginBottom: 12,
  },
  statusLabel: {
    textAlign: 'center',
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
  },
});
