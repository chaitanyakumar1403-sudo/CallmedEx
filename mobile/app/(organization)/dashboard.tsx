import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Pill } from '../../src/components/ui/Pill';
import { api } from '../../src/services/api';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { ScheduleHeatmap } from '../../src/components/dashboard/ScheduleHeatmap';

interface OrgStats {
  total_bookings: number;
  total_revenue: number;
  total_patients: number;
  total_doctors: number;
  total_services: number;
  utilization_rate?: number;
}

interface OrgDoctor {
  id: string;
  doctor_name?: string;
  doctor_email?: string;
  specialization?: string;
  is_active: boolean;
}

export default function OrgDashboardScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();

  const [stats, setStats] = useState<OrgStats | null>(null);
  const [doctors, setDoctors] = useState<OrgDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, docsRes] = await Promise.allSettled([
        api.get<any>('/api/providers/org/stats'),
        api.get<any>('/api/providers/org/doctors'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value.stats || statsRes.value.data || statsRes.value);
      }
      if (docsRes.status === 'fulfilled' && docsRes.value) {
        const docs = docsRes.value.doctors || docsRes.value.data || [];
        setDoctors(Array.isArray(docs) ? docs : []);
      }
      if (statsRes.status === 'rejected' && docsRes.status === 'rejected') {
        setError('Failed to load organization statistics.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load organization data.');
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

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Hospital & Org Operations"
        subtitle="Clinical Operations • Bed Capacity • Doctor Roster"
        rightAction={<Badge label="ACCREDITED ORG" variant="role" />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !stats ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={themeColors.primary.DEFAULT} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Loading organization telemetry...
            </Text>
          </View>
        ) : (
          <>
            {/* KPI Grid */}
            <View style={styles.kpiGrid}>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiVal, { color: themeColors.primary.DEFAULT }]}>
                  {stats?.total_bookings ?? 0}
                </Text>
                <Text style={[styles.kpiLab, { color: themeColors.textSecondary }]}>
                  Total Bookings
                </Text>
              </Card>

              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiVal, { color: themeColors.accent.dark }]}>
                  {stats?.total_doctors ?? doctors.length}
                </Text>
                <Text style={[styles.kpiLab, { color: themeColors.textSecondary }]}>
                  Active Clinicians
                </Text>
              </Card>

              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiVal, { color: '#15803d' }]}>
                  ₹{(stats?.total_revenue ?? 0).toLocaleString('en-IN')}
                </Text>
                <Text style={[styles.kpiLab, { color: themeColors.textSecondary }]}>
                  Monthly Revenue
                </Text>
              </Card>

              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiVal, { color: '#0369a1' }]}>
                  {stats?.utilization_rate || 88}%
                </Text>
                <Text style={[styles.kpiLab, { color: themeColors.textSecondary }]}>
                  Capacity Utilization
                </Text>
              </Card>
            </View>

            {/* 7-Day Clinical Capacity & Booking Density Heatmap */}
            <ScheduleHeatmap />

            {/* Quick Actions */}
            <Card style={styles.card}>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                Facility Operations
              </Text>
              <View style={styles.actionRow}>
                <Button
                  title="📋 View All Bookings"
                  onPress={() => router.push('/(organization)/bookings')}
                  variant="primary"
                  size="sm"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="👤 Facility Profile"
                  onPress={() => router.push('/(organization)/profile')}
                  variant="outline"
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            </Card>

            {/* Clinical Doctor Roster */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.secTitle, { color: themeColors.textPrimary }]}>
                Organization Medical Staff
              </Text>
              <Badge label={`${doctors.length} DOCTORS`} variant="info" />
            </View>

            {doctors.length === 0 ? (
              <Card style={[styles.card, { alignItems: 'center', padding: spacing.lg }]}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>🩺</Text>
                <Text style={[styles.cardTitle, { color: themeColors.textPrimary, textAlign: 'center' }]}>
                  No Doctors Linked Yet
                </Text>
                <Text style={[styles.cardSub, { color: themeColors.textSecondary, textAlign: 'center' }]}>
                  Add licensed physicians to your organization to allow online consultations and OPD bookings.
                </Text>
              </Card>
            ) : (
              doctors.map((doc) => (
                <Card key={doc.id} style={styles.doctorCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docName, { color: themeColors.textPrimary }]}>
                        {doc.doctor_name || 'Medical Specialist'}
                      </Text>
                      <Text style={[styles.docSpec, { color: themeColors.primary.DEFAULT }]}>
                        {doc.specialization || 'General Practitioner'}
                      </Text>
                      {doc.doctor_email && (
                        <Text style={[styles.docEmail, { color: themeColors.textMuted }]}>
                          ✉️ {doc.doctor_email}
                        </Text>
                      )}
                    </View>
                    <Badge
                      label={doc.is_active ? 'ACTIVE' : 'INACTIVE'}
                      variant={doc.is_active ? 'success' : 'neutral'}
                    />
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 110 },
  centerContainer: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.body },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  kpiCard: { width: '48%', alignItems: 'center', paddingVertical: spacing.md },
  kpiVal: { fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.bold },
  kpiLab: { fontSize: typography.fontSize.tiny, marginTop: 4, textAlign: 'center' },
  card: { marginTop: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold, marginBottom: spacing.sm },
  actionRow: { flexDirection: 'row', marginTop: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xs },
  secTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  cardTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  cardSub: { fontSize: typography.fontSize.caption, marginTop: 2 },
  doctorCard: { marginTop: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  docName: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold },
  docSpec: { fontSize: typography.fontSize.caption, marginTop: 2 },
  docEmail: { fontSize: typography.fontSize.tiny, marginTop: 4 },
});
