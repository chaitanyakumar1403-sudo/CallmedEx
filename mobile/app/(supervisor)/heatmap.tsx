import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AppShell } from '../../src/components/glass/AppShell';
import { HeatLayer, Hotspot } from '../../src/components/widgets/kit/HeatLayer';
import { MetricTile } from '../../src/components/widgets/kit/MetricTile';

export default function SupervisorHeatmapScreen() {
  const [hotspots] = useState<Hotspot[]>([
    { id: '1', areaName: 'Gajuwaka Industrial Corridor', activeDispatches: 8, intensity: 'surge', slaBreachRisk: true },
    { id: '2', areaName: 'Madhurawada Tech Zone', activeDispatches: 6, intensity: 'high' },
    { id: '3', areaName: 'MVP Colony Residential', activeDispatches: 4, intensity: 'medium' },
    { id: '4', areaName: 'Siripuram Junction', activeDispatches: 2, intensity: 'low' },
  ]);

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Demand Heat Map</Text>
          <Text style={styles.headerSubtitle}>Fleet Allocation & Surge Clusters</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={{ width: '48%' }}>
            <MetricTile
              title="Surge Zones"
              value={1}
              unit="active"
              status="abnormal"
              delta="Gajuwaka"
              trend="up"
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricTile
              title="Fleet Capacity"
              value={78}
              unit="%"
              status="normal"
              referenceRange="Target < 85%"
            />
          </View>
        </View>

        <HeatLayer zoneName="Visakhapatnam Urban & Suburbs" hotspots={hotspots} />
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
