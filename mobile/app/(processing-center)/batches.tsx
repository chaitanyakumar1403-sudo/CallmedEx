import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AppShell } from '../../src/components/glass/AppShell';
import { Glass } from '../../src/components/glass/Glass';
import { Box, Truck, ShieldCheck, ArrowRight } from 'lucide-react-native';

export default function ProcessingCenterBatchesScreen() {
  const batches = [
    {
      id: 'BATCH-2026-09-A',
      destination: 'Central Reference Lab Hyderabad',
      tubesCount: 38,
      status: 'sealed',
      carrier: 'CallMedex Cold Chain Courier',
      departureTime: '11:30 AM',
    },
    {
      id: 'BATCH-2026-09-B',
      destination: 'Pathology Diagnostics Vizag',
      tubesCount: 16,
      status: 'aggregating',
      carrier: 'Hub Shuttle #2',
      departureTime: '01:00 PM',
    },
  ];

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cold-Chain Batches</Text>
          <Text style={styles.headerSubtitle}>Reference Lab Transport Aggregation</Text>
        </View>

        <View style={styles.list}>
          {batches.map((batch) => (
            <Glass key={batch.id} tier="G1" style={styles.batchCard} specular>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Box size={18} color="#34d399" />
                </View>
                <View style={styles.idCol}>
                  <Text style={styles.batchId}>{batch.id}</Text>
                  <Text style={styles.destText}>{batch.destination}</Text>
                </View>
                <View style={[styles.statusPill, batch.status === 'sealed' ? styles.sealedPill : styles.aggPill]}>
                  <Text style={[styles.statusText, batch.status === 'sealed' ? styles.sealedText : styles.aggText]}>
                    {batch.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Tubes</Text>
                  <Text style={styles.metaVal}>{batch.tubesCount}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Departure</Text>
                  <Text style={styles.metaVal}>{batch.departureTime}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Carrier</Text>
                  <Text style={styles.metaVal} numberOfLines={1}>{batch.carrier}</Text>
                </View>
              </View>

              <TouchableOpacity activeOpacity={0.8} style={styles.actionBtn}>
                <Truck size={14} color="#38bdf8" />
                <Text style={styles.actionText}>View Manifest & Chain of Custody</Text>
                <ArrowRight size={14} color="#38bdf8" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
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
  list: {
    gap: 12,
  },
  batchCard: {
    padding: 16,
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(52,211,153,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idCol: {
    flex: 1,
  },
  batchId: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  destText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sealedPill: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sealedText: {
    color: '#34d399',
  },
  aggPill: {
    backgroundColor: 'rgba(245,158,11,0.2)',
  },
  aggText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaVal: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
  },
  actionText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
});
