import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}) => {
  const { themeColors } = useTheme();

  const handlePress = () => {
    if (disabled || loading) return;
    if (Platform.OS !== 'web') {
      if (variant === 'danger') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    onPress();
  };

  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: spacing.buttonRadius,
    };

    // Size
    if (size === 'sm') {
      base.paddingVertical = 8;
      base.paddingHorizontal = 12;
    } else if (size === 'lg') {
      base.paddingVertical = 16;
      base.paddingHorizontal = 24;
    } else {
      base.paddingVertical = 12;
      base.paddingHorizontal = 18;
    }

    // Variant
    switch (variant) {
      case 'primary':
        base.backgroundColor = themeColors.primary.DEFAULT;
        Object.assign(base, shadows.sm);
        break;
      case 'accent':
        base.backgroundColor = themeColors.accent.DEFAULT;
        Object.assign(base, shadows.tealGlow);
        break;
      case 'secondary':
        base.backgroundColor = themeColors.secondary.DEFAULT;
        break;
      case 'danger':
        base.backgroundColor = themeColors.danger.DEFAULT;
        Object.assign(base, shadows.sosGlow);
        break;
      case 'outline':
        base.backgroundColor = 'transparent';
        base.borderWidth = 1.5;
        base.borderColor = themeColors.primary.DEFAULT;
        break;
      case 'ghost':
        base.backgroundColor = 'transparent';
        break;
    }

    if (disabled) {
      base.opacity = 0.5;
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    let color = '#FFFFFF';
    if (variant === 'accent') {
      color = '#0A2540';
    } else if (variant === 'outline') {
      color = themeColors.primary.DEFAULT;
    } else if (variant === 'ghost') {
      color = themeColors.textPrimary;
    }

    let fontSize = typography.fontSize.body;
    if (size === 'sm') fontSize = typography.fontSize.caption;
    if (size === 'lg') fontSize = typography.fontSize.bodyLarge;

    return {
      color,
      fontSize,
      fontWeight: typography.fontWeight.semibold,
      textAlign: 'center',
    };
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[getContainerStyle(), style]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'accent' || variant === 'outline' ? themeColors.primary.DEFAULT : '#FFFFFF'}
        />
      ) : (
        <>
          {leftIcon ? <React.Fragment>{leftIcon}</React.Fragment> : null}
          <Text style={[getTextStyle(), leftIcon ? { marginLeft: 8 } : null, rightIcon ? { marginRight: 8 } : null, textStyle]}>
            {title}
          </Text>
          {rightIcon ? <React.Fragment>{rightIcon}</React.Fragment> : null}
        </>
      )}
    </TouchableOpacity>
  );
};
