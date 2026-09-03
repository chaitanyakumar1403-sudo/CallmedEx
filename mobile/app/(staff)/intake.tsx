import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
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
import { bookingsService } from '../../src/services/bookings';
import { consultationService } from '../../src/services/consultationApi';
import { api } from '../../src/services/api';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { BookingResponse, DoctorListing } from '../../src/types/api';

const PRIORITIES = ['Routine', 'Urgent', 'Senior Citizen', 'Emergency Triage'];

export default function StaffIntakeScreen() {
  const { themeColors } = useTheme();

  const [patientName, setPatientName] = useState('');
  const [mobile, setMobile] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [priority, setPriority] = useState(PRIORITIES[0]);
  const [doctors, setDoctors] = useState<DoctorListing[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [recentBookings, setRecentBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStaffData = useCallback(async () => {
    try {
      setError(null);
      const [docsRes, bookingsRes] = await Promise.allSettled([
        consultationService.getDoctors(),
        bookingsService.getMyBookings(),
      ]);

      if (docsRes.status === 'fulfilled') {
        const docList = docsRes.value || [];
        setDoctors(docList);
        if (docList.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(docList[0].id);
        }
      }
      if (bookingsRes.status === 'fulfilled') {
        setRecentBookings(bookingsRes.value || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load intake desk data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStaffData();
  };

  const handleCreateToken = async () => {
    const trimmedName = patientName.trim();
    const trimmedMobile = mobile.trim();

    if (!trimmedName || !trimmedMobile) {
      Alert.alert('Missing Fields', 'Please enter patient full name and mobile number.');
      return;
    }

    if (trimmedMobile.length < 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const timeNow = new Date().toTimeString().slice(0, 5);

      const booking = await bookingsService.createBooking({
        provider_id: selectedDoctorId || undefined,
        service_type: 'doctor_appointment',
        preferred_date: todayIso,
        collection_address: `Front Desk OPD Intake • Priority: ${priority}`,
        notes: `Walk-in Patient: ${trimmedName} • Mobile: ${trimmedMobile} • ABHA: ${abhaId || 'N/A'} • Priority: ${priority}`,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const shortToken = booking.id ? `#${booking.id.slice(0, 6).toUpperCase()}` : '#OPD-NEW';

      Alert.alert(
        'OPD Token Issued! 🎟️',
        `Authoritative Token ${shortToken} created on server for ${trimmedName}.\nStatus: CONFIRMED\nSMS confirmation queued to +91 ${trimmedMobile}.`
      );

      setPatientName('');
      setMobile('');
      setAbhaId('');
      fetchStaffData();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Intake Failed', err.message || 'Could not issue OPD token on server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Front Desk Intake" subtitle="Walk-in Patient OPD Token Desk" rightAction={<Badge label="INTAKE DESK" variant="role" />} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Intake Registration Form */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Issue Walk-in OPD Token
          </Text>

          <Input
            label="Patient Full Name *"
            placeholder="e.g. Rahul Sharma"
            value={patientName}
            onChangeText={setPatientName}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="Mobile Number *"
                placeholder="9876543210"
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={setMobile}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="ABHA Health ID"
                placeholder="91-XXXX-XXXX"
                value={abhaId}
                onChangeText={setAbhaId}
              />
            </View>
          </View>

          {/* Doctor Selection */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
            Assign Consulting Physician:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {doctors.map((d) => {
              const isSelected = selectedDoctorId === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => setSelectedDoctorId(d.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                      borderColor: isSelected ? themeColors.primary.DEFAULT : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                    {d.full_name} ({d.specialization || 'Doctor'})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Priority */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
            Queue Priority / Triage:
          </Text>
          <View style={styles.row}>
            {PRIORITIES.map((p) => {
              const isSelected = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.chip,
                    {
                      flex: 1,
                      alignItems: 'center',
                      backgroundColor: isSelected ? themeColors.accent.DEFAULT : themeColors.inputBackground,
                      borderColor: isSelected ? themeColors.accent.dark : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#0A2540' : themeColors.textPrimary }]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            title="🎟️ Issue Token & Register Intake"
            onPress={handleCreateToken}
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ marginTop: spacing.lg }}
          />
        </Card>

        {/* Live OPD Queue */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.secTitle, { color: themeColors.textPrimary }]}>
            Recent Authoritative OPD Intake Tokens
          </Text>
          <Badge label={`${recentBookings.length} TOKENS`} variant="info" />
        </View>

        {loading && recentBookings.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={themeColors.primary.DEFAULT} />
          </View>
        ) : recentBookings.length === 0 ? (
          <Card style={[styles.card, { alignItems: 'center', padding: spacing.lg }]}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>🎟️</Text>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary, textAlign: 'center' }]}>
              No Walk-in Tokens Issued Today
            </Text>
            <Text style={[styles.tokenMeta, { color: themeColors.textSecondary, textAlign: 'center' }]}>
              Fill out the form above to generate server-authoritative tokens for walk-in patients.
            </Text>
          </Card>
        ) : (
          recentBookings.slice(0, 10).map((b) => {
            const tokenLabel = `#${b.id.slice(0, 6).toUpperCase()}`;
            const timeStr = b.slot_start ? new Date(b.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(b.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <Card key={b.id} style={styles.tokenCard}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.tokenNum, { color: themeColors.primary.DEFAULT }]}>
                        {tokenLabel}
                      </Text>
                      <Badge
                        label={(b.status || 'CONFIRMED').toUpperCase()}
                        variant={b.status === 'completed' ? 'success' : 'info'}
                      />
                    </View>
                    <Text style={[styles.tokenMeta, { color: themeColors.textSecondary, marginTop: 4 }]}>
                      {b.notes || b.collection_address || 'Walk-in Consultation'}
                    </Text>
                    <Text style={[styles.tokenTime, { color: themeColors.accent.dark }]}>
                      ⏰ {b.slot_start ? new Date(b.slot_start).toLocaleDateString() : 'Today'} • {timeStr}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  centerContainer: { padding: spacing.md, alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: spacing.md, padding: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold, marginBottom: spacing.sm },
  fieldLabel: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  chipRow: { marginVertical: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: spacing.buttonRadius, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  row: { flexDirection: 'row', marginVertical: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xs },
  secTitle: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  tokenCard: { marginTop: spacing.sm, padding: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tokenNum: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  tokenMeta: { fontSize: typography.fontSize.caption },
  tokenTime: { fontSize: typography.fontSize.tiny, marginTop: 4 },
});
