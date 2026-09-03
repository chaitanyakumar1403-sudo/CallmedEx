// mobile/src/components/widgets/HoldToTrigger.tsx
// 1500ms press-and-hold safety trigger with progressive haptics and fill animation.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §9.3

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export interface HoldToTriggerProps {
  label: string;
  subLabel?: string;
  color?: string;
  durationMs?: number;
  onTrigger: () => void;
}

export const HoldToTrigger: React.FC<HoldToTriggerProps> = ({
  label,
  subLabel = 'Hold for 1.5s to confirm',
  color = '#ef4444',
  durationMs = 1500,
  onTrigger,
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    setIsHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    }).start();

    timerRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onTrigger();
      reset();
    }, durationMs);
  };

  const cancelHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    reset();
  };

  const reset = () => {
    setIsHolding(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Pressable
      onPressIn={startHold}
      onPressOut={cancelHold}
      style={[styles.container, { borderColor: `${color}66` }]}
    >
      {/* Animated fill progress bar */}
      <Animated.View
        style={[
          styles.fillProgress,
          {
            backgroundColor: `${color}44`,
            width: fillWidth,
          },
        ]}
      />

      <View style={styles.textContainer}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text style={styles.subLabel}>{isHolding ? 'Release to cancel' : subLabel}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  fillProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
