import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AppShell } from '../../src/components/glass/AppShell';
import { Glass } from '../../src/components/glass/Glass';
import { MetricTile } from '../../src/components/widgets/kit/MetricTile';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react-native';

export default function SupervisorSLAScreen() {
  const breaches = [
    {
      id: 'SLA-1',
      title: 'Booking #BK-9912 Doorstep Arrival Delay',
      detail: 'Traffic delay on MVP Colony &bull; ETA extended by 6 mins',
      severity: 'warning',
      time: '4m ago',
    },
    {
      id: 'SLA-2',
      title: 'Box #C-08 Cold-Chain Integrity Warning',
      detail: 'Internal sensor at 7.6°C &bull; Approaching 8.0°C upper boundary',
      severity: 'critical',
      time: '12m ago',
    },
  ];

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SLA & Fleet Reliability</Text>
          <Text style={styles.headerSubtitle}>Real-Time Cold Chain & Timing Guards</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={{ width: '48%' }}>
            <MetricTile
              title="Daily SLA Adherence"
              value={97.8}
              unit="%"
              status="normal"
              delta="+1.2%"
              trend="up"
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricTile
              title="Cold-Chain Intact"
              value={100}
              unit="%"
              status="normal"
              referenceRange="2.0 - 8.0°C"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>ACTIVE CLINICAL ALARMS</Text>
        <View style={styles.list}>
          {breaches.map((b) => (
            <Glass key={b.id} tier="G1" style={styles.alarmCard} specular>
              <View style={styles.alarmHeader}>
                <AlertCircle
                  size={16}
                  color={b.severity === 'critical' ? '#ef4444' : '#f59e0b'}
                />
                <Text style={styles.alarmTitle} numberOfLines={1}>
                  {b.title}
                </Text>
                <Text style={styles.alarmTime}>{b.time}</Text>
              </View>
              <Text style={styles.alarmDetail}>{b.detail}</Text>
            </Glass>
          ))}
        </View>
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
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  list: {
    gap: 10,
  },
  alarmCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  alarmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  alarmTitle: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  alarmTime: {
    color: '#64748b',
    fontSize: 11,
  },
  alarmDetail: {
    color: '#94a3b8',
    fontSize: 12,
    paddingLeft: 24,
  },
});
