import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export type PillVariant = 'urgent' | 'active' | 'done' | 'waiting' | 'halted' | 'neutral' | 'teal';

interface PillProps {
  label: string;
  variant?: PillVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
}

export const Pill: React.FC<PillProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
  icon,
}) => {
  const { themeColors } = useTheme();

  const getStyle = () => {
    switch (variant) {
      case 'urgent':
        return {
          bg: themeColors.urgent?.light || '#fef2f2',
          border: themeColors.urgent?.line || '#fca5a5',
          text: themeColors.urgent?.text || '#d92020',
        };
      case 'active':
        return {
          bg: themeColors.active?.light || '#eff6ff',
          border: themeColors.active?.line || '#93c5fd',
          text: themeColors.active?.text || '#0369a1',
        };
      case 'done':
        return {
          bg: themeColors.done?.light || '#f0fdf4',
          border: themeColors.done?.line || '#86efac',
          text: themeColors.done?.text || '#15803d',
        };
      case 'waiting':
        return {
          bg: themeColors.waiting?.light || '#fffbeb',
          border: themeColors.waiting?.line || '#fcd34d',
          text: themeColors.waiting?.text || '#b45309',
        };
      case 'halted':
        return {
          bg: themeColors.halted?.light || '#fafaf9',
          border: themeColors.halted?.line || '#d6d3d1',
          text: themeColors.halted?.text || '#57534e',
        };
      case 'teal':
        return {
          bg: '#e6faf7',
          border: '#70ebd8',
          text: '#00a88f',
        };
      case 'neutral':
      default:
        return {
          bg: themeColors.surface3 || '#f1f5f9',
          border: themeColors.border,
          text: themeColors.textSecondary,
        };
    }
  };

  const { bg, border, text } = getStyle();

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }, style]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.text, { color: text }, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.pillRadius,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 10,
    marginRight: 4,
  },
  text: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.3,
  },
});
