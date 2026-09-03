/**
 * Nurse Dashboard Screen — Overview of assigned visits, tasks, and stats.
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
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { api } from '../../src/services/api';
import { formatDate } from '../../src/utils/formatters';

interface NurseStats {
  today_visits: number;
  pending_tasks: number;
  completed_today: number;
}

export default function NurseDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { themeColors } = useTheme();

  const [stats, setStats] = useState<NurseStats>({ today_visits: 0, pending_tasks: 0, completed_today: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<NurseStats>('/api/nurses/dashboard');
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
        title={`Hello, ${user?.full_name?.split(' ')[0] || 'Nurse'}`}
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
              {stats.today_visits}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              Today's Visits
            </Text>
          </Card>
          <Card elevated style={styles.statCard}>
            <Text style={[styles.statValue, { color: themeColors.warning.DEFAULT }]}>
              {stats.pending_tasks}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              Pending Tasks
            </Text>
          </Card>
          <Card elevated style={styles.statCard}>
            <Text style={[styles.statValue, { color: themeColors.success.DEFAULT }]}>
              {stats.completed_today}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
              Completed
            </Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          Quick Actions
        </Text>
        <Button
          title="View Assigned Visits"
          onPress={() => router.push('/(nurse)/visits')}
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
