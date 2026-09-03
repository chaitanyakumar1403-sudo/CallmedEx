// mobile/src/components/widgets/kit/RosterStrip.tsx
// Horizontal shift roster & staff availability strip.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.10 & §5.3

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { User, Clock } from 'lucide-react-native';
import { Glass } from '../../glass/Glass';

export interface StaffShift {
  id: string;
  name: string;
  role: string;
  shiftHours: string;
  isOnDuty: boolean;
}

export interface RosterStripProps {
  shifts: StaffShift[];
  onSelectStaff?: (staff: StaffShift) => void;
}

export const RosterStrip: React.FC<RosterStripProps> = ({
  shifts,
  onSelectStaff,
}) => {
  return (
    <Glass tier="G1" style={styles.container} specular>
      <View style={styles.header}>
        <Text style={styles.title}>STAFF ROSTER & SHIFTS</Text>
        <Text style={styles.onDutyCount}>
          {shifts.filter((s) => s.isOnDuty).length} Active Now
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {shifts.map((shift) => (
          <TouchableOpacity
            key={shift.id}
            activeOpacity={0.8}
            onPress={() => onSelectStaff && onSelectStaff(shift)}
            style={styles.shiftCard}
          >
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <User size={14} color="#38bdf8" />
              </View>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: shift.isOnDuty ? '#10b981' : '#64748b' },
                ]}
              />
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {shift.name}
            </Text>
            <Text style={styles.role}>{shift.role}</Text>

            <View style={styles.shiftHoursRow}>
              <Clock size={10} color="#94a3b8" />
              <Text style={styles.hoursText}>{shift.shiftHours}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Glass>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 20,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  onDutyCount: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  scroll: {
    flexDirection: 'row',
  },
  shiftCard: {
    width: 110,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
    alignItems: 'center',
  },
  avatarRow: {
    position: 'relative',
    marginBottom: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: '#0b1320',
  },
  name: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  role: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1,
    textAlign: 'center',
  },
  shiftHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  hoursText: {
    color: '#64748b',
    fontSize: 9,
  },
});
