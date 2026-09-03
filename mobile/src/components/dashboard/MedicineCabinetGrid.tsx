import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { api } from '../../services/api';

export interface MedicationItem {
  id: string;
  medicineName: string;
  dosage: string;
  totalPills: number;
  remainingPills: number;
  pillsPerDay: number;
  refillDate?: string;
}

interface MedicineCabinetGridProps {
  medications?: MedicationItem[];
  onAddMedication?: (med: MedicationItem) => void;
  onRefillClick?: (med: MedicationItem) => void;
}

export const MedicineCabinetGrid: React.FC<MedicineCabinetGridProps> = ({
  medications = [],
  onAddMedication,
  onRefillClick,
}) => {
  const { themeColors } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [totalPills, setTotalPills] = useState('30');
  const [remainingPills, setRemainingPills] = useState('30');
  const [pillsPerDay, setPillsPerDay] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !dosage.trim()) {
      Alert.alert('Validation Error', 'Please provide medicine name and dosage instructions.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/api/v1/patient/medications', {
        medicine_name: name.trim(),
        dosage: dosage.trim(),
        total_pills: Number(totalPills) || 30,
        remaining_pills: Number(remainingPills) || 30,
        pills_per_day: Number(pillsPerDay) || 1,
      });

      if (res.data?.medication && onAddMedication) {
        onAddMedication({
          id: res.data.medication.id || `m-${Date.now()}`,
          medicineName: res.data.medication.medicine_name || name,
          dosage: res.data.medication.dosage || dosage,
          totalPills: res.data.medication.total_pills || Number(totalPills),
          remainingPills: res.data.medication.remaining_pills || Number(remainingPills),
          pillsPerDay: res.data.medication.pills_per_day || Number(pillsPerDay),
        });
      }
      setShowModal(false);
      setName('');
      setDosage('');
      setTotalPills('30');
      setRemainingPills('30');
      setPillsPerDay('1');
    } catch {
      // Local fallback
      if (onAddMedication) {
        onAddMedication({
          id: `m-${Date.now()}`,
          medicineName: name.trim(),
          dosage: dosage.trim(),
          totalPills: Number(totalPills) || 30,
          remainingPills: Number(remainingPills) || 30,
          pillsPerDay: Number(pillsPerDay) || 1,
        });
      }
      setShowModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.titleIcon}>💊</Text>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              Medicine Cabinet & Refills
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Track active prescription pills & refill alerts.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowModal(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Add Med</Text>
        </TouchableOpacity>
      </View>

      {/* Medication List */}
      {medications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💊</Text>
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
            No Active Medications Recorded
          </Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
            Add your daily prescriptions to receive automatic refill reminders.
          </Text>
        </View>
      ) : (
        <View style={styles.medsGrid}>
          {medications.map((med) => {
            const daysLeft = Math.max(0, Math.floor(med.remainingPills / (med.pillsPerDay || 1)));
            const pct = Math.min(100, Math.round((med.remainingPills / (med.totalPills || 1)) * 100));
            const isLow = daysLeft <= 5;

            return (
              <View
                key={med.id}
                style={[
                  styles.medCard,
                  {
                    backgroundColor: isLow ? '#fffbeb' : (themeColors.surface2 || '#f8fafc'),
                    borderColor: isLow ? '#f59e0b' : themeColors.border,
                  },
                ]}
              >
                <View style={styles.medCardHeader}>
                  <Text style={[styles.medName, { color: themeColors.textPrimary }]}>
                    {med.medicineName}
                  </Text>
                  {isLow && (
                    <View style={styles.refillBadge}>
                      <Text style={styles.refillBadgeText}>⚠️ Refill Soon</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.medDosage, { color: themeColors.textSecondary }]}>
                  {med.dosage}
                </Text>

                {/* Progress bar */}
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: isLow ? '#f59e0b' : '#7c3aed',
                      },
                    ]}
                  />
                </View>

                <View style={styles.medFooter}>
                  <Text style={[styles.medStats, { color: themeColors.textSecondary }]}>
                    <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>
                      {med.remainingPills}
                    </Text>
                    /{med.totalPills} pills ({daysLeft}d left)
                  </Text>

                  {onRefillClick && (
                    <TouchableOpacity
                      onPress={() => onRefillClick(med)}
                      style={styles.refillActionBtn}
                    >
                      <Text style={styles.refillActionText}>Refill 🛵</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Medication Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                Add Daily Medication
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>
                Medicine Name *
              </Text>
              <TextInput
                placeholder="e.g. Paracetamol 500mg"
                value={name}
                onChangeText={setName}
                style={[styles.input, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>
                Dosage Instructions *
              </Text>
              <TextInput
                placeholder="e.g. 1 tablet twice daily after meals"
                value={dosage}
                onChangeText={setDosage}
                style={[styles.input, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
              />
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>
                  Total Pills
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={totalPills}
                  onChangeText={setTotalPills}
                  style={[styles.input, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
                />
              </View>
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>
                  Remaining
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={remainingPills}
                  onChangeText={setRemainingPills}
                  style={[styles.input, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>
                  Pills/Day
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={pillsPerDay}
                  onChangeText={setPillsPerDay}
                  style={[styles.input, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={[styles.modalCancelBtn, { borderColor: themeColors.border }]}
              >
                <Text style={{ color: themeColors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={submitting}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveBtnText}>
                  {submitting ? 'Saving...' : 'Save Medication'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  title: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.caption,
    textAlign: 'center',
    marginTop: 2,
  },
  medsGrid: {
    gap: 8,
  },
  medCard: {
    padding: spacing.md,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
  },
  medCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  medName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  refillBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  refillBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b45309',
  },
  medDosage: {
    fontSize: typography.fontSize.caption,
    marginBottom: 8,
  },
  progressBg: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  medFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medStats: {
    fontSize: typography.fontSize.tiny,
  },
  refillActionBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  refillActionText: {
    color: '#ffffff',
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: spacing.cardRadius,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  closeBtn: {
    fontSize: 20,
    color: '#94a3b8',
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
    marginBottom: 4,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: typography.fontSize.body,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalSaveBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: typography.fontSize.caption,
  },
});
