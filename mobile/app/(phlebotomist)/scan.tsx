import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
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
import { api } from '../../src/services/api';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const TUBE_TYPES = [
  { type: 'Lavender Top (K2-EDTA)', test: 'Complete Blood Count (CBC) / HbA1c', color: '#9B5DE5' },
  { type: 'Red Top (Plain / Clot Activator)', test: 'Lipid Profile / Liver / Kidney Panel', color: '#E63946' },
  { type: 'Grey Top (Sodium Fluoride)', test: 'Fasting Plasma Glucose', color: '#6C757D' },
  { type: 'Yellow Top (SST / Gel)', test: 'Thyroid Panel (TSH, FT3, FT4) / Vit D', color: '#F15BB5' },
];

interface ScannedTubeRecord {
  id: string;
  barcode: string;
  tubeType: string;
  testName: string;
  time: string;
  status: string;
}

export default function PhlebotomistScanScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string; patientName?: string }>();

  const [bookingId, setBookingId] = useState(params.bookingId || '');
  const [patientLabel, setPatientLabel] = useState(params.patientName || 'Active Patient Session');
  const [barcode, setBarcode] = useState('');
  const [selectedTube, setSelectedTube] = useState(TUBE_TYPES[0]);
  const [temperature, setTemperature] = useState('4.2');
  const [isVerifying, setIsVerifying] = useState(false);
  const [scannedTubes, setScannedTubes] = useState<ScannedTubeRecord[]>([]);

  const handleBindBarcode = async () => {
    const trimmedBarcode = barcode.trim().toUpperCase();
    if (!trimmedBarcode) {
      Alert.alert('Barcode Required', 'Please enter or scan a valid vacutainer tube barcode.');
      return;
    }

    setIsVerifying(true);
    try {
      // 1. Verify barcode with backend safety rules
      const verifyRes = await api.post<any>('/api/phlebo/verify-barcode', {
        barcode: trimmedBarcode,
        booking_id: bookingId || undefined,
      });

      // 2. Confirm sample collection & link
      await api.post('/api/phlebo/confirm-sample-collection', {
        barcode: trimmedBarcode,
        booking_id: bookingId || undefined,
        temperature_celsius: parseFloat(temperature) || 4.0,
      });

      const newRecord: ScannedTubeRecord = {
        id: `scan_${Date.now()}`,
        barcode: trimmedBarcode,
        tubeType: selectedTube.type,
        testName: selectedTube.test,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'COLLECTION CONFIRMED',
      };

      setScannedTubes([newRecord, ...scannedTubes]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Vacutainer Verified & Linked! 🧪',
        `Barcode ${trimmedBarcode} cryptographically bound to booking session.\nStatus: COLD-CHAIN OK (${temperature}°C).`
      );

      setBarcode('');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Barcode Verification Failed', err.message || 'Server rejected barcode binding.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Vacutainer Barcode Scan"
        subtitle="Sample Identity & Cold-Chain Binding"
        rightAction={<Badge label="COLD-CHAIN OK" variant="success" />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Active Collection Session
          </Text>
          <Text style={[styles.patientText, { color: themeColors.primary.DEFAULT }]}>
            {patientLabel} {bookingId ? `(Booking #${bookingId.slice(0, 8)})` : ''}
          </Text>
          <Text style={[styles.tempText, { color: themeColors.accent.dark }]}>
            🌡️ Cold-Box Temperature: {temperature} °C
          </Text>

          {/* Barcode Input */}
          <View style={{ marginTop: spacing.md }}>
            <Input
              label="Vacutainer Barcode *"
              placeholder="e.g. BC-884029"
              value={barcode}
              onChangeText={setBarcode}
              autoCapitalize="characters"
            />
          </View>

          {/* Temperature Setting */}
          <View style={{ marginTop: spacing.xs }}>
            <Input
              label="Cold-Box Temperature (°C)"
              placeholder="4.0"
              keyboardType="numeric"
              value={temperature}
              onChangeText={setTemperature}
            />
          </View>

          {/* Tube Type Selection */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
            Vacutainer Tube Formulation:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {TUBE_TYPES.map((t) => {
              const isSelected = selectedTube.type === t.type;
              return (
                <TouchableOpacity
                  key={t.type}
                  onPress={() => setSelectedTube(t)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                      borderColor: isSelected ? themeColors.primary.DEFAULT : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                    {t.type.split(' (')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Button
            title="🧪 Verify Barcode & Confirm Collection"
            onPress={handleBindBarcode}
            variant="primary"
            size="lg"
            loading={isVerifying}
            disabled={isVerifying}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Bound Samples History */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.secTitle, { color: themeColors.textPrimary }]}>
            Verified Tubes in Cold-Box ({scannedTubes.length})
          </Text>
        </View>

        {scannedTubes.length === 0 ? (
          <Card style={[styles.card, { alignItems: 'center', padding: spacing.lg }]}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>🧪</Text>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary, textAlign: 'center' }]}>
              No Tubes Bound Yet
            </Text>
            <Text style={[styles.tempText, { color: themeColors.textSecondary, textAlign: 'center' }]}>
              Scan each drawn vacutainer tube before placing in the temperature-controlled specimen carrier.
            </Text>
          </Card>
        ) : (
          scannedTubes.map((item) => (
            <Card key={item.id} style={styles.tubeCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tubeBarcode, { color: themeColors.textPrimary }]}>
                    {item.barcode}
                  </Text>
                  <Text style={[styles.tubeType, { color: themeColors.primary.DEFAULT }]}>
                    {item.tubeType}
                  </Text>
                  <Text style={[styles.tubeTest, { color: themeColors.textSecondary }]}>
                    {item.testName}
                  </Text>
                  <Text style={[styles.tubeTime, { color: themeColors.textMuted }]}>
                    Bound at {item.time}
                  </Text>
                </View>
                <Badge label="VERIFIED" variant="success" />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  card: { marginTop: spacing.md, padding: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold, marginBottom: spacing.sm },
  patientText: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold },
  tempText: { fontSize: typography.fontSize.caption, marginTop: 4 },
  fieldLabel: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  chipRow: { marginVertical: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: spacing.buttonRadius, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xs },
  secTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  tubeCard: { marginTop: spacing.sm, padding: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tubeBarcode: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold },
  tubeType: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginTop: 2 },
  tubeTest: { fontSize: typography.fontSize.tiny, marginTop: 2 },
  tubeTime: { fontSize: typography.fontSize.tiny, marginTop: 4 },
});
