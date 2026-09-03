import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { Pill } from './Pill';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatINR, calculateSavingsPct } from './PackageCard';

export interface LabTestData {
  id?: string;
  name: string;
  category?: string;
  mrp: number;
  price: number;
  home_available?: boolean;
  walk_in_required?: boolean;
  typical_turnaround_hours?: number;
  preparation?: string;
}

interface TestCardProps {
  testData: LabTestData;
  onBook: (test: LabTestData) => void;
  style?: ViewStyle;
}

export const TestCard: React.FC<TestCardProps> = ({
  testData,
  onBook,
  style,
}) => {
  const { themeColors } = useTheme();
  const savingsPct = calculateSavingsPct(testData.mrp, testData.price);

  return (
    <Card style={[styles.card, { borderColor: themeColors.border }, style]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: themeColors.textPrimary }]}>
            {testData.name}
          </Text>
          {testData.category && (
            <Text style={[styles.category, { color: themeColors.textSecondary }]}>
              {testData.category}
            </Text>
          )}
        </View>
      </View>

      {/* Badges */}
      <View style={styles.badgeRow}>
        {testData.home_available !== false ? (
          <Pill label="🏠 Home Collection" variant="done" />
        ) : (
          <Pill label="🏥 Walk-In Only" variant="waiting" />
        )}
        {savingsPct > 0 && (
          <Pill label={`Save ${savingsPct}%`} variant="teal" style={{ marginLeft: 6 }} />
        )}
        {testData.typical_turnaround_hours ? (
          <Pill
            label={`⏱️ ${testData.typical_turnaround_hours}h Results`}
            variant="neutral"
            style={{ marginLeft: 6 }}
          />
        ) : null}
      </View>

      {testData.preparation ? (
        <Text style={[styles.prepText, { color: themeColors.textMuted }]} numberOfLines={1}>
          💡 {testData.preparation}
        </Text>
      ) : null}

      {/* Footer / Price & Action */}
      <View style={styles.footerRow}>
        <View>
          {testData.mrp > testData.price && (
            <Text style={[styles.mrpText, { color: themeColors.textMuted }]}>
              {formatINR(testData.mrp)}
            </Text>
          )}
          <Text style={[styles.priceText, { color: themeColors.textPrimary }]}>
            {formatINR(testData.price)}
          </Text>
        </View>

        <Button
          title="Book Test"
          size="sm"
          variant="primary"
          onPress={() => onBook(testData)}
          style={styles.bookButton}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2,
  },
  category: {
    fontSize: typography.fontSize.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: spacing.xs,
  },
  prepText: {
    fontSize: typography.fontSize.tiny,
    marginBottom: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  mrpText: {
    fontSize: typography.fontSize.caption,
    textDecorationLine: 'line-through',
  },
  priceText: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.heavy,
  },
  bookButton: {
    minWidth: 90,
  },
});
