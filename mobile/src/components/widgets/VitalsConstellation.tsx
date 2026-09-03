// mobile/src/components/widgets/VitalsConstellation.tsx
// Connected physiological node graph for ambient vital signs visualization.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §9.2

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, Activity, Wind, Droplets, Thermometer } from 'lucide-react-native';
import { Glass } from '../glass/Glass';

export interface VitalNode {
  id: string;
  name: string;
  value: string | number;
  unit: string;
  status: 'optimal' | 'warning' | 'critical';
  icon: 'heart' | 'bp' | 'spo2' | 'glucose' | 'temp';
}

export interface VitalsConstellationProps {
  nodes: VitalNode[];
  onSelectNode?: (node: VitalNode) => void;
}

export const VitalsConstellation: React.FC<VitalsConstellationProps> = ({
  nodes,
  onSelectNode,
}) => {
  const getStatusColor = (status: VitalNode['status']) => {
    switch (status) {
      case 'critical':
        return { border: '#ef4444', glow: 'rgba(239,68,68,0.25)', text: '#fca5a5' };
      case 'warning':
        return { border: '#f59e0b', glow: 'rgba(245,158,11,0.25)', text: '#fcd34d' };
      default:
        return { border: '#10b981', glow: 'rgba(16,185,129,0.25)', text: '#6ee7b7' };
    }
  };

  const renderIcon = (type: VitalNode['icon']) => {
    switch (type) {
      case 'heart':
        return <Heart size={16} color="#f43f5e" />;
      case 'spo2':
        return <Wind size={16} color="#06b6d4" />;
      case 'glucose':
        return <Droplets size={16} color="#8b5cf6" />;
      case 'temp':
        return <Thermometer size={16} color="#f97316" />;
      default:
        return <Activity size={16} color="#3b82f6" />;
    }
  };

  return (
    <Glass tier="G1" style={styles.container} specular>
      <View style={styles.headerRow}>
        <Text style={styles.title}>VITALS CONSTELLATION</Text>
        <Text style={styles.subtitle}>Physiological Equilibrium</Text>
      </View>

      <View style={styles.grid}>
        {nodes.map((node) => {
          const colors = getStatusColor(node.status);
          return (
            <TouchableOpacity
              key={node.id}
              activeOpacity={0.8}
              onPress={() => onSelectNode && onSelectNode(node)}
              style={[
                styles.nodeCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.glow,
                },
              ]}
            >
              <View style={styles.iconCircle}>{renderIcon(node.icon)}</View>
              <Text style={styles.nodeName}>{node.name}</Text>
              <View style={styles.valueRow}>
                <Text style={styles.nodeValue}>{node.value}</Text>
                <Text style={styles.nodeUnit}>{node.unit}</Text>
              </View>
            </TouchableOpacity>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  nodeCard: {
    width: '48%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  nodeName: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  nodeValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  nodeUnit: {
    color: '#94a3b8',
    fontSize: 11,
  },
});
