// mobile/src/components/widgets/kit/StatusRail.tsx
// Continuous step progress rail with status states: pending, active, completed, flagged.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.1

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Clock, AlertCircle } from 'lucide-react-native';

export interface StepItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'flagged';
  timestamp?: string;
}

export interface StatusRailProps {
  steps: StepItem[];
}

export const StatusRail: React.FC<StatusRailProps> = ({ steps }) => {
  return (
    <View style={styles.container}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;

        const getIndicator = () => {
          switch (step.status) {
            case 'completed':
              return (
                <View style={[styles.node, styles.completedNode]}>
                  <Check size={11} color="#ffffff" />
                </View>
              );
            case 'active':
              return (
                <View style={[styles.node, styles.activeNode]}>
                  <View style={styles.pulseInner} />
                </View>
              );
            case 'flagged':
              return (
                <View style={[styles.node, styles.flaggedNode]}>
                  <AlertCircle size={11} color="#ffffff" />
                </View>
              );
            default:
              return <View style={[styles.node, styles.pendingNode]} />;
          }
        };

        return (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.lineCol}>
              {getIndicator()}
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    step.status === 'completed' && styles.completedLine,
                  ]}
                />
              )}
            </View>

            <View style={styles.textCol}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    step.status === 'active' && styles.activeTitle,
                    step.status === 'completed' && styles.completedTitle,
                  ]}
                >
                  {step.title}
                </Text>
                {step.timestamp && <Text style={styles.timestamp}>{step.timestamp}</Text>}
              </View>
              {step.description && (
                <Text style={styles.description}>{step.description}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  lineCol: {
    width: 24,
    alignItems: 'center',
  },
  node: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedNode: {
    backgroundColor: '#10b981',
  },
  activeNode: {
    backgroundColor: '#0284c7',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  pulseInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  flaggedNode: {
    backgroundColor: '#ef4444',
  },
  pendingNode: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 4,
  },
  completedLine: {
    backgroundColor: '#10b981',
  },
  textCol: {
    flex: 1,
    paddingLeft: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTitle: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  completedTitle: {
    color: '#f8fafc',
  },
  timestamp: {
    fontSize: 11,
    color: '#64748b',
  },
  description: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});
