import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

interface PrescribedDrug {
  id: string;
  name: string;
  generic_name?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

const COMMON_DRUGS = [
  { name: 'Dolo 650', salt: 'Paracetamol IP 650mg' },
  { name: 'Telma 40', salt: 'Telmisartan IP 40mg' },
  { name: 'Augmentin 625', salt: 'Amoxicillin 500mg + Clavulanate 125mg' },
  { name: 'Pan 40', salt: 'Pantoprazole Gastro-resistant 40mg' },
  { name: 'Glycomet 500', salt: 'Metformin Hydrochloride IP 500mg' },
  { name: 'Cetzine 10', salt: 'Cetirizine Dihydrochloride IP 10mg' },
];

const FREQUENCIES = ['1 OD (Once Daily)', '1 BD (Twice Daily)', '1 TDS (Thrice Daily)', '1 HS (At Bedtime)', 'SOS (As Needed)'];

export default function DoctorPrescriptionBuilderScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ consultationId?: string; patientId?: string }>();

  const [consultationId, setConsultationId] = useState<string>(params.consultationId || '');
  const [patientLabel, setPatientLabel] = useState<string>(params.patientId ? `Patient #${params.patientId.slice(0, 8)}` : '');
  const [activeConsultations, setActiveConsultations] = useState<ConsultationResponse[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [dietAdvice, setDietAdvice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [medicines, setMedicines] = useState<PrescribedDrug[]>([]);
  const [customDrugName, setCustomDrugName] = useState('');
  const [selectedDrug, setSelectedDrug] = useState(COMMON_DRUGS[0]);
  const [selectedFreq, setSelectedFreq] = useState(FREQUENCIES[0]);
  const [durationInput, setDurationInput] = useState('15 Days');
  const [dosageInput, setDosageInput] = useState('1 Tablet after meals');

  useEffect(() => {
    if (!consultationId) {
      consultationService.getActive().then((list) => {
        setActiveConsultations(list);
        if (list.length > 0) {
          setConsultationId(list[0].id);
          setPatientLabel(`Patient #${list[0].patient_id.slice(0, 8)}`);
        }
      }).catch(console.warn);
    }
  }, [consultationId]);

  const handleAddMedicine = () => {
    const medName = customDrugName.trim() || selectedDrug.name;
    const medSalt = customDrugName.trim() ? customDrugName.trim() : selectedDrug.salt;

    const newMed: PrescribedDrug = {
      id: `med_${Date.now()}`,
      name: medName,
      generic_name: medSalt,
      dosage: dosageInput.trim() || '1 Tablet',
      frequency: selectedFreq,
      duration: durationInput.trim() || '7 Days',
      instructions: dietAdvice.trim() || undefined,
    };
    setMedicines([...medicines, newMed]);
    setCustomDrugName('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveMedicine = (id: string) => {
    setMedicines(medicines.filter((m) => m.id !== id));
  };

  const handleSignAndIssue = async () => {
    if (!consultationId) {
      Alert.alert('Consultation Required', 'Please select an active consultation encounter.');
      return;
    }
    if (!diagnosis.trim()) {
      Alert.alert('Diagnosis Required', 'Please provide a clinical diagnosis under NMC guidelines.');
      return;
    }
    if (medicines.length === 0) {
      Alert.alert('Medications Required', 'Please prescribe at least one generic or branded medication.');
      return;
    }

    setIsSubmitting(true);
    try {
      await consultationService.finalizeConsultation({
        consultation_id: consultationId,
        diagnosis: diagnosis.trim(),
        medications: medicines.map((m) => ({
          name: m.name,
          generic_name: m.generic_name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions,
        })),
        notes: `${notes.trim()}${dietAdvice.trim() ? `\nDiet/Lifestyle: ${dietAdvice.trim()}` : ''}`.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Prescription Issued! ✍️',
        `e-Prescription has been cryptographically signed and synced to the patient's health locker and registered pharmacy network.`
      );
      router.replace('/(doctor)/consultations');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Failed to Issue', err.message || 'Could not finalize prescription on server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Author e-Prescription"
        subtitle="NMC Compliant Digital Prescription"
        rightAction={<Badge label="NMC LEVEL-M3" variant="success" />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Patient Selection Card */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Encounter & Patient Details
          </Text>

          {activeConsultations.length > 0 && !params.consultationId ? (
            <View style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                Select Active Encounter:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                {activeConsultations.map((c) => {
                  const isSel = consultationId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => {
                        setConsultationId(c.id);
                        setPatientLabel(`Patient #${c.patient_id.slice(0, 8)}`);
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSel ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                          borderColor: isSel ? themeColors.primary.DEFAULT : themeColors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: isSel ? '#FFFFFF' : themeColors.textPrimary }]}>
                        Patient #{c.patient_id.slice(0, 6)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <Text style={[styles.patientText, { color: themeColors.primary.DEFAULT }]}>
              {patientLabel || `Encounter #${consultationId.slice(0, 10) || 'Active'}`}
            </Text>
          )}

          <Input
            label="Clinical Diagnosis (NMC / ICD-11) *"
            placeholder="e.g. Essential Hypertension Stage-1"
            value={diagnosis}
            onChangeText={setDiagnosis}
          />

          <Input
            label="Clinical Notes / Symptoms"
            placeholder="e.g. Patient presents with morning headaches and elevated BP"
            value={notes}
            onChangeText={setNotes}
            containerStyle={{ marginTop: spacing.sm }}
          />

          <Input
            label="Diet & Lifestyle Advice"
            placeholder="e.g. Low sodium diet (<2g/day), 30m aerobic exercise"
            value={dietAdvice}
            onChangeText={setDietAdvice}
            containerStyle={{ marginTop: spacing.sm }}
          />
        </Card>

        {/* Add Medication Card */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Add Prescribed Medications
          </Text>

          <Input
            label="Custom Medicine Name (or pick below)"
            placeholder="e.g. Amlodipine 5mg"
            value={customDrugName}
            onChangeText={setCustomDrugName}
          />

          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
            Quick Formulary:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {COMMON_DRUGS.map((d) => {
              const isSelected = selectedDrug.name === d.name && !customDrugName;
              return (
                <TouchableOpacity
                  key={d.name}
                  onPress={() => {
                    setSelectedDrug(d);
                    setCustomDrugName('');
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                      borderColor: isSelected ? themeColors.primary.DEFAULT : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                    {d.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="Dosage"
                placeholder="1 Tablet"
                value={dosageInput}
                onChangeText={setDosageInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Duration"
                placeholder="15 Days"
                value={durationInput}
                onChangeText={setDurationInput}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
            Frequency:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {FREQUENCIES.map((f) => {
              const isSelected = selectedFreq === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setSelectedFreq(f)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? themeColors.accent.DEFAULT : themeColors.inputBackground,
                      borderColor: isSelected ? themeColors.accent.dark : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#0A2540' : themeColors.textPrimary }]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Button
            title="+ Add to Prescription"
            onPress={handleAddMedicine}
            variant="outline"
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Itemized Medications List */}
        {medicines.length > 0 && (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary, marginBottom: spacing.xs }]}>
              Rx Itemized Formulary ({medicines.length})
            </Text>

            {medicines.map((m, idx) => (
              <View key={m.id} style={[styles.medRow, { borderBottomColor: themeColors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.medName, { color: themeColors.textPrimary }]}>
                    {idx + 1}. {m.name}
                  </Text>
                  <Text style={[styles.medDetails, { color: themeColors.textSecondary }]}>
                    {m.dosage} • {m.frequency} • {m.duration}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveMedicine(m.id)}
                  style={{ padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${m.name}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ fontSize: 16, color: '#E63946' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {/* Digital Sign Button */}
        <Button
          title="✍️ Cryptographically Sign & Issue e-Prescription"
          onPress={handleSignAndIssue}
          variant="primary"
          size="lg"
          loading={isSubmitting}
          disabled={isSubmitting}
          style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  card: { marginTop: spacing.md, padding: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold, marginBottom: spacing.sm },
  patientText: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold, marginBottom: spacing.sm },
  fieldLabel: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  chipRow: { marginVertical: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: spacing.buttonRadius, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  row: { flexDirection: 'row', marginTop: 4 },
  medRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  medName: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold },
  medDetails: { fontSize: typography.fontSize.caption, marginTop: 2 },
});
