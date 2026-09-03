// mobile/src/components/widgets/kit/QueueList.tsx
// High-density specimen intake & processing center queue.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.9 & §5.3

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Thermometer, ArrowRight } from 'lucide-react-native';
import { Glass } from '../../glass/Glass';

export interface QueueSample {
  id: string;
  barcode: string;
  tubeType: string;
  patientName?: string;
  status: string;
  temperatureCelsius?: number;
  timeAgo: string;
}

export interface QueueListProps {
  samples: QueueSample[];
  onSelectSample: (sample: QueueSample) => void;
}

export const QueueList: React.FC<QueueListProps> = ({
  samples,
  onSelectSample,
}) => {
  const getTubeColor = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('LAVENDER') || t.includes('EDTA')) return '#9333ea';
    if (t.includes('YELLOW') || t.includes('SST')) return '#eab308';
    if (t.includes('GREY') || t.includes('FLUORIDE')) return '#94a3b8';
    if (t.includes('BLUE') || t.includes('CITRATE')) return '#0284c7';
    return '#e11d48';
  };

  return (
    <Glass tier="G1" style={styles.container} specular>
      <View style={styles.header}>
        <Text style={styles.title}>PROCESSING QUEUE</Text>
        <Text style={styles.countText}>{samples.length} Tubes Pending</Text>
      </View>

      <View style={styles.list}>
        {samples.map((s) => (
          <TouchableOpacity
            key={s.id}
            activeOpacity={0.7}
            onPress={() => onSelectSample(s)}
            style={styles.sampleCard}
          >
            <View style={[styles.tubeStrip, { backgroundColor: getTubeColor(s.tubeType) }]} />
            <View style={styles.infoCol}>
              <View style={styles.topRow}>
                <Text style={styles.barcode}>{s.barcode}</Text>
                <Text style={styles.timeAgo}>{s.timeAgo}</Text>
              </View>
              <Text style={styles.subText}>
                {s.tubeType} {s.patientName ? `&bull; ${s.patientName}` : ''}
              </Text>
            </View>

            {s.temperatureCelsius !== undefined && (
              <View style={styles.tempBadge}>
                <Thermometer size={12} color="#38bdf8" />
                <Text style={styles.tempText}>{s.temperatureCelsius}°C</Text>
              </View>
            )}

            <ArrowRight size={16} color="#64748b" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ))}
      </View>
    </Glass>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 22,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  countText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  list: {
    gap: 8,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tubeStrip: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 10,
  },
  infoCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 6,
  },
  barcode: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeAgo: {
    color: '#64748b',
    fontSize: 10,
  },
  subText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  tempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(14,116,144,0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tempText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
});
