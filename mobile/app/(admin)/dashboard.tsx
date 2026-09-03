import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { adminService } from '../../src/services/adminApi';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { AdminMetrics, VerificationReview } from '../../src/types/api';

export default function AdminDashboardScreen() {
  const { themeColors } = useTheme();

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [verifications, setVerifications] = useState<VerificationReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const [metricsData, verifData] = await Promise.allSettled([
        adminService.getMetrics(),
        adminService.getVerifications(),
      ]);

      if (metricsData.status === 'fulfilled') {
        setMetrics(metricsData.value);
      }
      if (verifData.status === 'fulfilled') {
        setVerifications(verifData.value);
      }
      if (metricsData.status === 'rejected' && verifData.status === 'rejected') {
        setError('Failed to load administrative telemetry.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to administrative telemetry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleAction = async (item: VerificationReview, approve: boolean) => {
    setActionLoadingId(item.id);
    try {
      await adminService.decideVerification(item.id, approve ? 'approve' : 'reject');
      Haptics.notificationAsync(
        approve
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );

      setVerifications((prev) => prev.filter((v) => v.id !== item.id));

      Alert.alert(
        approve ? 'Provider Verified ✅' : 'Application Rejected ❌',
        approve
          ? `Provider credentials verified and active on CallMedex directory.`
          : `Provider verification rejected.`
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Action Failed', err.message || 'Could not update verification status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="CallMedex Master Control"
        subtitle="KYC Approval, Telemetry & Operations"
        rightAction={<Badge label="SUPER ADMIN" variant="role" />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !metrics ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={themeColors.primary.DEFAULT} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Loading platform telemetry...
            </Text>
          </View>
        ) : error && !metrics ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>{error}</Text>
            <Button title="Retry" onPress={fetchDashboardData} variant="primary" size="sm" style={{ marginTop: spacing.md }} />
          </View>
        ) : (
          <>
            {/* System KPIs */}
            <View style={styles.kpiRow}>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiVal, { color: themeColors.primary.DEFAULT }]}>
                  {metrics?.total_users ?? 0}
                </Text>
                <Text style={[styles.kpiLab, { color: themeColors.textSecondary }]}>Total Registered</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiVal, { color: '#00D4B2' }]}>
                  {metrics?.total_bookings ?? 0}
                </Text>
                <Text style={[styles.kpiLab, { color: themeColors.textSecondary }]}>Active Bookings</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiVal, { color: themeColors.accent.dark }]}>
                  ₹{metrics?.total_revenue ?? 0}
                </Text>
                <Text style={[styles.kpiLab, { color: themeColors.textSecondary }]}>Gross Revenue</Text>
              </Card>
            </View>

            {/* MediAssist AI & WhatsApp Sync Card */}
            <Card style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
                    MediAssist AI Pipeline
                  </Text>
                  <Text style={[styles.cardSub, { color: themeColors.textSecondary }]}>
                    Canonical PDF Claiming & WhatsApp Webhook Engine
                  </Text>
                </View>
                <Badge label="ACTIVE" variant="success" />
              </View>

              <View style={[styles.sysStats, { borderTopColor: themeColors.border }]}>
                <Text style={[styles.statLine, { color: themeColors.textSecondary }]}>
                  • MediAssist Bridge: <Text style={{ color: '#00D4B2', fontWeight: 'bold' }}>Connected</Text>
                </Text>
                <Text style={[styles.statLine, { color: themeColors.textSecondary }]}>
                  • SMS/WhatsApp Dispatch: <Text style={{ color: '#00D4B2', fontWeight: 'bold' }}>DLT Registered</Text>
                </Text>
                <Text style={[styles.statLine, { color: themeColors.textSecondary }]}>
                  • Daily.co Telemedicine: <Text style={{ color: '#00D4B2', fontWeight: 'bold' }}>Operational</Text>
                </Text>
              </View>
            </Card>

            {/* KYC & Provider Approvals Queue */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.secTitle, { color: themeColors.textPrimary }]}>
                Provider KYC Approval Queue
              </Text>
              <Badge label={`${verifications.length} PENDING`} variant="warning" />
            </View>

            {verifications.length === 0 ? (
              <Card style={[styles.card, { alignItems: 'center', padding: spacing.lg }]}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>✅</Text>
                <Text style={[styles.cardTitle, { color: themeColors.textPrimary, textAlign: 'center' }]}>
                  No Pending Verifications
                </Text>
                <Text style={[styles.cardSub, { color: themeColors.textSecondary, textAlign: 'center' }]}>
                  All healthcare provider registrations have been reviewed and decided.
                </Text>
              </Card>
            ) : (
              verifications.map((item) => {
                const isItemActioning = actionLoadingId === item.id;
                return (
                  <Card key={item.id} style={styles.verifCard}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.provName, { color: themeColors.textPrimary }]}>
                          {item.user_name || `Provider #${item.user_id.slice(0, 8)}`}
                        </Text>
                        <Text style={[styles.provRole, { color: themeColors.textSecondary }]}>
                          Role: {(item.user_role || 'provider').toUpperCase()}
                        </Text>
                        <Text style={[styles.provReg, { color: themeColors.primary.DEFAULT }]}>
                          Document: {item.document_type || 'Registration Certificate'}
                        </Text>
                        <Text style={[styles.provTime, { color: themeColors.textMuted }]}>
                          Submitted: {new Date(item.submitted_at || Date.now()).toLocaleDateString()}
                        </Text>
                      </View>
                      <Badge label={(item.status || 'PENDING').toUpperCase()} variant="warning" />
                    </View>

                    <View style={[styles.verifActions, { borderTopColor: themeColors.border }]}>
                      <Button
                        title="❌ Reject"
                        onPress={() => handleAction(item, false)}
                        variant="danger"
                        size="sm"
                        style={{ flex: 1, marginRight: 8 }}
                        loading={isItemActioning}
                        disabled={isItemActioning}
                      />
                      <Button
                        title="✅ Approve & Verify"
                        onPress={() => handleAction(item, true)}
                        variant="primary"
                        size="sm"
                        style={{ flex: 1.2 }}
                        loading={isItemActioning}
                        disabled={isItemActioning}
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  centerContainer: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.body },
  errorText: { fontSize: typography.fontSize.body, textAlign: 'center' },
  kpiRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  kpiCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  kpiVal: { fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.bold },
  kpiLab: { fontSize: typography.fontSize.tiny, marginTop: 4, textAlign: 'center' },
  card: { marginTop: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  cardSub: { fontSize: typography.fontSize.caption, marginTop: 2 },
  sysStats: { marginTop: spacing.md, borderTopWidth: 1, paddingTop: spacing.sm },
  statLine: { fontSize: typography.fontSize.caption, marginVertical: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xs },
  secTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  verifCard: { marginTop: spacing.sm },
  provName: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold },
  provRole: { fontSize: typography.fontSize.caption, marginTop: 2 },
  provReg: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginTop: 2 },
  provTime: { fontSize: typography.fontSize.tiny, marginTop: 2 },
  verifActions: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
});
