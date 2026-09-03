import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AppShell } from '../../src/components/glass/AppShell';
import { Glass } from '../../src/components/glass/Glass';
import { RosterStrip, StaffShift } from '../../src/components/widgets/kit/RosterStrip';
import { Clock, CheckCircle, Calendar } from 'lucide-react-native';

export default function ProcessingCenterRosterScreen() {
  const [shifts] = useState<StaffShift[]>([
    { id: '1', name: 'Pooja Hegde', role: 'Lead Biochemist', shiftHours: '08:00 - 16:00', isOnDuty: true },
    { id: '2', name: 'Rohan Verma', role: 'Lab Tech Level 2', shiftHours: '08:00 - 16:00', isOnDuty: true },
    { id: '3', name: 'Kiran Deep', role: 'Sample Intake Specialist', shiftHours: '10:00 - 18:00', isOnDuty: true },
    { id: '4', name: 'Deepa Sen', role: 'Evening Shift In-Charge', shiftHours: '16:00 - 00:00', isOnDuty: false },
  ]);

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shift Roster & Staff</Text>
          <Text style={styles.headerSubtitle}>Processing Center Staff Schedule</Text>
        </View>

        {/* Horizontal Roster Strip */}
        <RosterStrip shifts={shifts} />

        {/* My Shift Today Card */}
        <Glass tier="G1" style={styles.myShiftCard} specular>
          <View style={styles.myShiftHeader}>
            <Calendar size={18} color="#059669" />
            <Text style={styles.myShiftTitle}>MY SHIFT TODAY</Text>
          </View>

          <View style={styles.myShiftDetails}>
            <Text style={styles.shiftTime}>08:00 AM — 04:00 PM</Text>
            <Text style={styles.shiftStation}>Intake Station 01 &bull; 5-Point Verification</Text>
          </View>

          <View style={styles.checkInRow}>
            <View style={styles.checkedInBadge}>
              <CheckCircle size={14} color="#34d399" />
              <Text style={styles.checkedInText}>Clocked In at 07:54 AM</Text>
            </View>
          </View>
        </Glass>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  header: {
    marginBottom: 14,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  myShiftCard: {
    padding: 16,
    borderRadius: 20,
    marginTop: 12,
  },
  myShiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  myShiftTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  myShiftDetails: {
    marginVertical: 6,
  },
  shiftTime: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  shiftStation: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
  },
  checkInRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkedInText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
  },
});
