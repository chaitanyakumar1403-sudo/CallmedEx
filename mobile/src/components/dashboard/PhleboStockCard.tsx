import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Pill } from '../ui/Pill';

interface StockItem {
  name: string;
  count: number;
  minThreshold: number;
  unit: string;
}

interface PhleboStockCardProps {
  stockItems?: StockItem[];
}

export const PhleboStockCard: React.FC<PhleboStockCardProps> = ({
  stockItems = [
    { name: 'EDTA (Lavender)', count: 24, minThreshold: 10, unit: 'tubes' },
    { name: 'SST Gel (Gold)', count: 18, minThreshold: 10, unit: 'tubes' },
    { name: 'Sodium Fluoride (Grey)', count: 12, minThreshold: 5, unit: 'tubes' },
    { name: 'Flashback Needles 21G', count: 32, minThreshold: 15, unit: 'pcs' },
    { name: 'Alcohol Swabs', count: 48, minThreshold: 20, unit: 'wipes' },
  ],
}) => {
  const { themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>📦</Text>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            Phlebotomy Kit Inventory & Stock
          </Text>
        </View>
        <Pill label="Kit Verified" variant="done" />
      </View>

      <View style={styles.list}>
        {stockItems.map((item, idx) => {
          const isLow = item.count <= item.minThreshold;

          return (
            <View
              key={idx}
              style={[
                styles.itemRow,
                {
                  backgroundColor: isLow ? '#fffbeb' : (themeColors.surface2 || '#f8fafc'),
                  borderColor: isLow ? '#fcd34d' : themeColors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: themeColors.textPrimary }]}>
                  {item.name}
                </Text>
                <Text style={[styles.itemThreshold, { color: themeColors.textMuted }]}>
                  Min threshold: {item.minThreshold} {item.unit}
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text
                  style={[
                    styles.countText,
                    { color: isLow ? '#b45309' : '#15803d' },
                  ]}
                >
                  {item.count} {item.unit}
                </Text>
                {isLow && (
                  <Text style={styles.lowWarnText}>⚠️ Low</Text>
                )}
              </View>
            </View>
          );
        })}
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
    alignItems: 'center',
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
  list: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
  },
  itemName: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
  },
  itemThreshold: {
    fontSize: 10,
    marginTop: 2,
  },
  countBadge: {
    alignItems: 'flex-end',
  },
  countText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '800',
  },
  lowWarnText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b45309',
  },
});
