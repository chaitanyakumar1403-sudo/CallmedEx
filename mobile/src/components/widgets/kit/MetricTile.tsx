// mobile/src/components/widgets/kit/MetricTile.tsx
// Clinical metric tile with G4 opaque backing for critical lab numbers and doses.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.4 & §3.2

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { Glass } from '../../glass/Glass';

export interface MetricTileProps {
  title: string;
  value: string | number;
  unit?: string;
  status?: 'normal' | 'abnormal' | 'critical';
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  referenceRange?: string;
}

export const MetricTile: React.FC<MetricTileProps> = ({
  title,
  value,
  unit,
  status = 'normal',
  delta,
  trend,
  referenceRange,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'critical':
        return '#ef4444';
      case 'abnormal':
        return '#f59e0b';
      default:
        return '#10b981';
    }
  };

  const statusColor = getStatusColor();

  return (
    // G4 tier enforces solid opaque #132032 background for clinical values
    <Glass tier="G4" style={styles.container} specular={false}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      <View style={styles.bottomRow}>
        {referenceRange && (
          <Text style={styles.referenceRange}>Ref: {referenceRange}</Text>
        )}
        {delta && (
          <View style={styles.deltaRow}>
            {trend === 'up' && <TrendingUp size={12} color={statusColor} />}
            {trend === 'down' && <TrendingDown size={12} color={statusColor} />}
            {trend === 'flat' && <Minus size={12} color="#94a3b8" />}
            <Text style={[styles.deltaText, { color: statusColor }]}>{delta}</Text>
          </View>
        )}
      </View>
    </Glass>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginVertical: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 4,
  },
  value: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  referenceRange: {
    color: '#64748b',
    fontSize: 10,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
