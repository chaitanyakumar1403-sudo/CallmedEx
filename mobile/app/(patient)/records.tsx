import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
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
import { patientService } from '../../src/services/patientApi';
import { pharmacyService } from '../../src/services/pharmacyApi';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { ConsultationResponse, Medication } from '../../src/types/api';

export default function RecordsScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();

  const [consultations, setConsultations] = useState<ConsultationResponse[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConsultation, setActiveConsultation] = useState<ConsultationResponse | null>(null);
  const [orderingPharmacy, setOrderingPharmacy] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      setError(null);
      const [consultsRes, medsRes] = await Promise.allSettled([
        consultationService.getHistory(),
        patientService.getMedications(),
      ]);

      if (consultsRes.status === 'fulfilled') {
        setConsultations(consultsRes.value || []);
      }
      if (medsRes.status === 'fulfilled') {
        setMedications(medsRes.value || []);
      }
      if (consultsRes.status === 'rejected' && medsRes.status === 'rejected') {
        setError('Failed to load health records from server.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load health records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecords();
  };

  const handleOpenPrescription = (consult: ConsultationResponse) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveConsultation(consult);
  };

  const handleOrderPharmacy = async (consult: ConsultationResponse) => {
    setOrderingPharmacy(true);
    try {
      const items = consult.prescription?.medications?.map((m) => ({
        name: m.name,
        quantity: 1,
        price: 150,
      })) || [];

      await pharmacyService.createOrder({
        prescription_url: `https://api.callmedex.com/api/telemed/${consult.id}`,
        items,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Sent to Pharmacy Network! 💊',
        `Prescription medications have been dispatched to nearby CallMedex Partner Pharmacies for doorstep delivery.`
      );
      setActiveConsultation(null);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Order Failed', err.message || 'Could not send prescription to pharmacy.');
    } finally {
      setOrderingPharmacy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Health Records"
        subtitle="e-Prescriptions & Clinical Documents"
        rightAction={
          <Button
            title="+ Upload"
            onPress={() => router.push('/report/upload')}
            variant="accent"
            size="sm"
          />
        }
      />

      {loading && consultations.length === 0 && medications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading longitudinal health records...
          </Text>
        </View>
      ) : error && consultations.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>{error}</Text>
          <Button title="Retry" onPress={fetchRecords} variant="primary" size="sm" style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={consultations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Card style={[styles.card, { alignItems: 'center', padding: spacing.xl }]}>
              <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>📋</Text>
              <Text style={[styles.title, { color: themeColors.textPrimary, textAlign: 'center' }]}>
                No Health Records Found
              </Text>
              <Text style={[styles.sub, { color: themeColors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
                Your digital prescriptions, clinical summaries, and uploaded health documents will appear here automatically.
              </Text>
              <Button
                title="+ Upload Medical Document"
                onPress={() => router.push('/report/upload')}
                variant="primary"
                size="sm"
                style={{ marginTop: spacing.md }}
              />
            </Card>
          }
          renderItem={({ item }) => {
            const rx = item.prescription;
            const docLabel = `Doctor #${item.doctor_id.slice(0, 8)}`;
            const dateStr = new Date(item.created_at || Date.now()).toLocaleDateString();

            return (
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                      {rx ? rx.diagnosis || 'Clinical Consultation Record' : 'Telemedicine Consultation'}
                    </Text>
                    <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
                      Consulting: {docLabel}
                    </Text>
                    <Text style={[styles.date, { color: themeColors.accent.dark }]}>
                      📅 {dateStr}
                    </Text>
                  </View>
                  <Badge
                    label={item.status === 'completed' ? 'NMC VERIFIED' : item.status.toUpperCase()}
                    variant={item.status === 'completed' ? 'success' : 'info'}
                  />
                </View>

                {rx && rx.medications && rx.medications.length > 0 && (
                  <View
                    style={[
                      styles.medicationBox,
                      { backgroundColor: themeColors.inputBackground },
                    ]}
                  >
                    <Text
                      style={[
                        styles.medBoxTitle,
                        { color: themeColors.textSecondary },
                      ]}
                    >
                      Prescribed Rx:
                    </Text>
                    {rx.medications.slice(0, 2).map((m, idx) => (
                      <Text
                        key={idx}
                        style={[
                          styles.medItem,
                          { color: themeColors.textPrimary },
                        ]}
                      >
                        💊 {m.name} — {m.dosage}
                      </Text>
                    ))}
                    {rx.medications.length > 2 && (
                      <Text style={[styles.moreText, { color: themeColors.primary.DEFAULT }]}>
                        +{rx.medications.length - 2} more medications
                      </Text>
                    )}
                  </View>
                )}

                <View style={[styles.actionRow, { borderTopColor: themeColors.border }]}>
                  <Button
                    title="📄 View e-Prescription"
                    onPress={() => handleOpenPrescription(item)}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="💊 Order Medicine"
                    onPress={() => handleOrderPharmacy(item)}
                    variant="accent"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Interactive Prescription Modal */}
      {activeConsultation && (
        <Modal
          visible={!!activeConsultation}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setActiveConsultation(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                    Digital e-Prescription
                  </Text>
                  <Text style={[styles.modalSub, { color: themeColors.textSecondary }]}>
                    NMC National Medical Registry Verified
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setActiveConsultation(null)}
                  style={{ padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel="Close Modal"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ fontSize: 20, color: themeColors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Card style={{ marginBottom: spacing.md }}>
                  <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
                    Clinical Diagnosis
                  </Text>
                  <Text style={[styles.diagText, { color: themeColors.primary.DEFAULT }]}>
                    {activeConsultation.prescription?.diagnosis || 'General Clinical Review'}
                  </Text>
                  {activeConsultation.prescription?.notes && (
                    <Text style={[styles.adviceText, { color: themeColors.textSecondary, marginTop: 4 }]}>
                      Notes: {activeConsultation.prescription.notes}
                    </Text>
                  )}
                </Card>

                <Text style={[styles.sectionHeading, { color: themeColors.textPrimary, marginBottom: spacing.xs }]}>
                  Rx Itemized Medications
                </Text>

                {(activeConsultation.prescription?.medications || []).map((med, idx) => (
                  <Card key={idx} style={styles.drugCard}>
                    <Text style={[styles.drugName, { color: themeColors.textPrimary }]}>
                      {idx + 1}. {med.name}
                    </Text>
                    <Text style={[styles.drugDose, { color: themeColors.textSecondary }]}>
                      Dosage: {med.dosage}
                    </Text>
                    <Text style={[styles.drugFreq, { color: themeColors.accent.dark }]}>
                      Frequency: {med.frequency}
                    </Text>
                  </Card>
                ))}

                <Button
                  title="🚚 Order All Medications to Doorstep"
                  onPress={() => handleOrderPharmacy(activeConsultation)}
                  variant="primary"
                  size="lg"
                  loading={orderingPharmacy}
                  disabled={orderingPharmacy}
                  style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  title: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  sub: { fontSize: typography.fontSize.caption, marginTop: 2 },
  date: { fontSize: typography.fontSize.caption, marginTop: 4 },
  medicationBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8 },
  medBoxTitle: { fontSize: typography.fontSize.tiny, fontWeight: typography.fontWeight.semibold, marginBottom: 4 },
  medItem: { fontSize: typography.fontSize.caption, marginVertical: 1 },
  moreText: { fontSize: typography.fontSize.tiny, fontWeight: typography.fontWeight.semibold, marginTop: 4 },
  actionRow: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { height: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1 },
  modalTitle: { fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.bold },
  modalSub: { fontSize: typography.fontSize.tiny },
  closeBtn: { padding: 8 },
  modalBody: { flex: 1, marginTop: spacing.md },
  sectionHeading: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold },
  diagText: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold, marginTop: 4 },
  adviceText: { fontSize: typography.fontSize.caption },
  drugCard: { marginBottom: spacing.xs, padding: spacing.sm },
  drugName: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold },
  drugDose: { fontSize: typography.fontSize.caption, marginTop: 2 },
  drugFreq: { fontSize: typography.fontSize.tiny, fontWeight: typography.fontWeight.semibold, marginTop: 2 },
});
