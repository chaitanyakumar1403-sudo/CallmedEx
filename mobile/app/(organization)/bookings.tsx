/**
 * Organization Bookings Screen — View all bookings for the organization.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { spacing } from '../../src/theme/spacing';
import { api } from '../../src/services/api';
import { formatDateTime, formatCurrency } from '../../src/utils/formatters';
import { BOOKING_STATUS_LABELS, SERVICE_TYPE_LABELS } from '../../src/constants';
import type { BookingResponse, BookingStatus, ServiceType } from '../../src/types/api';
import type { BadgeVariant } from '../../src/components/ui/Badge';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'success',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
};

export default function OrgBookingsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get<{ data: BookingResponse[] }>('/api/organizations/bookings');
      setBookings(res?.data || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const renderBooking = ({ item }: { item: BookingResponse }) => (
    <TouchableOpacity onPress={() => router.push(`/booking/${item.id}`)}>
      <Card style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <Text style={[styles.bookingId, { color: themeColors.textPrimary }]}>
            #{item.id.slice(0, 8)}
          </Text>
          <Badge
            label={BOOKING_STATUS_LABELS[item.status as BookingStatus] || item.status}
            variant={STATUS_VARIANT[item.status] || 'neutral'}
          />
        </View>
        <Text style={[styles.serviceType, { color: themeColors.textSecondary }]}>
          {SERVICE_TYPE_LABELS[item.service_type as ServiceType] || item.service_type}
        </Text>
        <View style={styles.bookingFooter}>
          <Text style={[styles.dateText, { color: themeColors.textMuted }]}>
            {formatDateTime(item.created_at)}
          </Text>
          {item.total_price != null && (
            <Text style={[styles.amount, { color: themeColors.accent.DEFAULT }]}>
              {formatCurrency(item.total_price)}
            </Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Organization Bookings" />
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No bookings found
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
  bookingCard: { padding: spacing.md, marginBottom: spacing.sm },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bookingId: { fontSize: 15, fontWeight: '700' },
  serviceType: { fontSize: 13, marginBottom: spacing.xs },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 14 },
});
