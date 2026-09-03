import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Pill } from '../ui/Pill';

export interface BiomarkerPoint {
  recordedAt: string;
  observationCode: string;
  observationName: string;
  valueNumber: number;
  unit: string;
}

export interface RiskCompassTrend {
  observationCode: string;
  observationName: string;
  latestValue: number;
  unit: string;
  direction: 'up' | 'down' | 'flat';
}

export interface RiskScoreData {
  totalReadings: number;
  distinctBiomarkers: number;
  latestRecordedAt?: string;
  trends: RiskCompassTrend[];
  summaryText: string;
}

interface BiomarkerMatrixProps {
  biomarkers?: BiomarkerPoint[];
  riskScore?: RiskScoreData | null;
  onBookTestClick?: () => void;
}

export const BiomarkerMatrix: React.FC<BiomarkerMatrixProps> = ({
  biomarkers = [],
  riskScore,
  onBookTestClick,
}) => {
  const { themeColors } = useTheme();
  const [viewMode, setViewMode] = useState<'compass' | 'chart'>('compass');
  const [selectedCode, setSelectedCode] = useState<string>(
    biomarkers[0]?.observationCode || 'FBS'
  );

  const availableCodes = Array.from(new Set(biomarkers.map((b) => b.observationCode)));
  const filteredData = biomarkers.filter((b) => b.observationCode === selectedCode);
  const activeObservationName = filteredData[0]?.observationName || selectedCode;
  const activeTrend = riskScore?.trends.find((t) => t.observationCode === selectedCode);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      {/* Header with Switcher */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.titleIcon}>📈</Text>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              Preventive Biomarker Matrix
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Verified laboratory observations & trend analysis.
          </Text>
        </View>

        <View style={[styles.toggleContainer, { backgroundColor: themeColors.surface3 || '#f1f5f9' }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setViewMode('compass')}
            style={[
              styles.toggleBtn,
              viewMode === 'compass' && { backgroundColor: themeColors.primary.DEFAULT },
            ]}
          >
            <Text
              style={[
                styles.toggleBtnText,
                { color: viewMode === 'compass' ? '#ffffff' : themeColors.textSecondary },
              ]}
            >
              Compass
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setViewMode('chart')}
            style={[
              styles.toggleBtn,
              viewMode === 'chart' && { backgroundColor: themeColors.primary.DEFAULT },
            ]}
          >
            <Text
              style={[
                styles.toggleBtnText,
                { color: viewMode === 'chart' ? '#ffffff' : themeColors.textSecondary },
              ]}
            >
              Trend
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {!riskScore || biomarkers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🧪</Text>
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
            No Lab Biomarkers Record Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
            Book a preventive diagnostic health package to start tracking clinical biomarker trends.
          </Text>
          {onBookTestClick && (
            <TouchableOpacity onPress={onBookTestClick} style={styles.bookActionBtn}>
              <Text style={styles.bookActionText}>Book Diagnostic Package</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : viewMode === 'compass' ? (
        <View style={styles.compassView}>
          {/* Summary Stat Box */}
          <View style={[styles.summaryBox, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
            <Text style={styles.statLabel}>Readings On File</Text>
            <Text style={[styles.statValue, { color: '#15803d' }]}>
              {riskScore.totalReadings}
            </Text>
            <Pill label={`${riskScore.distinctBiomarkers} Biomarkers`} variant="done" />
          </View>

          {/* Trends List */}
          <View style={styles.trendsList}>
            {riskScore.trends.map((trend) => (
              <View
                key={trend.observationCode}
                style={[
                  styles.trendCard,
                  { backgroundColor: themeColors.surface2 || '#f8fafc', borderColor: themeColors.border },
                ]}
              >
                <Text style={[styles.trendName, { color: themeColors.textPrimary }]}>
                  {trend.observationName}
                </Text>
                <View style={styles.trendValueRow}>
                  <Text style={[styles.trendValue, { color: themeColors.textPrimary }]}>
                    {trend.latestValue} {trend.unit}
                  </Text>
                  <Text style={styles.trendArrow}>
                    {trend.direction === 'up' ? '↗️' : trend.direction === 'down' ? '↘️' : '➡️'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {riskScore.summaryText ? (
            <View style={[styles.notesBox, { backgroundColor: '#f8fafc', borderColor: themeColors.border }]}>
              <Text style={[styles.notesText, { color: themeColors.textSecondary }]}>
                💡 {riskScore.summaryText}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.chartView}>
          {/* Code selector chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {availableCodes.map((code) => {
              const isSelected = selectedCode === code;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => setSelectedCode(code)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? themeColors.primary.DEFAULT : (themeColors.surface2 || '#f8fafc'),
                      borderColor: isSelected ? themeColors.primary.DEFAULT : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#ffffff' : themeColors.textPrimary }]}>
                    {code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Trend Data Grid */}
          <View style={[styles.trendDetailCard, { backgroundColor: themeColors.surface2 || '#f8fafc', borderColor: themeColors.border }]}>
            <View style={styles.trendDetailHeader}>
              <Text style={[styles.trendDetailTitle, { color: themeColors.textPrimary }]}>
                {activeObservationName}
              </Text>
              <Pill
                label={activeTrend?.direction === 'up' ? 'Trending Up' : activeTrend?.direction === 'down' ? 'Trending Down' : 'Stable'}
                variant={activeTrend?.direction === 'up' ? 'waiting' : activeTrend?.direction === 'down' ? 'done' : 'neutral'}
              />
            </View>

            <View style={styles.dataPointsGrid}>
              {filteredData.map((item, idx) => (
                <View key={idx} style={[styles.dataPointBox, { backgroundColor: '#ffffff', borderColor: themeColors.border }]}>
                  <Text style={[styles.dataPointDate, { color: themeColors.textMuted }]}>
                    {item.recordedAt}
                  </Text>
                  <Text style={[styles.dataPointValue, { color: themeColors.textPrimary }]}>
                    {item.valueNumber}{' '}
                    <Text style={styles.dataPointUnit}>{item.unit}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
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
  headerRow: {
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
  toggleContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 8,
    gap: 2,
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleBtnText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.caption,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  bookActionBtn: {
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1a2b4a',
    borderRadius: 8,
  },
  bookActionText: {
    color: '#ffffff',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  compassView: {
    gap: 10,
  },
  summaryBox: {
    padding: spacing.md,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold,
    color: '#15803d',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: typography.fontSize.hero,
    fontWeight: typography.fontWeight.heavy,
    marginVertical: 2,
  },
  trendsList: {
    gap: 6,
  },
  trendCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
  },
  trendName: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  trendValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendValue: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  trendArrow: {
    fontSize: 12,
  },
  notesBox: {
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  notesText: {
    fontSize: typography.fontSize.tiny,
    lineHeight: 16,
  },
  chartView: {
    gap: 10,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  chipText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
  },
  trendDetailCard: {
    padding: spacing.md,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
  },
  trendDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  trendDetailTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  dataPointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dataPointBox: {
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
  },
  dataPointDate: {
    fontSize: 10,
    marginBottom: 2,
  },
  dataPointValue: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  dataPointUnit: {
    fontSize: 10,
    fontWeight: 'normal',
  },
});
