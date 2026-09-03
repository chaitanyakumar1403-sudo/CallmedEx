// mobile/src/components/glass/Glass.tsx
// Core 4-tier Glass primitive (G1–G4 ladder) with hardware blur & degrade fallback.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §3.9

import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassTokens, GlassTier } from '../../theme/tokens';
import { useGlass } from '../../theme/GlassProvider';

export interface GlassProps {
  tier?: GlassTier;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  tint?: 'dark' | 'light' | 'default';
  specular?: boolean;
  accentGlow?: boolean;
  testID?: string;
}

export const Glass: React.FC<GlassProps> = ({
  tier = 'G1',
  style,
  children,
  tint = 'dark',
  specular = true,
  accentGlow = false,
  testID,
}) => {
  const { degradeGlass, roleAccent } = useGlass();
  const token = GlassTokens[tier] || GlassTokens.G1;

  // G4 is MANDATORY clinical opaque — never transparent (§3.2 & §3.9)
  const isOpaque = tier === 'G4' || degradeGlass || token.blur === 0;

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          borderColor: token.stroke,
          backgroundColor: isOpaque ? token.fill : token.fill,
        },
        accentGlow && {
          shadowColor: roleAccent.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 6,
        },
        style,
      ]}
    >
      {/* Blur layer for G2 & G3 on supported hardware */}
      {!isOpaque && token.blur > 0 && Platform.OS !== 'web' && (
        <BlurView
          intensity={token.blur}
          tint={tint}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Top Specular Edge Highlight */}
      {specular && (
        <LinearGradient
          colors={[token.specular, 'rgba(255,255,255,0.0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.specularBar}
          pointerEvents="none"
        />
      )}

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  specularBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});
