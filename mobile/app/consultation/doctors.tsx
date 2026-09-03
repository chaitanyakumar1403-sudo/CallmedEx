/**
 * Doctor Listing Screen — Browse and search telemedicine doctors.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { spacing } from '../../src/theme/spacing';
import { useDoctorList } from '../../src/hooks/useConsultations';
import { getInitials } from '../../src/utils/formatters';
import type { DoctorListing } from '../../src/types/api';

export default function DoctorsListScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const [search, setSearch] = useState('');
  const { doctors, loading, error, refetch } = useDoctorList({
    available_for_online: true,
  });

  const filtered = doctors.filter(
    (d) =>
      d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.specialization || '').toLowerCase().includes(search.toLowerCase())
  );

  const renderDoctor = ({ item }: { item: DoctorListing }) => (
    <TouchableOpacity
      onPress={() => router.push(`/consultation/${item.id}`)}
    >
      <Card style={styles.doctorCard}>
        <View style={[styles.avatar, { backgroundColor: themeColors.accent.DEFAULT }]}>
          <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
        </View>
        <View style={styles.doctorInfo}>
          <Text style={[styles.doctorName, { color: themeColors.textPrimary }]}>
            Dr. {item.full_name}
          </Text>
          <Text style={[styles.specialty, { color: themeColors.textSecondary }]}>
            {item.specialization || 'General Physician'}
          </Text>
          {item.years_of_experience != null && (
            <Text style={[styles.experience, { color: themeColors.textSecondary }]}>
              {item.years_of_experience} yrs experience
            </Text>
          )}
          <View style={styles.tags}>
            {item.available_for_online && (
              <Badge label="Online" variant="success" />
            )}
            {item.rating != null && (
              <Text style={[styles.rating, { color: '#F59E0B' }]}>
                ⭐ {item.rating.toFixed(1)}
              </Text>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Find a Doctor" onBack={() => router.back()} />

      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: themeColors.inputBackground,
              color: themeColors.textPrimary,
              borderColor: themeColors.inputBorder,
            },
          ]}
          placeholder="Search by name or specialization..."
          placeholderTextColor={themeColors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>{error}</Text>
          <TouchableOpacity onPress={refetch}>
            <Text style={[styles.retryText, { color: themeColors.accent.DEFAULT }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderDoctor}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                No doctors found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 14,
  },
  list: { padding: spacing.md, paddingBottom: 80 },
  doctorCard: {
    flexDirection: 'row',
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '700' },
  specialty: { fontSize: 13, marginTop: 2 },
  experience: { fontSize: 12, marginTop: 2 },
  tags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, alignItems: 'center' },
  rating: { fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { fontSize: 14, marginBottom: spacing.sm },
  retryText: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14 },
});
