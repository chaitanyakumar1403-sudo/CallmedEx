import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface StatsGridProps {
  upcomingCount: number;
  completedCount: number;
  prescriptionsCount: number;
  reportsCount: number;
  onPressUpcoming?: () => void;
  onPressCompleted?: () => void;
  onPressPrescriptions?: () => void;
  onPressReports?: () => void;
}

export const StatsGrid: React.FC<StatsGridProps> = ({
  upcomingCount = 0,
  completedCount = 0,
  prescriptionsCount = 0,
  reportsCount = 0,
  onPressUpcoming,
  onPressCompleted,
  onPressPrescriptions,
  onPressReports,
}) => {
  const { themeColors } = useTheme();

  const items = [
    {
      label: 'Upcoming',
      value: upcomingCount,
      icon: '📋',
      iconBg: '#dbeafe',
      iconColor: '#2563eb',
      onPress: onPressUpcoming,
    },
    {
      label: 'Completed',
      value: completedCount,
      icon: '✅',
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      onPress: onPressCompleted,
    },
    {
      label: 'Prescriptions',
      value: prescriptionsCount,
      icon: '💊',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      onPress: onPressPrescriptions,
    },
    {
      label: 'Reports',
      value: reportsCount,
      icon: '📊',
      iconBg: '#ede9fe',
      iconColor: '#7c3aed',
      onPress: onPressReports,
    },
  ];

  return (
    <View style={styles.grid}>
      {items.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          activeOpacity={0.8}
          onPress={item.onPress}
          style={[
            styles.card,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: item.iconBg }]}>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <View style={styles.content}>
            <Text style={[styles.value, { color: themeColors.textPrimary }]}>
              {item.value}
            </Text>
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>
              {item.label}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: spacing.lg,
  },
  card: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  value: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.heavy,
    lineHeight: 26,
  },
  label: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2,
  },
});
