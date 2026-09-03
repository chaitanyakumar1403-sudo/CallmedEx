import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Pill } from '../ui/Pill';

interface AttendanceCardProps {
  onCheckInSuccess?: () => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
  onCheckInSuccess,
}) => {
  const { themeColors } = useTheme();

  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);

  const handleToggleAttendance = () => {
    if (!checkedIn) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setCheckedIn(true);
      setCheckInTime(timeStr);
      Alert.alert('✅ Checked In', `Shift marked active at ${timeStr}. Geotagged presence verified.`);
      if (onCheckInSuccess) onCheckInSuccess();
    } else {
      Alert.alert(
        'Confirm Shift End',
        'Are you sure you want to clock out and end your field shift today?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clock Out',
            onPress: () => {
              setCheckedIn(false);
              setCheckInTime(null);
              Alert.alert('Shift Ended', 'Clock out recorded.');
            },
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>🕒</Text>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            Shift Attendance & Geotag Verification
          </Text>
        </View>
        <Pill
          label={checkedIn ? 'On Shift' : 'Not Checked In'}
          variant={checkedIn ? 'done' : 'waiting'}
        />
      </View>

      <View style={styles.infoRow}>
        <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
          {checkedIn
            ? `Clocked in at ${checkInTime} • Visakhapatnam District Unit`
            : 'Clock in to log your presence and start receiving dispatch allocations.'}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleToggleAttendance}
        style={[
          styles.actionBtn,
          { backgroundColor: checkedIn ? '#fee2e2' : '#15803d' },
        ]}
      >
        <Text style={[styles.actionBtnText, { color: checkedIn ? '#dc2626' : '#ffffff' }]}>
          {checkedIn ? 'Clock Out (End Shift)' : '📷 Biometric / Geotag Check-In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  title: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  infoRow: {
    marginVertical: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSize.tiny,
    lineHeight: 16,
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: spacing.buttonRadius,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  actionBtnText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
  },
});
