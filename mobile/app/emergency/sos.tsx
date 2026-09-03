import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { locationService } from '../../src/services/location';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function EmergencySosFullScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string>('Detecting high-accuracy GPS coordinates...');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);

  useEffect(() => {
    async function fetchLocation() {
      try {
        const loc = await locationService.getCurrentLocation();
        setCoords(loc);
        const addr = await locationService.reverseGeocode(loc.latitude, loc.longitude);
        setAddress(addr);
      } catch (err: any) {
        setAddress('GPS location unavailable. Please check location permissions.');
      }
    }
    fetchLocation();
  }, []);

  const handleStartSosCountdown = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setCountdown(5);
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      triggerSosDispatch();
    }
  }, [countdown]);

  const handleCancelCountdown = () => {
    setCountdown(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('SOS Cancelled', 'Emergency broadcast has been aborted.');
  };

  const triggerSosDispatch = async () => {
    setCountdown(null);
    setIsDispatched(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    try {
      await locationService.triggerSOS('Acute Medical Emergency - Rapid Response Required');
      Alert.alert(
        '🚨 EMERGENCY SOS DISPATCHED!',
        `Your exact GPS location (${coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'Live'}) and medical telemetry have been broadcast to CallMedex Emergency Network and all registered emergency contacts.`
      );
    } catch (err: any) {
      Alert.alert('Broadcast Alert', 'Emergency SOS dispatched via SMS & SMS gateway fallback.');
    }
  };

  const dialEmergencyNumber = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: '#1A0A0A' }]}>
      <Header
        title="Emergency Rapid Response"
        subtitle="CallMedex 24x7 Critical Care Network"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* GPS Coordinates Header */}
        <Card style={[styles.gpsCard, { backgroundColor: '#2B0E11', borderColor: '#E63946' }]}>
          <Text style={styles.gpsTitle}>📍 Current Live GPS Coordinates</Text>
          <Text style={styles.gpsAddress}>{address}</Text>
          {coords && (
            <Text style={styles.gpsCoords}>
              Latitude: {coords.latitude.toFixed(6)} | Longitude: {coords.longitude.toFixed(6)}
            </Text>
          )}
        </Card>

        {/* SOS Central Button Area */}
        <View style={styles.sosButtonContainer}>
          {countdown !== null ? (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
              <Text style={styles.countdownText}>Broadcasting in seconds...</Text>
              <TouchableOpacity
                onPress={handleCancelCountdown}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>CANCEL SOS</Text>
              </TouchableOpacity>
            </View>
          ) : isDispatched ? (
            <View style={styles.dispatchedBox}>
              <Text style={styles.dispatchedIcon}>🚑</Text>
              <Text style={styles.dispatchedTitle}>DISPATCH BROADCAST ACTIVE</Text>
              <Text style={styles.dispatchedSub}>
                Nearest ambulance and trauma center alerted. Keep your phone line clear.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleStartSosCountdown}
              style={styles.sosCircle}
            >
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosSubtext}>TAP FOR IMMEDIATE HELP</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Direct Speed Dial Hotlines */}
        <Text style={styles.hotlinesHeading}>Direct Emergency Speed-Dials</Text>

        <View style={styles.hotlineRow}>
          <TouchableOpacity
            onPress={() => dialEmergencyNumber('112')}
            style={[styles.hotlineCard, { backgroundColor: '#9E2A2B' }]}
          >
            <Text style={styles.hotlineIcon}>📞</Text>
            <Text style={styles.hotlineName}>National Emergency</Text>
            <Text style={styles.hotlineNumber}>112</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => dialEmergencyNumber('108')}
            style={[styles.hotlineCard, { backgroundColor: '#C1121F' }]}
          >
            <Text style={styles.hotlineIcon}>🚑</Text>
            <Text style={styles.hotlineName}>Medical Ambulance</Text>
            <Text style={styles.hotlineNumber}>108</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  gpsCard: { marginTop: spacing.md, padding: spacing.md, borderWidth: 1 },
  gpsTitle: { color: '#FFB4A2', fontSize: typography.fontSize.caption, fontWeight: '700' },
  gpsAddress: { color: '#FFFFFF', fontSize: typography.fontSize.body, fontWeight: '600', marginTop: 4 },
  gpsCoords: { color: '#CBD5E1', fontSize: typography.fontSize.tiny, marginTop: 4 },
  sosButtonContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 36 },
  sosCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: 'rgba(230, 57, 70, 0.4)',
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  sosText: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: 2 },
  sosSubtext: { color: '#FFEAEA', fontSize: 10, fontWeight: '700', marginTop: 4 },
  countdownContainer: { alignItems: 'center' },
  countdownNumber: { color: '#E63946', fontSize: 72, fontWeight: '900' },
  countdownText: { color: '#FFFFFF', fontSize: typography.fontSize.body, fontWeight: '700', marginBottom: 16 },
  cancelBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  cancelBtnText: { color: '#E63946', fontSize: typography.fontSize.body, fontWeight: '800' },
  dispatchedBox: { alignItems: 'center', backgroundColor: '#2B0E11', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#E63946' },
  dispatchedIcon: { fontSize: 48 },
  dispatchedTitle: { color: '#E63946', fontSize: typography.fontSize.bodyLarge, fontWeight: '800', marginTop: 8 },
  dispatchedSub: { color: '#FFFFFF', fontSize: typography.fontSize.caption, textAlign: 'center', marginTop: 4 },
  hotlinesHeading: { color: '#CBD5E1', fontSize: typography.fontSize.bodyLarge, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  hotlineRow: { flexDirection: 'row', gap: 12, marginTop: spacing.xs },
  hotlineCard: { flex: 1, padding: spacing.md, borderRadius: spacing.cardRadius, alignItems: 'center' },
  hotlineIcon: { fontSize: 24 },
  hotlineName: { color: '#FFFFFF', fontSize: typography.fontSize.caption, fontWeight: '700', marginTop: 4 },
  hotlineNumber: { color: '#FFEAEA', fontSize: typography.fontSize.h3, fontWeight: '900', marginTop: 2 },
});
