import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Pill } from '../../src/components/ui/Pill';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { offlineSyncService } from '../../src/services/offlineSync';

// Provider Dashboard Widgets
import {
  AttendanceCard,
  ProviderDispatchTracker,
  PhleboPerformanceCard,
  PhleboWalletCard,
  PhleboStockCard,
} from '../../src/components/dashboard';

interface PhlebotomyTask {
  id: string;
  patient: string;
  phone: string;
  address: string;
  tests: string[];
  time: string;
  fasting: string;
  status: string;
  collectionOtp: string;
}

export default function PhlebotomistTasksScreen() {
  const { themeColors } = useTheme();

  const [tasks, setTasks] = useState<PhlebotomyTask[]>([
    {
      id: 't-1',
      patient: 'Suresh Menon',
      phone: '+919876543210',
      address: 'Flat 402, Sector 4, MVP Colony, Visakhapatnam',
      tests: ['Complete Hemogram (CBC)', 'HbA1c Glycated Hemoglobin', 'Lipid Profile'],
      time: '07:30 AM',
      fasting: '10-12 hrs Fasting Required',
      status: 'DISPATCHED',
      collectionOtp: '4829',
    },
    {
      id: 't-2',
      patient: 'Anita Deshmukh',
      phone: '+919812345678',
      address: 'House #12, Gajuwaka Main Road, Visakhapatnam',
      tests: ['Thyroid Profile (T3, T4, TSH)', 'Serum Vitamin D'],
      time: '08:45 AM',
      fasting: 'Non-Fasting',
      status: 'CONFIRMED',
      collectionOtp: '9103',
    },
  ]);

  const [activeTaskModal, setActiveTaskModal] = useState<PhlebotomyTask | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [barcode, setBarcode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenCollection = (task: PhlebotomyTask) => {
    setActiveTaskModal(task);
    setEnteredOtp('');
    setBarcode(`VAC-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const handleConfirmCollection = async () => {
    if (!activeTaskModal) return;

    if (!enteredOtp || enteredOtp.trim() !== activeTaskModal.collectionOtp) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit verification code provided by the patient.');
      return;
    }

    try {
      setSubmitting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Save mutation to offline sync queue
      await offlineSyncService.enqueueMutation(
        '/api/samples/collect',
        'POST',
        {
          task_id: activeTaskModal.id,
          barcode,
          patient_name: activeTaskModal.patient,
          collected_at: new Date().toISOString(),
        },
        `Sample collection for ${activeTaskModal.patient} (${barcode})`
      );

      // Update state locally
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTaskModal.id ? { ...t, status: 'COLLECTED' } : t
        )
      );

      Alert.alert(
        'Sample Collected! 🧪',
        `Vacutainer barcode ${barcode} registered & cold-chain sealed. Ready for lab handover.`
      );
      setActiveTaskModal(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not record collection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Field Phlebotomy Dashboard"
        subtitle="Sample Collection Queue • GPS Dispatch • Cold-Chain Tracking"
        rightAction={<Pill label="Certified Phlebo" variant="done" />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Shift Attendance */}
        <AttendanceCard />

        {/* 2. Dispatch Tracker */}
        <ProviderDispatchTracker providerType="phlebotomist" earningsRate={250} />

        {/* 3. Performance & 30-Day Activity Heatmap */}
        <PhleboPerformanceCard />

        {/* 4. Earnings & Payout Wallet */}
        <PhleboWalletCard
          onWithdrawClick={() =>
            Alert.alert('UPI Transfer Initiated', 'Your earnings have been queued for instant settlement.')
          }
        />

        {/* 5. Phlebotomy Kit Stock & Vacutainers */}
        <PhleboStockCard />

        {/* 6. Active Sample Tasks Queue */}
        <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
          Scheduled Doorstep Collection Visits
        </Text>

        {tasks.map((item) => (
          <Card key={item.id} style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.patientName, { color: themeColors.textPrimary }]}>
                  {item.patient}
                </Text>
                <Text style={[styles.time, { color: themeColors.accent.dark }]}>
                  ⏰ Scheduled: {item.time}
                </Text>
                <Text style={[styles.address, { color: themeColors.textSecondary }]}>
                  📍 {item.address}
                </Text>
              </View>
              <Badge
                label={item.status}
                variant={item.status === 'COLLECTED' ? 'success' : 'info'}
              />
            </View>

            <View style={[styles.testsBox, { backgroundColor: themeColors.surface2 || '#f8fafc' }]}>
              <Text style={styles.fastingNotice}>⚠️ {item.fasting}</Text>
              {item.tests.map((t, idx) => (
                <Text key={idx} style={[styles.testItem, { color: themeColors.textPrimary }]}>
                  • {t}
                </Text>
              ))}
            </View>

            {item.status !== 'COLLECTED' ? (
              <View style={styles.actionRow}>
                <Button
                  title="🗺️ GPS Navigation"
                  onPress={() =>
                    Alert.alert('GPS Navigation', `Turn-by-turn routing active to ${item.address}`)
                  }
                  variant="outline"
                  size="sm"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="🧪 Verify & Collect"
                  onPress={() => handleOpenCollection(item)}
                  variant="primary"
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            ) : (
              <View style={styles.collectedBanner}>
                <Text style={styles.collectedText}>
                  ✅ Sample Cold-Chain Sealed • Logged for Lab Transfer
                </Text>
              </View>
            )}
          </Card>
        ))}
      </ScrollView>

      {/* Collection Verification Modal */}
      {activeTaskModal && (
        <Modal visible={!!activeTaskModal} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                Doorstep Sample Collection Verification
              </Text>
              <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                Patient: {activeTaskModal.patient}
              </Text>

              <View style={{ marginTop: spacing.md }}>
                <Input
                  label="Patient 4-Digit Doorstep PIN"
                  placeholder="Enter 4-digit code (e.g. 4829)"
                  value={enteredOtp}
                  onChangeText={setEnteredOtp}
                  keyboardType="numeric"
                  maxLength={4}
                />

                <Input
                  label="Vacutainer Barcode / RFID"
                  placeholder="Scan or enter barcode"
                  value={barcode}
                  onChangeText={setBarcode}
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setActiveTaskModal(null)}
                  variant="outline"
                  size="md"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Confirm & Seal"
                  onPress={handleConfirmCollection}
                  loading={submitting}
                  variant="primary"
                  size="md"
                  style={{ flex: 1 }}
                />
              </View>
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
  patientName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  time: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 2,
  },
  address: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2,
  },
  testsBox: {
    borderRadius: spacing.buttonRadius,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  fastingNotice: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    color: '#d92020',
    marginBottom: 4,
  },
  testItem: {
    fontSize: typography.fontSize.caption,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  collectedBanner: {
    backgroundColor: '#f0fdf4',
    padding: spacing.sm,
    borderRadius: spacing.buttonRadius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
    marginTop: spacing.xs,
  },
  collectedText: {
    color: '#15803d',
    fontWeight: '700',
    fontSize: 12,
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
  modalTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
});
