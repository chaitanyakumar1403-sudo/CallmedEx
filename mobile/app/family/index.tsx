import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { useFamilyMembers } from '../../src/hooks/useFamilyMembers';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { FamilyMember } from '../../src/types/api';

export default function FamilyMembersScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { members, loading, error, refetch, deleteMember } = useFamilyMembers();

  const handleDeleteMember = (id: string, name: string, relationship: string) => {
    if (relationship.toLowerCase() === 'self') {
      Alert.alert('Cannot Remove Primary User', 'Primary account holder profile cannot be deleted.');
      return;
    }

    Alert.alert(
      'Remove Family Member',
      `Are you sure you want to remove ${name} from your linked family health profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await deleteMember(id);
              Alert.alert('Removed', `${name} has been removed.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Family Health Profiles"
        subtitle="Manage Medical Records for Dependents"
        rightAction={
          <Button
            title="+ Add Member"
            onPress={() => router.push('/family/add')}
            variant="accent"
            size="sm"
          />
        }
      />

      {loading && members.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading family profiles...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>{error}</Text>
          <Button title="Retry" onPress={refetch} variant="primary" size="sm" style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
          ListEmptyComponent={
            <Card style={[styles.card, { alignItems: 'center', padding: spacing.xl }]}>
              <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>👨‍👩‍👧</Text>
              <Text style={[styles.name, { color: themeColors.textPrimary, textAlign: 'center' }]}>
                No Family Members Added
              </Text>
              <Text style={[styles.sub, { color: themeColors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
                Add dependents, children, or elderly parents to easily book tests and consultations for them.
              </Text>
              <Button
                title="+ Add First Family Member"
                onPress={() => router.push('/family/add')}
                variant="accent"
                size="sm"
                style={{ marginTop: spacing.md }}
              />
            </Card>
          }
          renderItem={({ item }) => {
            const blood = (item as any).blood_group || (item as any).bloodGroup || 'Not specified';
            const abha = (item as any).abha_id || (item as any).abhaId;
            const isSelf = item.relationship?.toLowerCase() === 'self';

            const calcAge = item.date_of_birth
              ? new Date().getFullYear() - new Date(item.date_of_birth).getFullYear()
              : (item as any).age || '';

            return (
              <Card style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: themeColors.textPrimary }]}>
                        {item.name}
                      </Text>
                      {isSelf && (
                        <Badge label="PRIMARY" variant="info" />
                      )}
                    </View>
                    <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
                      {item.relationship} • {calcAge ? `${calcAge} yrs • ` : ''}{item.gender} • Blood: {blood}
                    </Text>
                    {abha && (
                      <Text style={[styles.abha, { color: themeColors.accent.dark }]}>
                        ABHA: {abha}
                      </Text>
                    )}
                  </View>

                  {!isSelf && (
                    <TouchableOpacity
                      onPress={() => handleDeleteMember(item.id, item.name, item.relationship)}
                      style={{ padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.name}`}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={{ fontSize: 18, color: '#E63946' }}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[styles.actionRow, { borderTopColor: themeColors.border }]}>
                  <Button
                    title="🧪 Book Lab Test"
                    onPress={() => router.push(`/booking/new?patientName=${encodeURIComponent(item.name)}`)}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="🩺 Consult Doctor"
                    onPress={() => router.push(`/consultation/doctors?patientName=${encodeURIComponent(item.name)}`)}
                    variant="primary"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  card: { marginTop: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  sub: { fontSize: typography.fontSize.caption, marginTop: 3 },
  abha: { fontSize: typography.fontSize.tiny, fontWeight: typography.fontWeight.semibold, marginTop: 4 },
  deleteBtn: { padding: 4 },
  actionRow: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.body },
  errorText: { fontSize: typography.fontSize.body, textAlign: 'center' },
});
