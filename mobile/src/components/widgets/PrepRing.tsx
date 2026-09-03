// mobile/src/components/widgets/PrepRing.tsx
// Fasting and pre-collection preparation coach with progress indicator.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §9.6

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Droplet, Clock, Check, AlertCircle } from 'lucide-react-native';
import { Glass } from '../glass/Glass';

export interface PrepRingProps {
  requiredFastingHours: number;
  fastingHoursElapsed: number;
  collectionTime: string;
  isWaterAllowed?: boolean;
  withholdMedications?: string[];
}

export const PrepRing: React.FC<PrepRingProps> = ({
  requiredFastingHours = 10,
  fastingHoursElapsed = 6,
  collectionTime,
  isWaterAllowed = true,
  withholdMedications = [],
}) => {
  const percentComplete = Math.min(100, Math.round((fastingHoursElapsed / requiredFastingHours) * 100));
  const remainingHours = Math.max(0, requiredFastingHours - fastingHoursElapsed);

  return (
    <Glass tier="G1" style={styles.container} specular>
      <View style={styles.header}>
        <Text style={styles.title}>PRE-COLLECTION PREP COACH</Text>
        <Text style={styles.subtitle}>Collection: {collectionTime}</Text>
      </View>

      <View style={styles.contentRow}>
        {/* Visual Progress Badge */}
        <View style={styles.ringWrapper}>
          <View style={styles.circleOuter}>
            <Text style={styles.percentText}>{percentComplete}%</Text>
            <Text style={styles.percentSub}>Fasted</Text>
          </View>
        </View>

        {/* Progress Narrative */}
        <View style={styles.narrativeCol}>
          <View style={styles.timeRemainingRow}>
            <Clock size={16} color="#38bdf8" />
            <Text style={styles.remainingText}>
              {remainingHours > 0 ? `${remainingHours} hrs remaining` : 'Fasting Goal Reached'}
            </Text>
          </View>

          <View style={styles.ruleRow}>
            <Droplet size={14} color={isWaterAllowed ? '#34d399' : '#f87171'} />
            <Text style={styles.ruleText}>
              {isWaterAllowed ? 'Plain water permitted' : 'Strict nil by mouth'}
            </Text>
          </View>

          {withholdMedications.length > 0 && (
            <View style={styles.ruleRow}>
              <AlertCircle size={14} color="#fbbf24" />
              <Text style={styles.ruleText}>
                Withhold: {withholdMedications.join(', ')}
              </Text>
            </View>
          )}
        </View>
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
    marginBottom: 14,
  },
  title: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 11,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56,189,248,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  percentSub: {
    color: '#94a3b8',
    fontSize: 10,
  },
  narrativeCol: {
    flex: 1,
    gap: 6,
  },
  timeRemainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  remainingText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
});
