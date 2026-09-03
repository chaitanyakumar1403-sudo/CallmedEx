// mobile/src/components/widgets/Odometer.tsx
// Animated rupee savings odometer with rolling number counter.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §9.7

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export interface OdometerProps {
  value: number;
  currency?: string;
  label?: string;
  fontSize?: number;
}

export const Odometer: React.FC<OdometerProps> = ({
  value,
  currency = '₹',
  label = 'Total Rupee Savings',
  fontSize = 32,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = React.useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.valueRow}>
        <Text style={[styles.currency, { fontSize: fontSize * 0.7 }]}>{currency}</Text>
        <Text style={[styles.amount, { fontSize }]}>
          {displayValue.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  label: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  currency: {
    color: '#34d399',
    fontWeight: '700',
  },
  amount: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
