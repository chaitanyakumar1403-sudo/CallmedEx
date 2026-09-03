// mobile/src/components/glass/AuroraBackdrop.tsx
// GPU aurora canvas providing ambient lighting keyed to active role accent.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §3.10

import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useGlass } from '../../theme/GlassProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const AuroraBackdrop: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { roleAccent, highPerformance } = useGlass();

  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (highPerformance) {
      pulse.value = withRepeat(
        withTiming(0.7, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [highPerformance]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={styles.container}>
      {/* Deep Canvas Base */}
      <LinearGradient
        colors={['#070d18', '#0c1626', '#08101d']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Primary Role Aurora Orb */}
      <Animated.View
        style={[
          styles.auroraOrb,
          {
            backgroundColor: roleAccent.primary,
            top: -SCREEN_WIDTH * 0.3,
            right: -SCREEN_WIDTH * 0.2,
          },
          animatedGlowStyle,
        ]}
      />

      {/* Secondary Soft Ambient Glow */}
      <Animated.View
        style={[
          styles.auroraOrbSecondary,
          {
            backgroundColor: roleAccent.glow,
            bottom: SCREEN_HEIGHT * 0.15,
            left: -SCREEN_WIDTH * 0.25,
          },
          animatedGlowStyle,
        ]}
      />

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070d18',
    overflow: 'hidden',
  },
  auroraOrb: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_WIDTH * 1.1,
    borderRadius: (SCREEN_WIDTH * 1.1) / 2,
    opacity: 0.45,
    transform: [{ scale: 1.2 }],
  },
  auroraOrbSecondary: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: (SCREEN_WIDTH * 0.9) / 2,
    opacity: 0.3,
    transform: [{ scale: 1.1 }],
  },
});
