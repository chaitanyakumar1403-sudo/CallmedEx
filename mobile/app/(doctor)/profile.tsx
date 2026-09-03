import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function DoctorProfileScreen() {
  const { user, logout, biometricAvailable, biometricType, isBiometricEnabled, enableBiometrics } = useAuth();
  const { themeColors, isDark, toggleTheme } = useTheme();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Sign out of your CallMedex clinical session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => await logout() },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Physician Profile" subtitle="Credentialing & Clinical Settings" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card elevated style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: themeColors.primary.DEFAULT }]}>
              <Text style={styles.avatarText}>🩺</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.name, { color: themeColors.textPrimary }]}>Dr. {user?.full_name || 'Specialist'}</Text>
              <Text style={[styles.meta, { color: themeColors.textSecondary }]}>{user?.email || 'doctor@callmedex.com'}</Text>
              <View style={{ marginTop: 6 }}>
                <Badge label="VERIFIED CLINICAL PROVIDER" variant="success" />
              </View>
            </View>
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Security & Theme</Text>
        <Card style={styles.settingsCard}>
          {biometricAvailable ? (
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>{biometricType} Authentication</Text>
                <Text style={[styles.settingSub, { color: themeColors.textSecondary }]}>Fast biometric login to clinical EHR</Text>
              </View>
              <Switch
                value={isBiometricEnabled}
                onValueChange={async () => {
                  if (!isBiometricEnabled) await enableBiometrics();
                }}
                trackColor={{ false: '#CBD5E1', true: themeColors.accent.DEFAULT }}
              />
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>Dark Mode</Text>
              <Text style={[styles.settingSub, { color: themeColors.textSecondary }]}>Clinical dark mode for reduced eye strain</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#CBD5E1', true: themeColors.accent.DEFAULT }}
            />
          </View>
        </Card>

        <Button
          title="Sign Out of Doctor Portal"
          onPress={handleLogout}
          variant="danger"
          size="lg"
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: 100,
  },
  card: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
  },
  name: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  meta: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  settingsCard: {
    padding: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  settingLabel: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  settingSub: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
});
