import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Pill } from '../ui/Pill';

interface PhleboPerformanceCardProps {
  completedMonthCount?: number;
  onTimeRate?: number;
  integrityRate?: number;
  averageRating?: number;
}

export const PhleboPerformanceCard: React.FC<PhleboPerformanceCardProps> = ({
  completedMonthCount = 42,
  onTimeRate = 98.6,
  integrityRate = 100,
  averageRating = 4.9,
}) => {
  const { themeColors } = useTheme();

  // Generate 30 mock activity dots for heatmap visualization
  const activityDots = Array.from({ length: 30 }, (_, i) => {
    const intensity = (i * 7 + 3) % 4; // 0=none, 1=low, 2=med, 3=high
    return intensity;
  });

  const getDotColor = (intensity: number) => {
    switch (intensity) {
      case 3:
        return '#15803d'; // High
      case 2:
        return '#22c55e'; // Medium
      case 1:
        return '#86efac'; // Low
      default:
        return '#e2e8f0'; // Rest day
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.titleIcon}>📊</Text>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              Collection Quality & Activity Radar
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            NABL Cold-Chain & SLA Compliance Score
          </Text>
        </View>
        <Pill label={`⭐ ${averageRating.toFixed(1)}`} variant="teal" />
      </View>

      {/* Metric Cards Grid */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricBox, { backgroundColor: themeColors.surface2 || '#f8fafc', borderColor: themeColors.border }]}>
          <Text style={[styles.metricLabel, { color: themeColors.textSecondary }]}>This Month</Text>
          <Text style={[styles.metricValue, { color: themeColors.textPrimary }]}>{completedMonthCount}</Text>
          <Text style={styles.metricSub}>Samples Collected</Text>
        </View>

        <View style={[styles.metricBox, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
          <Text style={[styles.metricLabel, { color: '#15803d' }]}>On-Time SLA</Text>
          <Text style={[styles.metricValue, { color: '#15803d' }]}>{onTimeRate}%</Text>
          <Text style={[styles.metricSub, { color: '#166534' }]}>Within ETA Window</Text>
        </View>

        <View style={[styles.metricBox, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}>
          <Text style={[styles.metricLabel, { color: '#0369a1' }]}>Sample Integrity</Text>
          <Text style={[styles.metricValue, { color: '#0369a1' }]}>{integrityRate}%</Text>
          <Text style={[styles.metricSub, { color: '#1e40af' }]}>Zero Hemolysis</Text>
        </View>
      </View>

      {/* 30-Day Activity Heatmap */}
      <View style={styles.heatmapSection}>
        <Text style={[styles.heatmapTitle, { color: themeColors.textSecondary }]}>
          30-Day Collection Density Heatmap
        </Text>
        <View style={styles.dotsGrid}>
          {activityDots.map((intensity, idx) => (
            <View
              key={idx}
              style={[
                styles.activityDot,
                { backgroundColor: getDotColor(intensity) },
              ]}
            />
          ))}
        </View>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  title: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  metricBox: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: '800',
    marginVertical: 2,
  },
  metricSub: {
    fontSize: 8,
    textAlign: 'center',
  },
  heatmapSection: {
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  heatmapTitle: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
});
