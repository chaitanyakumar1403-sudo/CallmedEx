import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function PhlebotomistProfileScreen() {
  const { user, logout } = useAuth();
  const { themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Phlebotomist Profile" subtitle="Field Personnel Badge & Stats" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card elevated style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: '#8B5CF6' }]}>
              <Text style={styles.avatarText}>🧪</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.name, { color: themeColors.textPrimary }]}>{user?.full_name || 'Field Phlebotomist'}</Text>
              <Text style={[styles.meta, { color: themeColors.textSecondary }]}>{user?.email || 'phleb@callmedex.com'}</Text>
              <View style={{ marginTop: 6 }}>
                <Badge label="CERTIFIED PHLEBOTOMIST" variant="role" roleKey="phlebotomist" />
              </View>
            </View>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <Text style={[styles.statValue, { color: themeColors.primary.DEFAULT }]}>24</Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Samples Collected This Week</Text>
        </Card>

        <Button
          title="Sign Out"
          onPress={() => Alert.alert('Sign Out', 'Sign out of phlebotomy portal?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: async () => await logout() },
          ])}
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
  statsCard: {
    marginTop: spacing.md,
    alignItems: 'center',
    padding: spacing.lg,
  },
  statValue: {
    fontSize: typography.fontSize.hero,
    fontWeight: typography.fontWeight.heavy,
  },
  statLabel: {
    fontSize: typography.fontSize.caption,
    marginTop: 4,
  },
});
