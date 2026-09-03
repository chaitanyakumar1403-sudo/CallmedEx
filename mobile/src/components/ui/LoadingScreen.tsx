import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export const LoadingScreen: React.FC<{ message?: string }> = ({
  message = 'Loading CallMedex...',
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <Text style={styles.logoPlus}>+</Text>
      </View>
      <Text style={styles.brandTitle}>CallMedex</Text>
      <Text style={styles.brandSubtitle}>HEALTHCARE PLATFORM</Text>

      <ActivityIndicator size="large" color="#00D4B2" style={styles.spinner} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A2540',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#00D4B2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoPlus: {
    color: '#0A2540',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.heavy,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: '#00D4B2',
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 2,
    marginTop: 2,
    marginBottom: spacing.xxxl,
  },
  spinner: {
    marginBottom: spacing.md,
  },
  message: {
    color: '#94A3B8',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
  },
});
