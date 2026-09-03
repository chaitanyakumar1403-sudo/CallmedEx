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
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { consultationService } from '../../src/services/consultationApi';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { ConsultationResponse } from '../../src/types/api';

interface DoctorPatientSummary {
  patientId: string;
  patientName: string;
  lastVisit: string;
  diagnosis: string;
  status: string;
  totalConsultations: number;
}

export default function DoctorPatientsScreen() {
  const { themeColors } = useTheme();
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      setError(null);
      const consults: ConsultationResponse[] = await consultationService.getHistory();

      // Aggregate consultations by patient_id for doctor
      const patientMap = new Map<string, DoctorPatientSummary>();

      for (const c of consults) {
        const pId = c.patient_id;
        const existing = patientMap.get(pId);
        const consultDate = new Date(c.created_at || Date.now()).toLocaleDateString();
        const diag = c.prescription?.diagnosis || 'General Clinical Consultation';

        if (!existing) {
          patientMap.set(pId, {
            patientId: pId,
            patientName: `Patient #${pId.slice(0, 8)}`,
            lastVisit: consultDate,
            diagnosis: diag,
            status: c.status === 'completed' ? 'ACTIVE' : 'FOLLOW_UP',
            totalConsultations: 1,
          });
        } else {
          existing.totalConsultations += 1;
        }
      }

      setPatients(Array.from(patientMap.values()));
    } catch (err: any) {
      setError(err.message || 'Failed to load authorized patient list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.patientName.toLowerCase().includes(search.toLowerCase()) ||
      p.diagnosis.toLowerCase().includes(search.toLowerCase()) ||
      p.patientId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Patient Records & EHR"
        subtitle="Clinical History & Authorized Patients"
        rightAction={<Badge label={`${patients.length} PATIENTS`} variant="info" />}
      />

      <View style={styles.content}>
        <Input
          placeholder="Search authorized patient by ID or condition..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Text style={{ fontSize: 16 }}>🔍</Text>}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ marginTop: spacing.md, marginBottom: spacing.sm }}
        />

        {loading && patients.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={themeColors.primary.DEFAULT} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Loading authorized clinical records...
            </Text>
          </View>
        ) : error && patients.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>{error}</Text>
            <Button title="Retry" onPress={fetchPatients} variant="primary" size="sm" style={{ marginTop: spacing.md }} />
          </View>
        ) : (
          <FlatList
            data={filteredPatients}
            keyExtractor={(item) => item.patientId}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <Card style={[styles.card, { alignItems: 'center', padding: spacing.xl }]}>
                <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>👨‍⚕️</Text>
                <Text style={[styles.patientName, { color: themeColors.textPrimary, textAlign: 'center' }]}>
                  {search ? 'No Matching Patients' : 'No Patients Yet'}
                </Text>
                <Text style={[styles.phone, { color: themeColors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
                  {search
                    ? 'Try searching with a different patient ID or medical term.'
                    : 'Patients who complete telemedicine consultations with you will appear here.'}
                </Text>
              </Card>
            }
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.patientName, { color: themeColors.textPrimary }]}>
                      {item.patientName}
                    </Text>
                    <Text style={[styles.phone, { color: themeColors.textSecondary }]}>
                      ID: {item.patientId}
                    </Text>
                    <Text style={[styles.chronic, { color: themeColors.primary.DEFAULT }]}>
                      Condition: {item.diagnosis}
                    </Text>
                    <Text style={[styles.visit, { color: themeColors.textMuted }]}>
                      Last Visit: {item.lastVisit} • {item.totalConsultations} Consult(s)
                    </Text>
                  </View>
                  <Badge
                    label={item.status}
                    variant={item.status === 'ACTIVE' ? 'success' : 'info'}
                  />
                </View>

                <Button
                  title="📂 View Complete Medical Chart"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(
                      'Patient EHR Chart',
                      `Patient ID: ${item.patientId}\nLatest Condition: ${item.diagnosis}\nTotal Encounters: ${item.totalConsultations}\n\nClinical chart encrypted under ABDM Level-M3 policy.`
                    );
                  }}
                  variant="outline"
                  size="sm"
                  style={{ marginTop: spacing.sm }}
                />
              </Card>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.screenPaddingHorizontal },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.body },
  errorText: { fontSize: typography.fontSize.body, textAlign: 'center' },
  card: { marginTop: spacing.sm, padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  patientName: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  phone: { fontSize: typography.fontSize.caption, marginTop: 2 },
  chronic: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginTop: 4 },
  visit: { fontSize: typography.fontSize.tiny, marginTop: 2 },
});
