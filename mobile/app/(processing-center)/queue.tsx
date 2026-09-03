import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AppShell } from '../../src/components/glass/AppShell';
import { QueueList, QueueSample } from '../../src/components/widgets/kit/QueueList';
import { MetricTile } from '../../src/components/widgets/kit/MetricTile';

export default function ProcessingCenterQueueScreen() {
  const [samples] = useState<QueueSample[]>([
    {
      id: '1',
      barcode: 'CMX-882190',
      tubeType: 'EDTA K2 Lavender',
      patientName: 'Ravi Kumar',
      status: 'received',
      temperatureCelsius: 4.2,
      timeAgo: '12m ago',
    },
    {
      id: '2',
      barcode: 'CMX-774312',
      tubeType: 'Serum SST Yellow',
      patientName: 'Sunita Reddy',
      status: 'received',
      temperatureCelsius: 3.8,
      timeAgo: '24m ago',
    },
    {
      id: '3',
      barcode: 'CMX-993411',
      tubeType: 'Sodium Fluoride Grey',
      patientName: 'Mohammed Ali',
      status: 'received',
      temperatureCelsius: 4.0,
      timeAgo: '35m ago',
    },
  ]);

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Intake & Processing Queue</Text>
          <Text style={styles.headerSubtitle}>Processing Center Hub &bull; Hub #04 Vizag</Text>
        </View>

        {/* Top KPI Metrics Row */}
        <View style={styles.metricsGrid}>
          <View style={{ width: '48%' }}>
            <MetricTile
              title="Pending Intake"
              value={14}
              unit="tubes"
              status="normal"
              delta="+3 new"
              trend="up"
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricTile
              title="Avg Temperature"
              value={4.1}
              unit="°C"
              status="normal"
              referenceRange="2.0 - 8.0°C"
            />
          </View>
        </View>

        {/* Incoming Samples Queue */}
        <QueueList
          samples={samples}
          onSelectSample={(sample) => {
            // Navigate to intake verification
          }}
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
    marginBottom: 12,
  },
});
