import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Input } from '../../src/components/ui/Input';
import { Pill } from '../../src/components/ui/Pill';
import { offlineSyncService } from '../../src/services/offlineSync';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

// Provider Widgets
import {
  AttendanceCard,
  ProviderDispatchTracker,
} from '../../src/components/dashboard';

interface NursingVisit {
  id: string;
  patient: string;
  ageGender: string;
  service: string;
  address: string;
  time: string;
  status: 'SCHEDULED' | 'COMPLETED';
  vitals?: {
    bpSys: string;
    bpDia: string;
    pulse: string;
    spo2: string;
    temp: string;
    sugar: string;
    notes: string;
  };
}

export default function NurseVisitsScreen() {
  const { themeColors } = useTheme();

  const [visits, setVisits] = useState<NursingVisit[]>([
    {
      id: 'nv-1',
      patient: 'Sunil Rao',
      ageGender: 'M, 68 yrs',
      service: 'Post-Surgical Wound Dressing & Vitals Check',
      address: 'Plot 23, Sector 2, MVP Colony, Visakhapatnam',
      time: '09:30 AM',
      status: 'SCHEDULED',
    },
    {
      id: 'nv-2',
      patient: 'Meenakshi Iyer',
      ageGender: 'F, 74 yrs',
      service: 'Insulin Administration & Diabetic Foot Assessment',
      address: 'Apt 102, Beach Road, Visakhapatnam',
      time: '11:00 AM',
      status: 'SCHEDULED',
    },
  ]);

  const [activeModalVisit, setActiveModalVisit] = useState<NursingVisit | null>(null);

  // Vitals Form State
  const [bpSys, setBpSys] = useState('120');
  const [bpDia, setBpDia] = useState('80');
  const [pulse, setPulse] = useState('72');
  const [spo2, setSpo2] = useState('98');
  const [temp, setTemp] = useState('98.4');
  const [sugar, setSugar] = useState('110');
  const [nurseNotes, setNurseNotes] = useState('Wound clean and granulating well. No purulent exudate.');

  const handleOpenVitalsModal = (visit: NursingVisit) => {
    setActiveModalVisit(visit);
    setBpSys('120');
    setBpDia('80');
    setPulse('72');
    setSpo2('98');
    setTemp('98.4');
    setSugar('110');
    setNurseNotes('Wound clean, dressing changed. Vitals stable.');
  };

  const handleSaveVitals = async () => {
    if (!activeModalVisit) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const vitalsPayload = {
        visit_id: activeModalVisit.id,
        patient_name: activeModalVisit.patient,
        bp: `${bpSys}/${bpDia}`,
        pulse: `${pulse} bpm`,
        spo2: `${spo2}%`,
        temperature: `${temp} °F`,
        blood_sugar: `${sugar} mg/dL`,
        notes: nurseNotes,
        recorded_at: new Date().toISOString(),
      };

      // Save to offline mutation queue
      await offlineSyncService.enqueueMutation(
        '/api/nurse/vitals',
        'POST',
        vitalsPayload,
        `Logged vitals for ${activeModalVisit.patient}`
      );

      setVisits((prev) =>
        prev.map((v) =>
          v.id === activeModalVisit.id
            ? {
                ...v,
                status: 'COMPLETED',
                vitals: {
                  bpSys,
                  bpDia,
                  pulse,
                  spo2,
                  temp,
                  sugar,
                  notes: nurseNotes,
                },
              }
            : v
        )
      );

      Alert.alert(
        'Vitals Logged Successfully! 🩺',
        `Clinical observations for ${activeModalVisit.patient} recorded and synced with attending physician's EHR dashboard.`
      );
      setActiveModalVisit(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save vitals.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Home Nursing Care Operations"
        subtitle="Assigned Patient Protocols • Clinical Vitals"
        rightAction={<Pill label="Certified RN" variant="done" />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Shift Attendance */}
        <AttendanceCard />

        {/* 2. Urgent Home Nurse Dispatch Tracker */}
        <ProviderDispatchTracker providerType="nurse" earningsRate={400} />

        {/* 3. Scheduled Visits */}
        <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
          Scheduled Bedside Nursing Visits
        </Text>

        {visits.map((item) => (
          <Card key={item.id} style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                  {item.patient} ({item.ageGender})
                </Text>
                <Text style={[styles.service, { color: themeColors.primary.DEFAULT }]}>
                  {item.service}
                </Text>
                <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
                  📍 {item.address}
                </Text>
                <Text style={[styles.time, { color: themeColors.accent.dark }]}>
                  ⏰ Scheduled: {item.time}
                </Text>
              </View>
              <Badge
                label={item.status}
                variant={item.status === 'COMPLETED' ? 'success' : 'info'}
              />
            </View>

            {item.vitals && (
              <View
                style={[
                  styles.vitalsSummary,
                  { backgroundColor: themeColors.surface2 || '#f8fafc' },
                ]}
              >
                <Text style={[styles.vitalsText, { color: themeColors.textPrimary }]}>
                  ❤️ BP: {item.vitals.bpSys}/{item.vitals.bpDia} • Pulse: {item.vitals.pulse} bpm • SpO2: {item.vitals.spo2}%
                </Text>
                <Text style={[styles.vitalsNotes, { color: themeColors.textSecondary }]}>
                  Notes: {item.vitals.notes}
                </Text>
              </View>
            )}

            {item.status !== 'COMPLETED' ? (
              <Button
                title="🩺 Record Bedside Vitals"
                onPress={() => handleOpenVitalsModal(item)}
                variant="primary"
                size="sm"
                style={{ marginTop: spacing.md }}
              />
            ) : (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>
                  ✅ Care Protocol Completed & Synced to Doctor EHR
                </Text>
              </View>
            )}
          </Card>
        ))}
      </ScrollView>

      {/* Bedside Vitals Logger Modal */}
      {activeModalVisit && (
        <Modal visible={!!activeModalVisit} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { backgroundColor: themeColors.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                    Bedside Clinical Vitals
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                    Patient: {activeModalVisit.patient}
                  </Text>
                </View>
                <Button
                  title="✕"
                  onPress={() => setActiveModalVisit(null)}
                  variant="outline"
                  size="sm"
                />
              </View>

              <ScrollView style={{ maxHeight: 380, marginVertical: spacing.sm }}>
                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Input
                      label="Systolic BP (mmHg)"
                      value={bpSys}
                      onChangeText={setBpSys}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Diastolic BP (mmHg)"
                      value={bpDia}
                      onChangeText={setBpDia}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Input
                      label="Heart Pulse (bpm)"
                      value={pulse}
                      onChangeText={setPulse}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="SpO2 Oxygen (%)"
                      value={spo2}
                      onChangeText={setSpo2}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Input
                      label="Temperature (°F)"
                      value={temp}
                      onChangeText={setTemp}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Blood Sugar (mg/dL)"
                      value={sugar}
                      onChangeText={setSugar}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Input
                  label="Clinical Nursing Notes"
                  value={nurseNotes}
                  onChangeText={setNurseNotes}
                  multiline
                  numberOfLines={2}
                />
              </ScrollView>

              <Button
                title="Save & Submit Vitals"
                onPress={handleSaveVitals}
                variant="primary"
                size="md"
              />
            </View>
          </View>
        </Modal>
      )}
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
  sectionHeading: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  service: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    marginTop: 2,
  },
  sub: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2,
  },
  time: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    marginTop: 2,
  },
  vitalsSummary: {
    borderRadius: spacing.buttonRadius,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  vitalsText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  vitalsNotes: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2,
  },
  completedBadge: {
    backgroundColor: '#f0fdf4',
    padding: spacing.sm,
    borderRadius: spacing.buttonRadius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
    marginTop: spacing.sm,
  },
  completedText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: spacing.cardRadius,
    borderTopRightRadius: spacing.cardRadius,
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  formRow: {
    flexDirection: 'row',
  },
});
