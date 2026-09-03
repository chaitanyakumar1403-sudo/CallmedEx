import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AppShell } from '../../src/components/glass/AppShell';
import { LiveTrack } from '../../src/components/widgets/kit/LiveTrack';
import { MetricTile } from '../../src/components/widgets/kit/MetricTile';

export default function SupervisorRadarScreen() {
  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Supervisor Field Radar</Text>
          <Text style={styles.headerSubtitle}>Real-Time Field Fleet Telemetry & Monitoring</Text>
        </View>

        {/* Fleet KPI Tiles */}
        <View style={styles.metricsGrid}>
          <View style={{ width: '48%' }}>
            <MetricTile
              title="Active In Field"
              value={18}
              unit="staff"
              status="normal"
              delta="94% on-time"
              trend="up"
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricTile
              title="Avg Response"
              value={14.2}
              unit="mins"
              status="normal"
              referenceRange="< 20 mins"
            />
          </View>
        </View>

        {/* Live Active Field Track */}
        <LiveTrack
          providerName="Arun Sharma (Phlebo #104)"
          providerRating={4.9}
          status="en_route"
          etaMinutes={8}
          distanceKm={1.8}
        />

        <LiveTrack
          providerName="Sister Mary (Nurse #022)"
          providerRating={5.0}
          status="arrived"
          etaMinutes={0}
          distanceKm={0.0}
        />
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
    marginBottom: 8,
  },
});
