import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatINR } from '../ui/PackageCard';

interface PhleboWalletCardProps {
  balance?: number;
  todayEarned?: number;
  incentives?: number;
  onWithdrawClick?: () => void;
}

export const PhleboWalletCard: React.FC<PhleboWalletCardProps> = ({
  balance = 4850,
  todayEarned = 1200,
  incentives = 450,
  onWithdrawClick,
}) => {
  const { themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>💼</Text>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            Earnings & Instant Payout Wallet
          </Text>
        </View>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>{formatINR(balance)}</Text>
        <Text style={styles.balanceSub}>Direct UPI Instant Settlement Active</Text>
      </View>

      <View style={styles.breakdownRow}>
        <View style={[styles.breakdownBox, { backgroundColor: themeColors.surface2 || '#f8fafc', borderColor: themeColors.border }]}>
          <Text style={[styles.breakdownLabel, { color: themeColors.textSecondary }]}>Today&apos;s Dispatches</Text>
          <Text style={[styles.breakdownValue, { color: themeColors.textPrimary }]}>{formatINR(todayEarned)}</Text>
        </View>

        <View style={[styles.breakdownBox, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
          <Text style={[styles.breakdownLabel, { color: '#15803d' }]}>Quality Incentives</Text>
          <Text style={[styles.breakdownValue, { color: '#15803d' }]}>+{formatINR(incentives)}</Text>
        </View>
      </View>

      {onWithdrawClick && (
        <TouchableOpacity
          onPress={onWithdrawClick}
          style={styles.withdrawBtn}
        >
          <Text style={styles.withdrawText}>⚡ Request Instant UPI Settlement</Text>
        </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
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
  balanceCard: {
    backgroundColor: '#1a2b4a',
    borderRadius: spacing.cardRadiusSm,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  balanceLabel: {
    color: '#94a3b8',
    fontSize: typography.fontSize.tiny,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  balanceValue: {
    color: '#ffffff',
    fontSize: typography.fontSize.hero,
    fontWeight: '900',
    marginVertical: 2,
  },
  balanceSub: {
    color: '#00D4B2',
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  breakdownBox: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: typography.fontSize.body,
    fontWeight: '800',
    marginTop: 2,
  },
  withdrawBtn: {
    backgroundColor: '#00D4B2',
    paddingVertical: 10,
    borderRadius: spacing.buttonRadius,
    alignItems: 'center',
    marginTop: 4,
  },
  withdrawText: {
    color: '#0f1d33',
    fontSize: typography.fontSize.caption,
    fontWeight: '800',
  },
});
