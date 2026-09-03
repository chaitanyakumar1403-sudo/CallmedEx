import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Platform,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

interface FloatingSOSButtonProps {
  onPress: () => void;
}

export const FloatingSOSButton: React.FC<FloatingSOSButtonProps> = ({ onPress }) => {
  const { themeColors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    onPress();
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.glowRing,
          {
            backgroundColor: themeColors.danger.DEFAULT,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={[
          styles.button,
          {
            backgroundColor: themeColors.danger.DEFAULT,
          },
        ]}
      >
        <Text style={styles.buttonText}>SOS</Text>
        <Text style={styles.subText}>EMERGENCY</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 84,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  glowRing: {
    position: 'absolute',
    width: spacing.sosButtonSize + 12,
    height: spacing.sosButtonSize + 12,
    borderRadius: (spacing.sosButtonSize + 12) / 2,
    opacity: 0.25,
  },
  button: {
    width: spacing.sosButtonSize,
    height: spacing.sosButtonSize,
    borderRadius: spacing.sosButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.sosGlow,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 18,
  },
  subText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
