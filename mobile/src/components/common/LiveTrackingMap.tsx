import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

export type TrackingStatus = 'DISPATCHED' | 'EN_ROUTE' | 'IN_TRANSIT' | 'ARRIVED' | 'COLLECTED';

interface LiveTrackingMapProps {
  providerName: string;
  providerRole?: string;
  phoneNumber?: string;
  etaMinutes: number;
  pickupAddress: string;
  status: TrackingStatus;
  collectionOtp?: string;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  providerName,
  providerRole = 'Phlebotomist',
  phoneNumber = '+919876543210',
  etaMinutes,
  pickupAddress,
  status,
  collectionOtp,
}) => {
  const { themeColors } = useTheme();

  const handleCall = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL(`tel:${phoneNumber}`);
  };

  return (
    <Card style={styles.container}>
      {/* Mock Map Canvas */}
      <View style={styles.mapCanvas}>
        <View style={styles.gridOverlay}>
          <Text style={styles.mapWatermark}>🗺️ GPS LIVE TRACKING</Text>
          {/* Destination Pin */}
          <View style={[styles.pin, styles.destinationPin]}>
            <Text style={{ fontSize: 20 }}>🏠</Text>
            <Text style={styles.pinLabel}>You</Text>
          </View>

          {/* Route Dotted Line */}
          <View style={styles.routeLine} />

          {/* Moving Provider Vehicle Pin */}
          <View style={[styles.pin, styles.providerPin]}>
            <Text style={{ fontSize: 22 }}>🛵</Text>
            <Text style={styles.pinLabel}>{providerName.split(' ')[0]}</Text>
          </View>
        </View>
      </View>

      {/* Tracking Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[styles.providerName, { color: themeColors.textPrimary }]}>
              {providerName}
            </Text>
            <Text style={[styles.providerRole, { color: themeColors.textSecondary }]}>
              {providerRole} • Vaccinated & ID Verified
            </Text>
          </View>
          <TouchableOpacity onPress={handleCall} style={styles.callBtn}>
            <Text style={{ fontSize: 18 }}>📞</Text>
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>
        </View>

        {/* ETA & Status Bar */}
        <View style={[styles.statusBanner, { backgroundColor: themeColors.cardElevated }]}>
          <View>
            <Text style={[styles.etaLabel, { color: themeColors.textSecondary }]}>
              ESTIMATED ARRIVAL
            </Text>
            <Text style={[styles.etaValue, { color: themeColors.accent.dark }]}>
              {etaMinutes > 0 ? `${etaMinutes} Minutes` : 'Arrived at Location'}
            </Text>
          </View>
          <Badge
            label={status}
            variant={status === 'ARRIVED' || status === 'COLLECTED' ? 'success' : 'info'}
          />
        </View>

        {/* Collection OTP */}
        {collectionOtp ? (
          <View style={[styles.otpBox, { backgroundColor: themeColors.inputBackground }]}>
            <Text style={[styles.otpLabel, { color: themeColors.textSecondary }]}>
              Doorstep Verification PIN:
            </Text>
            <Text style={[styles.otpCode, { color: themeColors.primary.DEFAULT }]}>
              {collectionOtp}
            </Text>
          </View>
        ) : null}

        {/* Address */}
        <Text style={[styles.addressText, { color: themeColors.textSecondary }]}>
          📍 Destination: {pickupAddress}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  mapCanvas: {
    height: 160,
    backgroundColor: '#0F2744',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapWatermark: {
    position: 'absolute',
    top: 12,
    left: 12,
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  destinationPin: {
    position: 'absolute',
    right: 40,
    top: 40,
    alignItems: 'center',
  },
  providerPin: {
    position: 'absolute',
    left: 40,
    bottom: 30,
    alignItems: 'center',
  },
  pin: {
    alignItems: 'center',
  },
  pinLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  routeLine: {
    position: 'absolute',
    width: 140,
    height: 2,
    backgroundColor: '#38BDF8',
    transform: [{ rotate: '-25deg' }],
  },
  detailsContainer: {
    padding: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerName: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  providerRole: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D4B2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: spacing.buttonRadius,
    ...shadows.sm,
  },
  callBtnText: {
    color: '#061626',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    marginLeft: 4,
  },
  statusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.buttonRadius,
    marginTop: spacing.sm,
  },
  etaLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  etaValue: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
    marginTop: 1,
  },
  otpBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.buttonRadius,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  otpLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  otpCode: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 3,
  },
  addressText: {
    fontSize: typography.fontSize.tiny,
    marginTop: spacing.sm,
  },
});
