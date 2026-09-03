/**
 * Admin Users Management Screen — List, search, and manage platform users.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { spacing } from '../../src/theme/spacing';
import { adminService } from '../../src/services/adminApi';
import { getInitials } from '../../src/utils/formatters';
import { ROLE_LABELS } from '../../src/constants';
import type { UserRole, AdminUser } from '../../src/types/api';


export default function AdminUsersScreen() {
  const { themeColors } = useTheme();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await adminService.getUsers({ search: search || undefined });
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const handleToggleActive = (user: AdminUser) => {
    Alert.alert(
      user.is_active ? 'Deactivate User' : 'Activate User',
      `Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} ${user.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              await adminService.updateUser(user.id, { is_active: !user.is_active });
              fetchUsers();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to update user.');
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: AdminUser }) => (
    <TouchableOpacity onPress={() => handleToggleActive(item)}>
      <Card style={styles.userCard}>
        <View style={[styles.avatar, { backgroundColor: themeColors.accent.DEFAULT }]}>
          <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: themeColors.textPrimary }]}>
            {item.full_name}
          </Text>
          <Text style={[styles.userEmail, { color: themeColors.textSecondary }]}>
            {item.email}
          </Text>
          <View style={styles.tags}>
            <Badge
              label={ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] || item.role}
              variant="role"
              roleKey={item.role as any}
            />
            <Badge
              label={item.is_active ? 'Active' : 'Inactive'}
              variant={item.is_active ? 'success' : 'danger'}
            />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="User Management" />
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
          placeholder="Search users..."
          placeholderTextColor={themeColors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                No users found
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 14,
  },
  list: { padding: spacing.md, paddingBottom: 80 },
  userCard: {
    flexDirection: 'row',
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700' },
  userEmail: { fontSize: 12, marginTop: 2 },
  tags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  emptyText: { fontSize: 14 },
});
