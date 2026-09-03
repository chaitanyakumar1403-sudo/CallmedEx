/**
 * Booking Detail Screen — Shows status timeline, provider info, actions.
 */
import React from 'react';
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
import { bookingsService } from '../../src/services/bookings';
import { useMyBookings } from '../../src/hooks/useBookings';
import { BOOKING_STATUS_LABELS, SERVICE_TYPE_LABELS } from '../../src/constants';
import { formatDateTime, formatCurrency } from '../../src/utils/formatters';
import type { BookingStatus } from '../../src/types/api';
import type { BadgeVariant } from '../../src/components/ui/Badge';

const STATUS_TO_VARIANT: Record<string, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'success',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'danger',
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();
  const { bookings, loading, refetch } = useMyBookings();

  const booking = bookings.find((b) => b.id === id);

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await bookingsService.updateStatus(id!, 'cancelled');
            await refetch();
            Alert.alert('Cancelled', 'Booking has been cancelled.');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to cancel booking.');
          }
        },
      },
    ]);
  };

  const canCancel = booking && !['completed', 'cancelled', 'no_show'].includes(booking.status);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Header title="Booking Details" onBack={() => router.back()} />
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            Booking not found.
          </Text>
        </View>
      </View>
    );
  }

  const statusLabel = BOOKING_STATUS_LABELS[booking.status as BookingStatus] || booking.status;
  const statusVariant = STATUS_TO_VARIANT[booking.status] || 'neutral';

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Booking Details" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Badge */}
        <Card elevated style={styles.statusCard}>
          <Badge label={statusLabel} variant={statusVariant} />
          <Text style={[styles.bookingId, { color: themeColors.textSecondary }]}>
            #{booking.id.slice(0, 8)}
          </Text>
        </Card>

        {/* Details */}
        <Card style={styles.detailCard}>
          <DetailRow
            label="Service"
            value={SERVICE_TYPE_LABELS[booking.service_type] || booking.service_type}
            textColor={themeColors.textPrimary}
            labelColor={themeColors.textSecondary}
          />
          <DetailRow
            label="Provider"
            value={booking.provider_name || booking.provider_id?.slice(0, 8) || '—'}
            textColor={themeColors.textPrimary}
            labelColor={themeColors.textSecondary}
          />
          <DetailRow
            label="Scheduled"
            value={formatDateTime(booking.slot_start)}
            textColor={themeColors.textPrimary}
            labelColor={themeColors.textSecondary}
          />
          {booking.total_price != null && (
            <DetailRow
              label="Amount"
              value={formatCurrency(booking.total_price)}
              textColor={themeColors.textPrimary}
              labelColor={themeColors.textSecondary}
            />
          )}
          <DetailRow
            label="Booked On"
            value={formatDateTime(booking.created_at)}
            textColor={themeColors.textPrimary}
            labelColor={themeColors.textSecondary}
          />
          {booking.notes && (
            <DetailRow
              label="Notes"
              value={booking.notes}
              textColor={themeColors.textPrimary}
              labelColor={themeColors.textSecondary}
            />
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          {booking.status === 'confirmed' && (
            <Button
              title="Track Provider"
              onPress={() => router.push(`/tracking/${booking.id}`)}
              style={styles.actionButton}
            />
          )}
          {canCancel && (
            <Button
              title="Cancel Booking"
              onPress={handleCancel}
              variant="outline"
              style={styles.actionButton}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  textColor,
  labelColor,
}: {
  label: string;
  value: string;
  textColor: string;
  labelColor: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: 80 },
  statusCard: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bookingId: { fontSize: 13 },
  detailCard: { padding: spacing.lg, marginBottom: spacing.md },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  actionButton: { marginBottom: spacing.xs },
  emptyText: { fontSize: 16 },
});
