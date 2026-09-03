import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { consultationService } from '../../src/services/consultationApi';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { ConsultationResponse } from '../../src/types/api';

export default function DoctorConsultationsScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();

  const [consults, setConsults] = useState<ConsultationResponse[]>([]);
  const [activeConsults, setActiveConsults] = useState<ConsultationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConsultations = useCallback(async () => {
    try {
      setError(null);
      const [activeRes, histRes] = await Promise.allSettled([
        consultationService.getActive(),
        consultationService.getHistory(),
      ]);

      if (activeRes.status === 'fulfilled') {
        setActiveConsults(activeRes.value || []);
      }
      if (histRes.status === 'fulfilled') {
        setConsults(histRes.value || []);
      }
      if (activeRes.status === 'rejected' && histRes.status === 'rejected') {
        setError('Failed to load doctor consultations.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load teleconsultation queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConsultations();
  };

  const handleJoinCall = (consult: ConsultationResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/consultation/video',
      params: { id: consult.id, roomUrl: consult.room_url, token: consult.room_token },
    });
  };

  const handleWritePrescription = (consult: ConsultationResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(doctor)/prescriptions',
      params: { consultationId: consult.id, patientId: consult.patient_id },
    });
  };

  const allDisplayConsults = [...activeConsults, ...consults.filter((c) => !activeConsults.some((a) => a.id === c.id))];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Teleconsultations"
        subtitle="Daily.co Video Rooms & Live Queue"
        rightAction={<Badge label={`${activeConsults.length} WAITING`} variant={activeConsults.length > 0 ? 'warning' : 'neutral'} />}
      />

      {loading && allDisplayConsults.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading teleconsultation rooms...
          </Text>
        </View>
      ) : error && allDisplayConsults.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>{error}</Text>
          <Button title="Retry" onPress={fetchConsultations} variant="primary" size="sm" style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={allDisplayConsults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Card style={[styles.card, { alignItems: 'center', padding: spacing.xl }]}>
              <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>📹</Text>
              <Text style={[styles.patientName, { color: themeColors.textPrimary, textAlign: 'center' }]}>
                No Active Teleconsultations
              </Text>
              <Text style={[styles.patientMeta, { color: themeColors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
                When patients book online appointments or enter your virtual waiting room, they will appear here.
              </Text>
            </Card>
          }
          renderItem={({ item }) => {
            const isWaiting = item.status === 'in_waiting_room' || item.status === 'waiting' || item.status === 'active';
            const patientLabel = `Patient #${item.patient_id.slice(0, 8)}`;
            const dateStr = new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.patientName, { color: themeColors.textPrimary }]}>
                      {patientLabel}
                    </Text>
                    <Text style={[styles.patientMeta, { color: themeColors.textSecondary }]}>
                      Consultation ID: {item.id.slice(0, 10)}
                    </Text>
                    {item.prescription?.diagnosis && (
                      <Text style={[styles.symptoms, { color: themeColors.primary.DEFAULT }]}>
                        Diagnosis: {item.prescription.diagnosis}
                      </Text>
                    )}
                    <Text style={[styles.time, { color: themeColors.accent.dark }]}>
                      ⏰ {dateStr}
                    </Text>
                  </View>
                  <Badge
                    label={isWaiting ? 'PATIENT WAITING' : item.status.toUpperCase()}
                    variant={isWaiting ? 'danger' : item.status === 'completed' ? 'success' : 'info'}
                  />
                </View>

                <View style={[styles.actionRow, { borderTopColor: themeColors.border }]}>
                  <Button
                    title="🎥 Join Video Room"
                    onPress={() => handleJoinCall(item)}
                    variant="accent"
                    size="sm"
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="📝 e-Prescription"
                    onPress={() => handleWritePrescription(item)}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.body },
  errorText: { fontSize: typography.fontSize.body, textAlign: 'center' },
  card: { marginTop: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  patientName: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  patientMeta: { fontSize: typography.fontSize.caption, marginTop: 2 },
  symptoms: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginTop: 4 },
  time: { fontSize: typography.fontSize.tiny, marginTop: 2 },
  actionRow: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
});
