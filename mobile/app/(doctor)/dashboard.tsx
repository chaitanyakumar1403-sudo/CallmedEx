import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Pill } from '../../src/components/ui/Pill';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { api } from '../../src/services/api';

// Provider widgets
import {
  ProviderDispatchTracker,
  ScheduleHeatmap,
  AttendanceCard,
} from '../../src/components/dashboard';

export default function DoctorDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { themeColors } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    todayPatients: 0,
    waitingTeleconsults: 0,
    completed: 0,
    todayEarnings: '₹0',
  });

  const [queue, setQueue] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [queueRes, statsRes] = await Promise.allSettled([
        api.get('/api/doctor/queue'),
        api.get('/api/doctor/stats'),
      ]);

      if (queueRes.status === 'fulfilled' && queueRes.value?.data) {
        const qList = queueRes.value.data.queue || queueRes.value.data || [];
        if (Array.isArray(qList)) setQueue(qList);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStats({
          todayPatients: statsRes.value.data.today_patients || 0,
          waitingTeleconsults: statsRes.value.data.waiting_teleconsults || 0,
          completed: statsRes.value.data.completed || 0,
          todayEarnings: `₹${(statsRes.value.data.today_earnings || 0).toLocaleString('en-IN')}`,
        });
      }
    } catch {
      // Offline fallback
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

  const handleStartConsultation = (item: any) => {
    Alert.alert(
      'Start Clinical Teleconsult',
      `Launch secure Daily.co video consultation room with ${item.patient || item.patient_name || 'Patient'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Video Call',
          onPress: () => {
            router.push({
              pathname: '/consultation/video',
              params: {
                appointment_id: item.id,
                room_url: item.room_url || 'https://callmedex.daily.co/clinical-room',
                doctor_name: user?.full_name || 'Physician',
              },
            });
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title={`Dr. ${user?.full_name?.replace('Dr.', '').trim() || 'Physician'}`}
        subtitle="Clinical Operations Dashboard • CallMedex Doctor Network"
        rightAction={<Pill label="NMC Verified" variant="done" />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 1. Daily Shift Attendance */}
        <AttendanceCard onCheckInSuccess={() => loadData()} />

        {/* 2. Urgent Home Doctor Dispatch Tracker */}
        <ProviderDispatchTracker
          providerType="doctor"
          earningsRate={600}
          onTaskCompleted={() => loadData()}
        />

        {/* 3. KPI Metrics */}
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: themeColors.primary.DEFAULT }]}>
              {stats.todayPatients || queue.length}
            </Text>
            <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>Total Today</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#d92020' }]}>
              {stats.waitingTeleconsults || queue.filter((q) => q.status === 'WAITING').length}
            </Text>
            <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>In Waiting</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#15803d' }]}>
              {stats.todayEarnings}
            </Text>
            <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>Today&apos;s Payout</Text>
          </Card>
        </View>

        {/* 4. 7-Day Clinical Schedule Heatmap */}
        <ScheduleHeatmap
          onSlotClick={(dayIdx, blockIdx) => router.push('/(doctor)/schedule')}
        />

        {/* 5. Live Patient Consultation Queue */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
            Live Patient Consultation Queue
          </Text>
          <TouchableOpacity onPress={() => router.push('/(doctor)/consultations')}>
            <Text style={[styles.viewAllText, { color: themeColors.accent.dark }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {queue.length > 0 ? (
          queue.map((q, idx) => (
            <Card key={q.id || idx} style={styles.queueCard}>
              <View style={styles.queueHeader}>
                <View style={[styles.tokenBadge, { backgroundColor: themeColors.primary.DEFAULT }]}>
                  <Text style={styles.tokenText}>{q.token || `#${idx + 1}`}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.patientName, { color: themeColors.textPrimary }]}>
                    {q.patient || q.patient_name || 'Registered Patient'}
                  </Text>
                  <Text style={[styles.timeType, { color: themeColors.textSecondary }]}>
                    ⏰ {q.time || 'Today'} • {q.type || 'Teleconsult'}
                  </Text>
                </View>
                <Badge
                  label={q.status || 'CONFIRMED'}
                  variant={q.status === 'WAITING' ? 'danger' : 'info'}
                />
              </View>

              {q.status === 'WAITING' && (
                <Button
                  title="🎥 Launch Teleconsult Video Call"
                  onPress={() => handleStartConsultation(q)}
                  variant="primary"
                  size="sm"
                  style={{ marginTop: spacing.md }}
                />
              )}
            </Card>
          ))
        ) : (
          <Card style={styles.queueCard}>
            <Text style={[styles.emptyQueueText, { color: themeColors.textSecondary }]}>
              No patients currently waiting in your consultation queue.
            </Text>
          </Card>
        )}

        {/* 6. Quick Clinical Tools */}
        <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>Clinical Tools & Records</Text>
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={[styles.toolCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => router.push('/(doctor)/schedule')}
          >
            <Text style={styles.toolIcon}>📅</Text>
            <Text style={[styles.toolTitle, { color: themeColors.textPrimary }]}>Manage Hours</Text>
            <Text style={[styles.toolSub, { color: themeColors.textSecondary }]}>Set Availability</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => router.push('/(doctor)/patients')}
          >
            <Text style={styles.toolIcon}>📁</Text>
            <Text style={[styles.toolTitle, { color: themeColors.textPrimary }]}>Patient EHR</Text>
            <Text style={[styles.toolSub, { color: themeColors.textSecondary }]}>Lookup Records</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => router.push('/(doctor)/prescriptions')}
          >
            <Text style={styles.toolIcon}>📝</Text>
            <Text style={[styles.toolTitle, { color: themeColors.textPrimary }]}>e-Prescriptions</Text>
            <Text style={[styles.toolSub, { color: themeColors.textSecondary }]}>Sign & Dispatch</Text>
          </TouchableOpacity>
        </View>
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
    paddingBottom: 110,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  kpiCard: {
    flex: 1,
    padding: spacing.sm,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  kpiLabel: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  viewAllText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  queueCard: {
    marginBottom: spacing.sm,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenText: {
    color: '#00D4B2',
    fontSize: 14,
    fontWeight: '800',
  },
  patientName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  timeType: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  emptyQueueText: {
    fontSize: typography.fontSize.caption,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
  },
  toolCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
  },
  toolIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  toolTitle: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  toolSub: {
    fontSize: 10,
    marginTop: 2,
  },
});
