/**
 * Report Detail Screen — AI analysis view with markers, score, and recommendations.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { useReportDetail } from '../../src/hooks/useReports';
import { REPORT_STATUS_LABELS } from '../../src/constants';
import { formatDateTime } from '../../src/utils/formatters';
import type { ReportJobStatus } from '../../src/types/api';
import type { BadgeVariant } from '../../src/components/ui/Badge';

const STATUS_TO_VARIANT: Record<string, BadgeVariant> = {
  queued: 'warning',
  processing: 'info',
  delivered: 'success',
  failed: 'danger',
  expired: 'neutral',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: '#F59E0B',
  moderate: '#F97316',
  high: '#EF4444',
  critical: '#DC2626',
};

const SEVERITY_TO_VARIANT: Record<string, BadgeVariant> = {
  low: 'warning',
  moderate: 'warning',
  high: 'danger',
  critical: 'danger',
};

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();
  const { report, loading, error } = useReportDetail(id);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Report" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={{ color: themeColors.textSecondary }}>{error || 'Report not found.'}</Text>
        </View>
      </View>
    );
  }

  const status = report.status as ReportJobStatus;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Report Details" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status + Score */}
        <Card elevated style={styles.headerCard}>
          <Badge
            label={REPORT_STATUS_LABELS[status] || status}
            variant={STATUS_TO_VARIANT[status] || 'neutral'}
          />
          {report.ai_health_score != null && (
            <View style={styles.scoreContainer}>
              <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>
                Health Score
              </Text>
              <Text
                style={[
                  styles.scoreValue,
                  {
                    color:
                      report.ai_health_score >= 80
                        ? themeColors.success.DEFAULT
                        : report.ai_health_score >= 60
                        ? themeColors.warning.DEFAULT
                        : themeColors.danger.DEFAULT,
                  },
                ]}
              >
                {report.ai_health_score}/100
              </Text>
            </View>
          )}
          <Text style={[styles.dateText, { color: themeColors.textSecondary }]}>
            {formatDateTime(report.created_at)}
          </Text>
        </Card>

        {/* AI Summary */}
        {report.ai_summary && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>AI Summary</Text>
            <Text style={[styles.summaryText, { color: themeColors.textSecondary }]}>
              {report.ai_summary}
            </Text>
          </Card>
        )}

        {/* Abnormal Markers */}
        {report.abnormal_markers && report.abnormal_markers.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              Abnormal Markers ({report.abnormal_markers.length})
            </Text>
            {report.abnormal_markers.map((marker, i) => (
              <View key={i} style={styles.markerRow}>
                <View style={styles.markerInfo}>
                  <Text style={[styles.markerName, { color: themeColors.textPrimary }]}>
                    {marker.name}
                  </Text>
                  <Text style={[styles.markerRef, { color: themeColors.textSecondary }]}>
                    Ref: {marker.reference_range}
                  </Text>
                </View>
                <View style={styles.markerValueContainer}>
                  <Text
                    style={[
                      styles.markerValue,
                      { color: SEVERITY_COLORS[marker.severity] || themeColors.danger.DEFAULT },
                    ]}
                  >
                    {marker.value} {marker.unit}
                  </Text>
                  <Badge
                    label={marker.severity.toUpperCase()}
                    variant={SEVERITY_TO_VARIANT[marker.severity] || 'danger'}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Recommendations */}
        {report.recommendations && report.recommendations.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              Recommendations
            </Text>
            {report.recommendations.map((rec, i) => (
              <View key={i} style={styles.recRow}>
                <Text style={[styles.recBullet, { color: themeColors.accent.DEFAULT }]}>•</Text>
                <Text style={[styles.recText, { color: themeColors.textSecondary }]}>{rec}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Download Report */}
        {report.report_url && (
          <Button
            title="Download Full Report"
            onPress={() => Linking.openURL(report.report_url!)}
            style={styles.downloadButton}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: 80 },
  headerCard: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  scoreContainer: { alignItems: 'center' },
  scoreLabel: { fontSize: 12 },
  scoreValue: { fontSize: 32, fontWeight: '800' },
  dateText: { fontSize: 12 },
  section: { padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  summaryText: { fontSize: 14, lineHeight: 22 },
  markerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  markerInfo: { flex: 1 },
  markerName: { fontSize: 14, fontWeight: '600' },
  markerRef: { fontSize: 12 },
  markerValueContainer: { alignItems: 'flex-end', gap: 4 },
  markerValue: { fontSize: 16, fontWeight: '700' },
  recRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  recBullet: { fontSize: 16, fontWeight: '700' },
  recText: { fontSize: 14, flex: 1, lineHeight: 20 },
  downloadButton: { marginTop: spacing.md },
});
