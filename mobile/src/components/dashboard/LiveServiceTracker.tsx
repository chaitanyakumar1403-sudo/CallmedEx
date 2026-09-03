import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Pill } from '../ui/Pill';

export interface LiveTrackingData {
  dispatch_id?: string;
  status: string;
  provider?: {
    name: string;
    mobile: string;
    distance_km?: number;
    eta_minutes?: number;
  } | null;
}

interface LiveServiceTrackerProps {
  trackingData: LiveTrackingData | null;
  patientOtp?: string | null;
  onCancel?: () => void;
}

export const LiveServiceTracker: React.FC<LiveServiceTrackerProps> = ({
  trackingData,
  patientOtp,
  onCancel,
}) => {
  const { themeColors } = useTheme();

  if (!trackingData || !['searching', 'provider_notified', 'provider_accepted', 'en_route', 'arrived', 'in_progress'].includes(trackingData.status)) {
    return null;
  }

  const isSearching = trackingData.status === 'searching';
  const isArrived = trackingData.status === 'arrived';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isSearching ? '#fffff0' : '#f0fff4',
          borderColor: isSearching ? '#ecc94b' : '#38a169',
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.statusPillRow}>
          <View style={[styles.pulseDot, { backgroundColor: isSearching ? '#d97706' : '#16a34a' }]} />
          <Text style={[styles.statusText, { color: isSearching ? '#854d0e' : '#16a34a' }]}>
            {trackingData.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {trackingData.provider?.distance_km != null ? (
          <View style={styles.distanceBlock}>
            <Text style={styles.distanceText}>
              {trackingData.provider.distance_km} km away
            </Text>
            <Text style={styles.etaText}>
              ETA: ~{trackingData.provider.eta_minutes} mins
            </Text>
          </View>
        ) : isSearching ? (
          <Text style={styles.scanningText}>Scanning nearby providers...</Text>
        ) : null}
      </View>

      {/* Provider Details Card */}
      {trackingData.provider ? (
        <View style={styles.providerCard}>
          <View style={styles.providerAvatar}>
            <Text style={{ fontSize: 20 }}>🧑‍⚕️</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.providerName}>{trackingData.provider.name}</Text>
            <Text style={styles.providerPhone}>📞 {trackingData.provider.mobile}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.searchingBox}>
          <Text style={{ fontSize: 24, marginBottom: 4 }}>📡</Text>
          <Text style={styles.searchingTitle}>Broadcasting Emergency Dispatch...</Text>
          <Text style={styles.searchingSub}>Notifying accredited healthcare providers in your vicinity.</Text>
        </View>
      )}

      {/* Arrived OTP Display */}
      {isArrived && patientOtp && (
        <View style={styles.otpBox}>
          <Text style={styles.otpHeader}>Provider Has Arrived!</Text>
          <Text style={styles.otpSub}>Share this 6-digit PIN with the provider to commence service:</Text>
          <View style={styles.otpDisplay}>
            <Text style={styles.otpText}>{patientOtp}</Text>
          </View>
        </View>
      )}

      {/* Cancel action */}
      {onCancel && !['arrived', 'in_progress', 'completed'].includes(trackingData.status) && (
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel Dispatch Request</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.cardRadius,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  distanceBlock: {
    alignItems: 'flex-end',
  },
  distanceText: {
    fontSize: typography.fontSize.body,
    fontWeight: '800',
    color: '#0f172a',
  },
  etaText: {
    fontSize: typography.fontSize.tiny,
    color: '#64748b',
  },
  scanningText: {
    fontSize: typography.fontSize.tiny,
    color: '#854d0e',
    fontStyle: 'italic',
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: spacing.xs,
  },
  providerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontSize: typography.fontSize.body,
    fontWeight: '700',
    color: '#0f172a',
  },
  providerPhone: {
    fontSize: typography.fontSize.caption,
    color: '#64748b',
    marginTop: 2,
  },
  searchingBox: {
    backgroundColor: '#ffffff',
    padding: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ecc94b',
    borderStyle: 'dashed',
    marginVertical: spacing.xs,
  },
  searchingTitle: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: '#854d0e',
  },
  searchingSub: {
    fontSize: typography.fontSize.tiny,
    color: '#a16207',
    textAlign: 'center',
    marginTop: 2,
  },
  otpBox: {
    backgroundColor: '#0369a1',
    padding: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  otpHeader: {
    color: '#ffffff',
    fontSize: typography.fontSize.body,
    fontWeight: '800',
    marginBottom: 2,
  },
  otpSub: {
    color: '#e0f2fe',
    fontSize: typography.fontSize.tiny,
    textAlign: 'center',
    marginBottom: 8,
  },
  otpDisplay: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  otpText: {
    color: '#0369a1',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 6,
  },
  cancelBtn: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  cancelText: {
    color: '#d92020',
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
