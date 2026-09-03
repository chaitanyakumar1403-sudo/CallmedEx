import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'role';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  roleKey?: keyof typeof import('../../theme/colors').colors.roles;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  roleKey,
  style,
  textStyle,
}) => {
  const { themeColors } = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: themeColors.success.light, text: themeColors.success.text };
      case 'warning':
        return { bg: themeColors.warning.light, text: themeColors.warning.text };
      case 'danger':
        return { bg: themeColors.danger.light, text: themeColors.danger.text };
      case 'info':
        return { bg: themeColors.info.light, text: themeColors.info.text };
      case 'role':
        if (roleKey && themeColors.roles[roleKey]) {
          return { bg: `${themeColors.roles[roleKey]}20`, text: themeColors.roles[roleKey] };
        }
        return { bg: themeColors.accent.subtle, text: themeColors.accent.dark };
      case 'neutral':
      default:
        return { bg: themeColors.border, text: themeColors.textSecondary };
    }
  };

  const { bg, text } = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: spacing.pillRadius,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
