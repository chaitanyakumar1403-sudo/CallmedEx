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

export default function PharmacyProfileScreen() {
  const { user, logout } = useAuth();
  const { themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Pharmacy Profile" subtitle="Retail & Dispensation Credentials" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card elevated style={styles.card}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{user?.full_name || 'Retail Pharmacy'}</Text>
          <Text style={[styles.sub, { color: themeColors.textSecondary }]}>{user?.email || 'pharmacy@callmedex.com'}</Text>
          <View style={{ marginTop: 8 }}>
            <Badge label="LICENSED DISPENSATION PHARMACY" variant="role" roleKey="pharmacy" />
          </View>
        </Card>

        <Button
          title="Sign Out"
          onPress={() => Alert.alert('Sign Out', 'Sign out of pharmacy account?', [
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
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  card: { marginTop: spacing.md, padding: spacing.lg },
  title: { fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.bold },
  sub: { fontSize: typography.fontSize.caption, marginTop: 2 },
});
