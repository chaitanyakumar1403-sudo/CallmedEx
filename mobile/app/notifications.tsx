/**
 * Notifications Center — Displays push notification history.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { Header } from '../src/components/ui/Header';
import { Card } from '../src/components/ui/Card';
import { spacing } from '../src/theme/spacing';
import { api } from '../src/services/api';
import { formatRelativeTime } from '../src/utils/formatters';
import type { AppNotification } from '../src/types/api';

const NOTIFICATION_ICONS: Record<string, string> = {
  booking: '📅',
  report: '📊',
  payment: '💳',
  dispatch: '🚗',
  consultation: '🩺',
  sos: '🚨',
  system: '🔔',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/notifications/devices');
      const data = res?.data ?? res?.notifications ?? [];
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = (notification: AppNotification) => {
    const type = notification.type || '';
    const data = notification.data || {};

    if (type.includes('booking') && data.booking_id) {
      router.push(`/booking/${data.booking_id}`);
    } else if (type.includes('report') && data.report_id) {
      router.push(`/report/${data.report_id}`);
    } else if (type.includes('consultation') && data.consultation_id) {
      router.push({
        pathname: '/consultation/video',
        params: { consultationId: data.consultation_id },
      });
    }
  };

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const icon = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.system;
    return (
      <TouchableOpacity onPress={() => handleNotificationPress(item)}>
        <Card
          style={[
            styles.notifCard,
            !item.is_read && { borderLeftWidth: 3, borderLeftColor: themeColors.accent.DEFAULT },
          ]}
        >
          <Text style={styles.notifIcon}>{icon}</Text>
          <View style={styles.notifContent}>
            <Text
              style={[
                styles.notifTitle,
                { color: themeColors.textPrimary, fontWeight: item.is_read ? '400' : '700' },
              ]}
            >
              {item.title}
            </Text>
            <Text style={[styles.notifBody, { color: themeColors.textSecondary }]} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={[styles.notifTime, { color: themeColors.textSecondary }]}>
              {formatRelativeTime(item.created_at)}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Notifications" onBack={() => router.back()} />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No notifications yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: 80 },
  notifCard: {
    flexDirection: 'row',
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  notifIcon: { fontSize: 24 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 15 },
  notifBody: { fontSize: 13, marginTop: 2 },
  notifTime: { fontSize: 11, marginTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, marginTop: spacing.md },
});
