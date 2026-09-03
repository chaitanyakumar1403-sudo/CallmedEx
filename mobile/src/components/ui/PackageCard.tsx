import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { Pill } from './Pill';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export interface HealthPackageData {
  id: string;
  name: string;
  tests: string;
  mrp: number;
  price: number;
  single_price?: number;
  couple_price?: number | null;
  special_add_on?: string | null;
}

interface PackageCardProps {
  packageData: HealthPackageData;
  onBook: (pkg: HealthPackageData, planType: 'single' | 'couple') => void;
  onAddons?: (pkg: HealthPackageData) => void;
  style?: ViewStyle;
}

export function formatINR(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function calculateSavingsPct(mrp: number, price: number): number {
  if (mrp <= 0) return 0;
  return Math.round((1 - price / mrp) * 100);
}

export const PackageCard: React.FC<PackageCardProps> = ({
  packageData,
  onBook,
  onAddons,
  style,
}) => {
  const { themeColors } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<'single' | 'couple'>('single');

  const singlePrice = packageData.single_price || packageData.price;
  const couplePrice = packageData.couple_price;
  const currentPrice = selectedPlan === 'couple' && couplePrice ? couplePrice : singlePrice;
  const savingsPct = calculateSavingsPct(packageData.mrp, currentPrice);
  const testsList = packageData.tests.split(/[,/]/).map((t) => t.trim()).filter(Boolean);

  return (
    <Card style={[styles.card, { borderColor: themeColors.border }, style]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {packageData.name}
          </Text>
          <View style={styles.badgeRow}>
            <Pill label="🏠 Free Home Collection" variant="done" />
            {savingsPct > 0 && (
              <Pill label={`Save ${savingsPct}%`} variant="teal" style={{ marginLeft: 6 }} />
            )}
          </View>
        </View>
      </View>

      {/* Special Add-on Recommendation */}
      {packageData.special_add_on && (
        <View style={styles.specialAddonRow}>
          <Text style={styles.specialAddonText}>
            ⭐ Recommended Add-on: {packageData.special_add_on} (30% OFF)
          </Text>
        </View>
      )}

      {/* Tests Breakdown */}
      <View style={styles.testsContainer}>
        <Text style={[styles.testsLabel, { color: themeColors.textSecondary }]}>
          Includes {testsList.length} Parameters:
        </Text>
        <Text style={[styles.testsText, { color: themeColors.textSecondary }]} numberOfLines={2}>
          {testsList.join(' · ')}
        </Text>
      </View>

      {/* Single / Couple Selector */}
      {couplePrice ? (
        <View style={styles.planSelectorRow}>
          <TouchableOpacity
            onPress={() => setSelectedPlan('single')}
            style={[
              styles.planBtn,
              selectedPlan === 'single' ? styles.planBtnActive : styles.planBtnInactive,
            ]}
          >
            <Text
              style={[
                styles.planBtnText,
                selectedPlan === 'single' ? styles.planBtnTextActive : styles.planBtnTextInactive,
              ]}
            >
              👤 Single • {formatINR(singlePrice)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedPlan('couple')}
            style={[
              styles.planBtn,
              selectedPlan === 'couple' ? styles.planBtnActive : styles.planBtnInactive,
            ]}
          >
            <Text
              style={[
                styles.planBtnText,
                selectedPlan === 'couple' ? styles.planBtnTextActive : styles.planBtnTextInactive,
              ]}
            >
              👥 Couple • {formatINR(couplePrice)}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Price and CTA Row */}
      <View style={styles.footerRow}>
        <View>
          {packageData.mrp > currentPrice && (
            <Text style={[styles.mrpText, { color: themeColors.textMuted }]}>
              {formatINR(packageData.mrp)}
            </Text>
          )}
          <Text style={[styles.priceText, { color: themeColors.textPrimary }]}>
            {formatINR(currentPrice)}
          </Text>
          <Text style={{ fontSize: 10, color: themeColors.textMuted }}>
            {selectedPlan === 'couple' ? 'For 2 Persons' : 'For 1 Person'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onAddons && (
            <Button
              title="🎁 +Add Tests (30% OFF)"
              size="sm"
              variant="outline"
              onPress={() => onAddons(packageData)}
              style={styles.addonButton}
            />
          )}

          <Button
            title="Book"
            size="sm"
            variant="primary"
            onPress={() => onBook(packageData, selectedPlan)}
            style={styles.bookButton}
          />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.cardPadding,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  specialAddonRow: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  specialAddonText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  testsContainer: {
    marginVertical: spacing.sm,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
  },
  testsLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  testsText: {
    fontSize: 11,
    lineHeight: 16,
  },
  planSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  planBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  planBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  planBtnInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  planBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planBtnTextActive: {
    color: '#ffffff',
  },
  planBtnTextInactive: {
    color: '#475569',
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
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
  },
  addonButton: {
    paddingHorizontal: 8,
  },
  bookButton: {
    minWidth: 70,
  },
});
