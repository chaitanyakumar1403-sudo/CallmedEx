/**
 * Doctor Profile & Book Consultation Screen
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { consultationService } from '../../src/services/consultationApi';
import { getInitials } from '../../src/utils/formatters';
import type { DoctorListing } from '../../src/types/api';

export default function DoctorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();

  const [doctor, setDoctor] = useState<DoctorListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const doctors = await consultationService.getDoctors();
        const found = doctors.find((d) => d.id === id);
        setDoctor(found || null);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleStartConsultation = async () => {
    if (!id) return;
    setStarting(true);
    try {
      const consultation = await consultationService.startConsultation({
        doctor_id: id,
      });
      router.push({
        pathname: '/consultation/video',
        params: { consultationId: consultation.id },
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start consultation.');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
      </View>
    );
  }

  if (!doctor) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Doctor" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={{ color: themeColors.textSecondary }}>Doctor not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Doctor Profile" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <Card elevated style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: themeColors.accent.DEFAULT }]}>
            <Text style={styles.avatarText}>{getInitials(doctor.full_name)}</Text>
          </View>
          <Text style={[styles.name, { color: themeColors.textPrimary }]}>Dr. {doctor.full_name}</Text>
          <Text style={[styles.spec, { color: themeColors.textSecondary }]}>
            {doctor.specialization || 'General Physician'}
          </Text>
          {doctor.qualification && (
            <Text style={[styles.qual, { color: themeColors.textSecondary }]}>
              {doctor.qualification}
            </Text>
          )}
          <View style={styles.tags}>
            {doctor.available_for_online && <Badge label="Online Available" variant="success" />}
            {doctor.years_of_experience != null && (
              <Badge label={`${doctor.years_of_experience} yrs`} variant="info" />
            )}
          </View>
        </Card>

        {/* Languages */}
        {doctor.languages_spoken && doctor.languages_spoken.length > 0 && (
          <Card style={styles.infoCard}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Languages</Text>
            <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
              {doctor.languages_spoken.join(', ')}
            </Text>
          </Card>
        )}

        {/* Consult Button */}
        <Button
          title={starting ? 'Starting...' : 'Start Video Consultation'}
          onPress={handleStartConsultation}
          disabled={starting || !doctor.available_for_online}
          loading={starting}
          style={styles.consultButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: 80 },
  profileCard: { padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700' },
  spec: { fontSize: 15, marginTop: 4 },
  qual: { fontSize: 13, marginTop: 2 },
  tags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  infoCard: { padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
  infoText: { fontSize: 14 },
  consultButton: { marginTop: spacing.lg },
});
