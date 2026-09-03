/**
 * Staff Dashboard Screen — Patient intake queue, task management.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { api } from '../../src/services/api';
import { formatDate } from '../../src/utils/formatters';

interface StaffStats {
  intake_queue: number;
  processed_today: number;
  pending_verifications: number;
}

export default function StaffDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { themeColors } = useTheme();

  const [stats, setStats] = useState<StaffStats>({ intake_queue: 0, processed_today: 0, pending_verifications: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<StaffStats>('/api/staff/dashboard');
      if (res) setStats(res);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title={`Hello, ${user?.full_name?.split(' ')[0] || 'Staff'}`}
        subtitle={formatDate(new Date().toISOString())}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card elevated style={styles.statCard}>
            <Text style={[styles.statValue, { color: themeColors.accent.DEFAULT }]}>
              {stats.intake_queue}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              Intake Queue
            </Text>
          </Card>
          <Card elevated style={styles.statCard}>
            <Text style={[styles.statValue, { color: themeColors.success.DEFAULT }]}>
              {stats.processed_today}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              Processed
            </Text>
          </Card>
          <Card elevated style={styles.statCard}>
            <Text style={[styles.statValue, { color: themeColors.warning.DEFAULT }]}>
              {stats.pending_verifications}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              Verifications
            </Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          Quick Actions
        </Text>
        <Button
          title="Patient Intake"
          onPress={() => router.push('/(staff)/intake')}
          style={styles.actionButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: 80 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.md, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  actionButton: { marginBottom: spacing.sm },
});
