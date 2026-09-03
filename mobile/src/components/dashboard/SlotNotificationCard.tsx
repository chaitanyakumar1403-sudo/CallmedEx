import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export interface AllottedSlotBooking {
  id: string;
  slot_start: string;
  slot_end: string;
  notes?: string;
  service_type?: string;
}

interface SlotNotificationCardProps {
  bookings: AllottedSlotBooking[];
  onRespond: (bookingId: string, accepted: boolean, reason?: string) => void;
}

export const SlotNotificationCard: React.FC<SlotNotificationCardProps> = ({
  bookings = [],
  onRespond,
}) => {
  if (bookings.length === 0) return null;

  const handleDeclinePrompt = (bookingId: string) => {
    Alert.alert(
      'Decline Allotted Slot',
      'Are you sure you want to decline this scheduled time slot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => onRespond(bookingId, false, 'Patient requested alternate time'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔔 Time Slot Allotment Notifications</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{bookings.length} pending</Text>
        </View>
      </View>

      {bookings.map((booking) => {
        const slotStart = new Date(booking.slot_start);
        const slotEnd = new Date(booking.slot_end);

        return (
          <View key={booking.id} style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.slotTitle}>⏰ Time Slot Allotted</Text>
              <Text style={styles.timeText}>
                {slotStart.toLocaleDateString()} • {slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.serviceText}>
                {booking.notes || (booking.service_type ? booking.service_type.replace('_', ' ') : 'Clinical Service')}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() => onRespond(booking.id, true)}
                style={styles.acceptBtn}
              >
                <Text style={styles.acceptText}>✓ Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeclinePrompt(booking.id)}
                style={styles.declineBtn}
              >
                <Text style={styles.declineText}>✕ Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    color: '#92400e',
  },
  badge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78350f',
  },
  card: {
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: spacing.cardRadiusSm,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  cardInfo: {
    marginBottom: spacing.sm,
  },
  slotTitle: {
    fontSize: typography.fontSize.caption,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 2,
  },
  timeText: {
    fontSize: typography.fontSize.body,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 2,
  },
  serviceText: {
    fontSize: typography.fontSize.tiny,
    color: '#a16207',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#15803d',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptText: {
    color: '#ffffff',
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dc2626',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  declineText: {
    color: '#dc2626',
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
  },
});
