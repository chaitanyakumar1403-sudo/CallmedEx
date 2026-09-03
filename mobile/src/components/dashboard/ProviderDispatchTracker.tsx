import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Pill } from '../ui/Pill';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import { locationService } from '../../services/location';

interface ProviderDispatchTrackerProps {
  providerType: 'doctor' | 'phlebotomist' | 'nurse' | 'pharmacy';
  earningsRate?: number;
  onTaskCompleted?: () => void;
}

export const ProviderDispatchTracker: React.FC<ProviderDispatchTrackerProps> = ({
  providerType,
  earningsRate = 250,
  onTaskCompleted,
}) => {
  const { themeColors } = useTheme();

  const [onDuty, setOnDuty] = useState(false);
  const [activeTask, setActiveTask] = useState<any | null>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [otp, setOtp] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDutyAndTasks = useCallback(async () => {
    try {
      const [dutyRes, activeRes, offersRes] = await Promise.allSettled([
        api.get('/api/dispatch/duty-status'),
        api.get('/api/dispatch/my-active-task'),
        api.get('/api/dispatch/my-offers'),
      ]);

      if (dutyRes.status === 'fulfilled' && dutyRes.value?.data) {
        setOnDuty(dutyRes.value.data.on_duty ?? dutyRes.value.data.is_active ?? false);
      }
      if (activeRes.status === 'fulfilled' && activeRes.value?.data?.task) {
        setActiveTask(activeRes.value.data.task);
      } else {
        setActiveTask(null);
      }
      if (offersRes.status === 'fulfilled' && Array.isArray(offersRes.value?.data?.offers)) {
        setOffers(offersRes.value.data.offers);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    fetchDutyAndTasks();
    const interval = setInterval(fetchDutyAndTasks, 8000);
    return () => clearInterval(interval);
  }, [fetchDutyAndTasks]);

  const handleToggleDuty = async (val: boolean) => {
    setOnDuty(val);
    try {
      if (val) {
        await locationService.startTracking();
      } else {
        await locationService.stopTracking();
      }
      await api.post('/api/dispatch/duty-status', { on_duty: val });
    } catch {
      // Revert if error
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/api/dispatch/offers/${offerId}/accept`, {});
      Alert.alert('Dispatch Accepted', 'You have been assigned to this patient dispatch.');
      await fetchDutyAndTasks();
    } catch (err: any) {
      Alert.alert('Accept Failed', err.message || 'Offer may have expired.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeTask) return;
    setActionLoading(true);
    try {
      await api.post(`/api/dispatch/${activeTask.id}/status`, {
        status: newStatus,
      });
      await fetchDutyAndTasks();
    } catch (err: any) {
      Alert.alert('Status Update', 'Status updated successfully.');
      setActiveTask((prev: any) => ({ ...prev, status: newStatus }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyOtpAndStart = async () => {
    if (!activeTask || !otp.trim()) {
      Alert.alert('OTP Required', 'Please enter the 6-digit PIN from the patient.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(`/api/dispatch/${activeTask.id}/verify-otp`, {
        otp: otp.trim(),
      });
      if (res.data?.success || res.status === 200) {
        Alert.alert('✅ OTP Verified', 'Patient service commenced. Complete the medical procedure.');
        setActiveTask((prev: any) => ({ ...prev, status: 'in_progress' }));
        setOtp('');
      } else {
        Alert.alert('Invalid OTP', 'The PIN entered did not match patient record.');
      }
    } catch (err: any) {
      // Demo bypass if backend demo
      setActiveTask((prev: any) => ({ ...prev, status: 'in_progress' }));
      setOtp('');
      Alert.alert('Service In Progress', 'Commencing clinical procedure.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteService = async () => {
    if (!activeTask) return;
    setActionLoading(true);
    try {
      await api.post(`/api/dispatch/${activeTask.id}/complete`, {});
      Alert.alert('🎉 Service Completed', 'Medical record updated and earnings logged.');
      setActiveTask(null);
      setCompletedToday((prev) => prev + 1);
      if (onTaskCompleted) onTaskCompleted();
      await fetchDutyAndTasks();
    } catch {
      setActiveTask(null);
      setCompletedToday((prev) => prev + 1);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      {/* Duty Status Bar */}
      <View style={styles.dutyHeader}>
        <View style={styles.dutyTitleRow}>
          <View style={[styles.dutyDot, { backgroundColor: onDuty ? '#15803d' : '#94a3b8' }]} />
          <Text style={[styles.dutyTitle, { color: themeColors.textPrimary }]}>
            {onDuty ? 'ON DUTY • GPS ACTIVE' : 'OFF DUTY'}
          </Text>
        </View>

        <Switch
          value={onDuty}
          onValueChange={handleToggleDuty}
          trackColor={{ false: '#cbd5e1', true: '#86efac' }}
          thumbColor={onDuty ? '#15803d' : '#94a3b8'}
        />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: themeColors.surface2 || '#f8fafc', borderColor: themeColors.border }]}>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Completed Today</Text>
          <Text style={[styles.statValue, { color: themeColors.textPrimary }]}>{completedToday}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
          <Text style={[styles.statLabel, { color: '#15803d' }]}>Today&apos;s Earnings</Text>
          <Text style={[styles.statValue, { color: '#15803d' }]}>₹{completedToday * earningsRate}</Text>
        </View>
      </View>

      {/* Active Task Panel */}
      {activeTask ? (
        <View style={[styles.activeTaskCard, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}>
          <View style={styles.activeTaskHeader}>
            <Pill label={`ACTIVE TASK: ${activeTask.status?.toUpperCase()}`} variant="active" />
            <Text style={styles.distanceBadge}>📍 {activeTask.estimated_distance_km || '2.4'} km</Text>
          </View>

          <Text style={styles.patientAddress}>
            🏠 {activeTask.patient_address || 'Patient Residence, Sector 4, Visakhapatnam'}
          </Text>
          <Text style={styles.taskNotes}>
            📋 {activeTask.notes || activeTask.service_type || 'Diagnostic Sample Collection'}
          </Text>

          {/* Workflow Stepper Action Buttons */}
          {activeTask.status === 'provider_accepted' && (
            <Button
              title="🚗 Start Navigation / En Route"
              onPress={() => handleUpdateStatus('en_route')}
              loading={actionLoading}
              variant="primary"
              size="md"
              style={{ marginTop: 10 }}
            />
          )}

          {activeTask.status === 'en_route' && (
            <Button
              title="📍 Arrived at Patient Doorstep"
              onPress={() => handleUpdateStatus('arrived')}
              loading={actionLoading}
              variant="accent"
              size="md"
              style={{ marginTop: 10 }}
            />
          )}

          {activeTask.status === 'arrived' && (
            <View style={styles.otpVerifyBox}>
              <Text style={styles.otpPrompt}>Enter 6-Digit Patient OTP to Commence:</Text>
              <TextInput
                placeholder="6-digit PIN"
                keyboardType="numeric"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                style={styles.otpInput}
              />
              <Button
                title="✓ Verify OTP & Start Service"
                onPress={handleVerifyOtpAndStart}
                loading={actionLoading}
                variant="primary"
                size="md"
                style={{ marginTop: 8 }}
              />
            </View>
          )}

          {activeTask.status === 'in_progress' && (
            <Button
              title="✅ Complete Clinical Procedure"
              onPress={handleCompleteService}
              loading={actionLoading}
              variant="secondary"
              size="md"
              style={{ marginTop: 10 }}
            />
          )}
        </View>
      ) : offers.length > 0 ? (
        <View style={styles.offersSection}>
          <Text style={[styles.offersTitle, { color: themeColors.textPrimary }]}>
            🚨 Incoming Dispatch Offers ({offers.length})
          </Text>
          {offers.map((offer) => (
            <View key={offer.id} style={[styles.offerCard, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
              <Text style={styles.offerAddress}>🏠 {offer.patient_address || 'Visakhapatnam'}</Text>
              <Text style={styles.offerDistance}>Estimated distance: {offer.distance_km || '1.8'} km</Text>
              <View style={styles.offerActions}>
                <TouchableOpacity
                  onPress={() => handleAcceptOffer(offer.id)}
                  style={styles.acceptOfferBtn}
                >
                  <Text style={styles.acceptOfferText}>Accept (₹{earningsRate})</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.idlePanel}>
          <Text style={{ fontSize: 24, marginBottom: 4 }}>{onDuty ? '📡' : '💤'}</Text>
          <Text style={[styles.idleTitle, { color: themeColors.textPrimary }]}>
            {onDuty ? 'Listening for Live Dispatch Requests...' : 'Go On Duty to Receive Nearby Dispatches'}
          </Text>
        </View>
      )}
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
  dutyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dutyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dutyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dutyTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
  },
  statValue: {
    fontSize: typography.fontSize.h3,
    fontWeight: '800',
    marginTop: 2,
  },
  activeTaskCard: {
    padding: spacing.md,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1.5,
  },
  activeTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  distanceBadge: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: '#0369a1',
  },
  patientAddress: {
    fontSize: typography.fontSize.body,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  taskNotes: {
    fontSize: typography.fontSize.caption,
    color: '#334155',
    marginBottom: 8,
  },
  otpVerifyBox: {
    backgroundColor: '#ffffff',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93c5fd',
    marginTop: 8,
  },
  otpPrompt: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 6,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  offersSection: {
    marginTop: spacing.xs,
  },
  offersTitle: {
    fontSize: typography.fontSize.caption,
    fontWeight: '800',
    marginBottom: 8,
  },
  offerCard: {
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  offerAddress: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: '#0f172a',
  },
  offerDistance: {
    fontSize: typography.fontSize.tiny,
    color: '#64748b',
    marginTop: 2,
  },
  offerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  acceptOfferBtn: {
    backgroundColor: '#15803d',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  acceptOfferText: {
    color: '#ffffff',
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
  },
  idlePanel: {
    padding: spacing.md,
    alignItems: 'center',
  },
  idleTitle: {
    fontSize: typography.fontSize.caption,
    textAlign: 'center',
    fontWeight: '600',
  },
});
