import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  elevated = false,
  style,
}) => {
  const { themeColors } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: elevated ? themeColors.cardElevated : themeColors.card,
    borderRadius: spacing.cardRadius,
    padding: spacing.cardPadding,
    borderWidth: elevated ? 0 : 1,
    borderColor: themeColors.border,
    ...(elevated ? shadows.md : shadows.sm),
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
