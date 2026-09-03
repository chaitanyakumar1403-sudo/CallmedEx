// mobile/src/components/widgets/kit/HeatLayer.tsx
// Geographic demand & cold-chain density heat map visualization for supervisors.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.3

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame, MapPin } from 'lucide-react-native';
import { Glass } from '../../glass/Glass';

export interface Hotspot {
  id: string;
  areaName: string;
  activeDispatches: number;
  intensity: 'low' | 'medium' | 'high' | 'surge';
  slaBreachRisk?: boolean;
}

export interface HeatLayerProps {
  zoneName: string;
  hotspots: Hotspot[];
}

export const HeatLayer: React.FC<HeatLayerProps> = ({ zoneName, hotspots }) => {
  const getIntensityBadge = (intensity: Hotspot['intensity']) => {
    switch (intensity) {
      case 'surge':
        return { bg: 'rgba(239,68,68,0.25)', border: 'rgba(239,68,68,0.5)', text: '#fca5a5' };
      case 'high':
        return { bg: 'rgba(249,115,22,0.25)', border: 'rgba(249,115,22,0.5)', text: '#fdba74' };
      case 'medium':
        return { bg: 'rgba(245,158,11,0.25)', border: 'rgba(245,158,11,0.5)', text: '#fcd34d' };
      default:
        return { bg: 'rgba(16,185,129,0.25)', border: 'rgba(16,185,129,0.5)', text: '#6ee7b7' };
    }
  };

  return (
    <Glass tier="G1" style={styles.container} specular>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Flame size={16} color="#f97316" />
          <Text style={styles.title}>DEMAND & COLD CHAIN DENSITY</Text>
        </View>
        <Text style={styles.zoneTag}>{zoneName}</Text>
      </View>

      <View style={styles.list}>
        {hotspots.map((spot) => {
          const style = getIntensityBadge(spot.intensity);
          return (
            <View key={spot.id} style={styles.hotspotRow}>
              <View style={styles.spotLeft}>
                <MapPin size={14} color="#94a3b8" />
                <Text style={styles.areaName}>{spot.areaName}</Text>
                {spot.slaBreachRisk && (
                  <View style={styles.slaBadge}>
                    <Text style={styles.slaText}>SLA RISK</Text>
                  </View>
                )}
              </View>

              <View style={[styles.intensityPill, { backgroundColor: style.bg, borderColor: style.border }]}>
                <Text style={[styles.intensityText, { color: style.text }]}>
                  {spot.activeDispatches} active &bull; {spot.intensity.toUpperCase()}
                </Text>
              </View>
            </View>
          );
        })}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  zoneTag: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  list: {
    gap: 8,
  },
  hotspotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  spotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  areaName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '500',
  },
  slaBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    marginLeft: 4,
  },
  slaText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  intensityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  intensityText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
