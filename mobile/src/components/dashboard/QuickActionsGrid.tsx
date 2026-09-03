import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export interface QuickActionItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  iconBg: string;
  badge?: string;
  onPress: () => void;
  accentBorder?: string;
  accentBg?: string;
}

interface QuickActionsGridProps {
  onDispatchClick: (providerType: string, serviceType: string, label: string) => void;
  onVideoConsultClick: () => void;
  onBookPackagesClick: () => void;
  onDiagnosticsClick: () => void;
  onReportsClick: () => void;
  onPmjayClick?: () => void;
}

export const QuickActionsGrid: React.FC<QuickActionsGridProps> = ({
  onDispatchClick,
  onVideoConsultClick,
  onBookPackagesClick,
  onDiagnosticsClick,
  onReportsClick,
  onPmjayClick,
}) => {
  const { themeColors } = useTheme();

  const actions = [
    {
      id: 'phlebo_dispatch',
      title: 'Home Sample Collection',
      subtitle: 'Phlebotomist at doorstep',
      icon: '🩸',
      iconBg: '#fee2e2',
      onPress: () => onDispatchClick('phlebotomist', 'home_collection', 'Blood Collection'),
    },
    {
      id: 'doctor_dispatch',
      title: 'Urgent Home Doctor',
      subtitle: 'Doctor visit at home',
      icon: '🧑‍⚕️',
      iconBg: '#dbeafe',
      onPress: () => onDispatchClick('doctor', 'home_visit', 'Home Doctor'),
    },
    {
      id: 'nurse_dispatch',
      title: 'Home Nurse Care',
      subtitle: 'Injections & dressing',
      icon: '👩‍⚕️',
      iconBg: '#fce7f3',
      onPress: () => onDispatchClick('nurse', 'nursing_care', 'Home Nurse'),
    },
    {
      id: 'pharmacy_dispatch',
      title: 'Medicine Delivery',
      subtitle: 'Express delivery in 60m',
      icon: '🛵',
      iconBg: '#fef3c7',
      onPress: () => onDispatchClick('pharmacy_delivery', 'medicine_delivery', 'Medicine Delivery'),
    },
    {
      id: 'video_consult',
      title: 'Video Consultation',
      subtitle: 'NMC-verified doctors',
      icon: '📹',
      iconBg: '#dcfce7',
      onPress: onVideoConsultClick,
    },
    {
      id: 'packages',
      title: 'Health Packages',
      subtitle: 'Save up to 52% off MRP',
      icon: '📦',
      iconBg: '#e0e7ff',
      badge: 'FIXED RATES',
      onPress: onBookPackagesClick,
    },
    {
      id: 'diagnostics',
      title: 'Book Diagnostic Test',
      subtitle: '400+ NABL verified tests',
      icon: '🔬',
      iconBg: '#ccfbf1',
      onPress: onDiagnosticsClick,
    },
    {
      id: 'ai_reports',
      title: 'AI Smart Reports',
      subtitle: 'Multilingual summary',
      icon: '🤖',
      iconBg: '#ede9fe',
      onPress: onReportsClick,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
        Emergency & Healthcare Actions
      </Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            activeOpacity={0.8}
            onPress={action.onPress}
            style={[
              styles.tile,
              {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              },
            ]}
          >
            <View style={styles.tileHeader}>
              <View style={[styles.iconBox, { backgroundColor: action.iconBg }]}>
                <Text style={styles.icon}>{action.icon}</Text>
              </View>
              {action.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{action.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {action.title}
            </Text>
            {action.subtitle ? (
              <Text style={[styles.subtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {action.subtitle}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  tile: {
    width: '48%',
    padding: spacing.md,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  badge: {
    backgroundColor: '#00D4B2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#0f1d33',
  },
  title: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 18,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typography.fontSize.tiny,
    lineHeight: 14,
  },
});
