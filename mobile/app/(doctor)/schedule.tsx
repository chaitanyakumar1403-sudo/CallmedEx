import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { api } from '../../src/services/api';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface AvailabilityRecord {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  consultation_mode: string;
  max_patients_per_slot: number;
  location_name?: string;
  is_active: boolean;
}

export default function DoctorScheduleScreen() {
  const { themeColors } = useTheme();

  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New slot form state
  const [selectedDay, setSelectedDay] = useState(1); // Monday
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [consultMode, setConsultMode] = useState('online');

  const fetchAvailability = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<any>('/api/providers/my-availability');
      const list = res.availability || res.data || [];
      setAvailability(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load doctor availability schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailability();
  };

  const handleAddSlot = async () => {
    if (!startTime || !endTime) {
      Alert.alert('Validation Error', 'Please specify both start time and end time.');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/providers/availability', {
        day_of_week: selectedDay,
        start_time: startTime,
        end_time: endTime,
        slot_duration_minutes: 30,
        consultation_mode: consultMode,
        max_patients_per_slot: 1,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Slot Added! 📅', `Availability for ${DAY_NAMES[selectedDay]} (${startTime} - ${endTime}) created.`);
      setShowAddModal(false);
      fetchAvailability();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to create availability slot.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlot = (slotId: string, day: string, time: string) => {
    Alert.alert(
      'Remove Availability Slot',
      `Delete slot on ${day} (${time})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await api.delete(`/api/providers/availability/${slotId}`);
              setAvailability((prev) => prev.filter((a) => a.id !== slotId));
              Alert.alert('Deleted', 'Availability slot removed.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete slot.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Doctor Availability"
        subtitle="Weekly Slots & Telehealth Schedule"
        rightAction={
          <Button
            title="+ New Slot"
            onPress={() => setShowAddModal(true)}
            variant="accent"
            size="sm"
          />
        }
      />

      {loading && availability.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading weekly schedule...
          </Text>
        </View>
      ) : error && availability.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>{error}</Text>
          <Button title="Retry" onPress={fetchAvailability} variant="primary" size="sm" style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={availability}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Card style={[styles.card, { alignItems: 'center', padding: spacing.xl }]}>
              <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>📅</Text>
              <Text style={[styles.dayText, { color: themeColors.textPrimary, textAlign: 'center' }]}>
                No Availability Slots Configured
              </Text>
              <Text style={[styles.slotText, { color: themeColors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
                Add recurring consultation slots so patients can book appointments with you on CallMedex.
              </Text>
              <Button
                title="+ Create First Time Slot"
                onPress={() => setShowAddModal(true)}
                variant="primary"
                size="sm"
                style={{ marginTop: spacing.md }}
              />
            </Card>
          }
          renderItem={({ item }) => {
            const dayName = DAY_NAMES[item.day_of_week] || 'Weekly';
            const timeRange = `${item.start_time} - ${item.end_time}`;

            return (
              <Card style={styles.card}>
                <View style={styles.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayText, { color: themeColors.textPrimary }]}>
                      {dayName}
                    </Text>
                    <Text style={[styles.slotText, { color: themeColors.primary.DEFAULT }]}>
                      ⏰ {timeRange} ({item.slot_duration_minutes} min slots)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      <Badge
                        label={item.consultation_mode.toUpperCase()}
                        variant={item.consultation_mode === 'online' ? 'info' : 'success'}
                      />
                      <Badge
                        label={item.is_active ? 'ACTIVE' : 'PAUSED'}
                        variant={item.is_active ? 'success' : 'neutral'}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteSlot(item.id, dayName, timeRange)}
                    style={styles.deleteBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete availability slot for ${dayName} ${timeRange}`}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={{ fontSize: 18, color: '#E63946' }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Add Slot Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                Add Availability Slot
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close Modal"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ fontSize: 20, color: themeColors.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: spacing.md }}>
              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                Day of the Week:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {DAY_NAMES.map((d, idx) => {
                  const isSelected = selectedDay === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedDay(idx)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                          borderColor: isSelected ? themeColors.primary.DEFAULT : themeColors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                        {d.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Input
                    label="Start Time (HH:MM) *"
                    placeholder="09:00"
                    value={startTime}
                    onChangeText={setStartTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="End Time (HH:MM) *"
                    placeholder="13:00"
                    value={endTime}
                    onChangeText={setEndTime}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
                Consultation Mode:
              </Text>
              <View style={styles.row}>
                {['online', 'in_person', 'both'].map((mode) => {
                  const isSelected = consultMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setConsultMode(mode)}
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
                        {mode === 'online' ? '💻 Online' : mode === 'in_person' ? '🏥 Clinic' : '📋 All'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                title="💾 Save Availability Slot"
                onPress={handleAddSlot}
                variant="primary"
                size="lg"
                loading={isSaving}
                disabled={isSaving}
                style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.body },
  errorText: { fontSize: typography.fontSize.body, textAlign: 'center' },
  card: { marginTop: spacing.md, padding: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dayText: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  slotText: { fontSize: typography.fontSize.caption, marginTop: 4 },
  deleteBtn: { padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.sm, borderBottomWidth: 1 },
  modalTitle: { fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.bold },
  closeBtn: { padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginBottom: 4 },
  chipRow: { marginVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: spacing.buttonRadius, borderWidth: 1, marginRight: 6 },
  chipText: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  row: { flexDirection: 'row', marginVertical: 4 },
});
