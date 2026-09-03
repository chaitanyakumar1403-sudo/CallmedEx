import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

interface BiomarkerHistory {
  id: string;
  name: string;
  unit: string;
  refRange: string;
  records: { date: string; value: number; flag: 'NORMAL' | 'HIGH' | 'LOW' }[];
  trend: 'Improving 🟢' | 'Stable 🟡' | 'Needs Review 🔴';
}

const BIOMARKERS: BiomarkerHistory[] = [
  {
    id: 'hba1c',
    name: 'HbA1c (Glycated Hemoglobin)',
    unit: '%',
    refRange: '4.0 - 5.6 % (Normal) | 5.7 - 6.4 % (Prediabetes)',
    records: [
      { date: '14 Aug 2026', value: 6.1, flag: 'HIGH' },
      { date: '10 May 2026', value: 6.4, flag: 'HIGH' },
      { date: '12 Feb 2026', value: 6.8, flag: 'HIGH' },
    ],
    trend: 'Improving 🟢',
  },
  {
    id: 'cholesterol',
    name: 'Total Serum Cholesterol',
    unit: 'mg/dL',
    refRange: '< 200 mg/dL',
    records: [
      { date: '14 Aug 2026', value: 188, flag: 'NORMAL' },
      { date: '10 May 2026', value: 215, flag: 'HIGH' },
      { date: '12 Feb 2026', value: 230, flag: 'HIGH' },
    ],
    trend: 'Improving 🟢',
  },
  {
    id: 'hemoglobin',
    name: 'Hemoglobin (Hb)',
    unit: 'g/dL',
    refRange: '13.5 - 17.5 g/dL (Male)',
    records: [
      { date: '14 Aug 2026', value: 14.8, flag: 'NORMAL' },
      { date: '10 May 2026', value: 14.6, flag: 'NORMAL' },
      { date: '12 Feb 2026', value: 14.2, flag: 'NORMAL' },
    ],
    trend: 'Stable 🟡',
  },
  {
    id: 'vitd3',
    name: 'Vitamin D3 (25-Hydroxy)',
    unit: 'ng/mL',
    refRange: '30.0 - 100.0 ng/mL',
    records: [
      { date: '14 Aug 2026', value: 22.4, flag: 'LOW' },
      { date: '10 May 2026', value: 18.2, flag: 'LOW' },
    ],
    trend: 'Needs Review 🔴',
  },
];

export default function BiomarkerTimelineScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();

  const [selectedMarker, setSelectedMarker] = useState<BiomarkerHistory>(BIOMARKERS[0]);

  const handleSelect = (marker: BiomarkerHistory) => {
    setSelectedMarker(marker);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Biomarker Trends"
        subtitle="Longitudinal Health Analytics & History"
        rightAction={<Badge label="AI POWERED" variant="role" />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Selector Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {BIOMARKERS.map((m) => {
            const isSelected = selectedMarker.id === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => handleSelect(m)}
                style={[
                  styles.markerChip,
                  {
                    backgroundColor: isSelected ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                    borderColor: isSelected ? themeColors.primary.DEFAULT : themeColors.border,
                  },
                ]}
              >
                <Text style={[styles.markerChipText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                  {m.name.split(' (')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Marker Main Card */}
        <Card style={styles.mainCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.markerName, { color: themeColors.textPrimary }]}>
                {selectedMarker.name}
              </Text>
              <Text style={[styles.refRange, { color: themeColors.textSecondary }]}>
                Reference Range: {selectedMarker.refRange}
              </Text>
            </View>
            <Badge
              label={selectedMarker.trend}
              variant={
                selectedMarker.trend.includes('Improving')
                  ? 'success'
                  : selectedMarker.trend.includes('Stable')
                  ? 'warning'
                  : 'danger'
              }
            />
          </View>

          {/* Historical Trend Timeline */}
          <Text style={[styles.timelineHeading, { color: themeColors.textPrimary }]}>
            Historical Values ({selectedMarker.records.length} Tests)
          </Text>

          {selectedMarker.records.map((rec, idx) => (
            <View
              key={idx}
              style={[
                styles.recordItem,
                { backgroundColor: themeColors.inputBackground },
              ]}
            >
              <View style={styles.recordLeft}>
                <Text style={[styles.recordDate, { color: themeColors.textPrimary }]}>
                  📅 {rec.date}
                </Text>
                <Badge
                  label={rec.flag}
                  variant={rec.flag === 'NORMAL' ? 'success' : rec.flag === 'HIGH' ? 'danger' : 'warning'}
                />
              </View>
              <Text style={[styles.recordValue, { color: themeColors.primary.DEFAULT }]}>
                {rec.value} {selectedMarker.unit}
              </Text>
            </View>
          ))}

          {/* MediAssist AI Comparative Summary */}
          <View style={[styles.aiSummaryBox, { backgroundColor: '#0B2038' }]}>
            <Text style={styles.aiTitle}>✨ MediAssist AI Comparative Analysis</Text>
            <Text style={styles.aiBody}>
              {selectedMarker.id === 'hba1c'
                ? 'Your HbA1c has dropped from 6.8% in Feb 2026 to 6.1% in Aug 2026 (-0.7% decrease). Your glycemic control is trending towards the non-diabetic target range (<5.7%). Continue the prescribed metformin dosage and low-glycemic index dietary regimen.'
                : selectedMarker.id === 'cholesterol'
                ? 'Total cholesterol has normalized into the healthy bracket (<200 mg/dL) from a peak of 230 mg/dL earlier this year. Cardiovascular risk index has lowered significantly.'
                : 'Values are tracking within standard clinical baseline tolerances. Maintain current lifestyle routines.'}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  chipRow: { marginVertical: spacing.sm },
  markerChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: spacing.buttonRadius, borderWidth: 1, marginRight: 8 },
  markerChipText: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  mainCard: { marginTop: spacing.xs, padding: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  markerName: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  refRange: { fontSize: typography.fontSize.tiny, marginTop: 4 },
  timelineHeading: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold, marginTop: spacing.md, marginBottom: spacing.xs },
  recordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm, borderRadius: spacing.buttonRadius, marginVertical: 4 },
  recordLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDate: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  recordValue: { fontSize: typography.fontSize.bodyLarge, fontWeight: '800' },
  aiSummaryBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: spacing.cardRadius, borderWidth: 1, borderColor: '#00D4B2' },
  aiTitle: { color: '#00D4B2', fontSize: typography.fontSize.caption, fontWeight: '800' },
  aiBody: { color: '#E2E8F0', fontSize: typography.fontSize.tiny, lineHeight: 18, marginTop: 6 },
});
