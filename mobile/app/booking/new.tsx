/**
 * New Booking Screen — Multi-step booking wizard.
 * Supports: lab_test, doctor_appointment, home_collection, video_consult.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { bookingsService } from '../../src/services/bookings';
import { useBookingSlots, useHealthPackages } from '../../src/hooks/useBookings';
import { SERVICE_TYPE_LABELS } from '../../src/constants';
import { formatDate, formatTime } from '../../src/utils/formatters';
import type { ServiceType, BookingCreate } from '../../src/types/api';

type Step = 'service' | 'slot' | 'confirm';

const SERVICE_OPTIONS: Array<{ type: ServiceType; icon: string; label: string }> = [
  { type: 'lab_test', icon: '🔬', label: 'Lab Test' },
  { type: 'doctor_appointment', icon: '👨‍⚕️', label: 'Doctor Appointment' },
  { type: 'home_collection', icon: '🏠', label: 'Home Collection' },
  { type: 'video_consult', icon: '📹', label: 'Video Consultation' },
  { type: 'health_package', icon: '📋', label: 'Health Package' },
  { type: 'nurse_visit', icon: '👩‍⚕️', label: 'Nurse Visit' },
];

export default function NewBookingScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const params = useLocalSearchParams<{
    package_id?: string;
    package_name?: string;
    service_type?: string;
    plan_type?: string;
    price?: string;
    mrp?: string;
    tests?: string;
    addons?: string;
    test_name?: string;
  }>();

  const initialService: ServiceType | null =
    (params.service_type as ServiceType) ||
    (params.package_name ? 'health_package' : params.test_name ? 'lab_test' : null);

  const [step, setStep] = useState<Step>(initialService ? 'slot' : 'service');
  const [selectedService, setSelectedService] = useState<ServiceType | null>(initialService);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedAddons = React.useMemo(() => {
    if (!params.addons) return [];
    try {
      const parsed = JSON.parse(params.addons);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.addons]);

  const { packages, loading: packagesLoading } = useHealthPackages();
  const { slots, loading: slotsLoading } = useBookingSlots(
    undefined,
    undefined,
    undefined,
    selectedService || undefined
  );

  const handleSelectService = (type: ServiceType) => {
    setSelectedService(type);
    setStep('slot');
  };

  const handleSelectSlot = (slotId: string) => {
    setSelectedSlotId(slotId);
    setStep('confirm');
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedSlotId) return;
    setSubmitting(true);
    try {
      const data: BookingCreate = {
        service_type: selectedService,
        slot_id: selectedSlotId,
        notes: notes || undefined,
      };
      const booking = await bookingsService.createBooking(data);
      Alert.alert('Booking Created', `Your booking #${booking.id.slice(0, 8)} has been placed.`, [
        { text: 'View Bookings', onPress: () => router.replace('/(patient)/appointments') },
      ]);
    } catch (e: any) {
      Alert.alert('Booking Failed', e.message || 'Could not create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (step === 'slot') setStep('service');
    else if (step === 'confirm') setStep('slot');
    else router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="New Booking" onBack={goBack} />

      {/* Progress indicator */}
      <View style={styles.progressRow}>
        {(['service', 'slot', 'confirm'] as Step[]).map((s, i) => (
          <View key={s} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    step === s
                      ? themeColors.accent.DEFAULT
                      : i < ['service', 'slot', 'confirm'].indexOf(step)
                      ? themeColors.success.DEFAULT
                      : themeColors.card,
                },
              ]}
            >
              <Text style={styles.progressDotText}>{i + 1}</Text>
            </View>
            <Text style={[styles.progressLabel, { color: themeColors.textSecondary }]}>
              {s === 'service' ? 'Service' : s === 'slot' ? 'Time Slot' : 'Confirm'}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Step 1: Select Service */}
        {step === 'service' && (
          <View>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>
              What do you need?
            </Text>
            <View style={styles.serviceGrid}>
              {SERVICE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={[
                    styles.serviceCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor:
                        selectedService === opt.type
                          ? themeColors.accent.DEFAULT
                          : themeColors.border,
                    },
                  ]}
                  onPress={() => handleSelectService(opt.type)}
                >
                  <Text style={styles.serviceIcon}>{opt.icon}</Text>
                  <Text style={[styles.serviceLabel, { color: themeColors.textPrimary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Select Time Slot */}
        {step === 'slot' && (
          <View>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>
              Choose a Time Slot
            </Text>
            {slotsLoading ? (
              <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
            ) : slots.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  No slots available. Try a different service or date.
                </Text>
                <Button title="Go Back" onPress={() => setStep('service')} variant="outline" />
              </Card>
            ) : (
              slots.map((slot) => (
                <TouchableOpacity
                  key={slot.id}
                  onPress={() => handleSelectSlot(slot.id)}
                  style={[
                    styles.slotCard,
                    {
                      backgroundColor: themeColors.card,
                      borderColor:
                        selectedSlotId === slot.id
                          ? themeColors.accent.DEFAULT
                          : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.slotDate, { color: themeColors.textPrimary }]}>
                    {formatDate(slot.date)}
                  </Text>
                  <Text style={[styles.slotTime, { color: themeColors.textSecondary }]}>
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <View>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>
              Confirm Your Booking
            </Text>
            <Card elevated style={styles.confirmCard}>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: themeColors.textSecondary }]}>
                  Service
                </Text>
                <Text style={[styles.confirmValue, { color: themeColors.textPrimary }]}>
                  {params.package_name ? params.package_name : selectedService ? SERVICE_TYPE_LABELS[selectedService] : '—'}
                </Text>
              </View>

              {parsedAddons.length > 0 && (
                <View style={{ marginVertical: 8, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', marginBottom: 4 }}>
                    🎁 30% DISCOUNTED ADD-ON TESTS ({parsedAddons.length}):
                  </Text>
                  {parsedAddons.map((addon: any, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={{ fontSize: 12, color: themeColors.textPrimary, flex: 1 }}>
                        • {addon.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>
                        ₹{addon.discountedPrice || addon.price}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {params.price && (
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: themeColors.textSecondary }]}>
                    Total Amount
                  </Text>
                  <Text style={[styles.confirmValue, { color: '#059669', fontWeight: '800', fontSize: 16 }]}>
                    ₹{params.price}
                  </Text>
                </View>
              )}

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: themeColors.textSecondary }]}>
                  Slot
                </Text>
                <Text style={[styles.confirmValue, { color: themeColors.textPrimary }]}>
                  {selectedSlotId ? selectedSlotId.slice(0, 8) + '...' : '—'}
                </Text>
              </View>
            </Card>

            <Text style={[styles.notesLabel, { color: themeColors.textPrimary }]}>
              Notes (optional)
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: themeColors.inputBackground,
                  color: themeColors.textPrimary,
                  borderColor: themeColors.inputBorder,
                },
              ]}
              placeholder="Any special requirements..."
              placeholderTextColor={themeColors.textMuted}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            <Button
              title={submitting ? 'Booking...' : 'Confirm Booking'}
              onPress={handleConfirmBooking}
              disabled={submitting}
              loading={submitting}
              style={styles.confirmButton}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xl,
  },
  progressItem: { alignItems: 'center', gap: 4 },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  progressLabel: { fontSize: 11 },
  content: { padding: spacing.md, paddingBottom: 100 },
  stepTitle: { fontSize: 20, fontWeight: '700', marginBottom: spacing.lg },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  serviceCard: {
    width: '47%',
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    gap: spacing.sm,
  },
  serviceIcon: { fontSize: 32 },
  serviceLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  slotCard: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotDate: { fontSize: 16, fontWeight: '600' },
  slotTime: { fontSize: 14 },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: 14, textAlign: 'center' },
  confirmCard: { padding: spacing.lg, marginBottom: spacing.lg },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  confirmLabel: { fontSize: 14 },
  confirmValue: { fontSize: 14, fontWeight: '600' },
  notesLabel: { fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  confirmButton: { marginTop: spacing.md },
});
