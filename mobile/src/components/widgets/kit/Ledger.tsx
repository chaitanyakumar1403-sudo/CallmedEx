// mobile/src/components/widgets/kit/Ledger.tsx
// Tabular savings & financial ledger item list with currency formatting.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.6

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Glass } from '../../glass/Glass';

export interface LedgerItem {
  id: string;
  title: string;
  subtitle?: string;
  amount: number;
  savedAmount?: number;
  date: string;
  status?: string;
}

export interface LedgerProps {
  title?: string;
  items: LedgerItem[];
  currency?: string;
}

export const Ledger: React.FC<LedgerProps> = ({
  title = 'SAVINGS & ORDERS LEDGER',
  items,
  currency = '₹',
}) => {
  return (
    <Glass tier="G1" style={styles.container} specular>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemDate}>
                {item.date} {item.subtitle ? `&bull; ${item.subtitle}` : ''}
              </Text>
            </View>

            <View style={styles.itemRight}>
              <Text style={styles.amountText}>
                {currency}
                {item.amount.toFixed(2)}
              </Text>
              {item.savedAmount !== undefined && item.savedAmount > 0 && (
                <Text style={styles.savedText}>
                  Saved {currency}
                  {item.savedAmount.toFixed(2)}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </Glass>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 20,
    marginVertical: 8,
  },
  title: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemLeft: {
    flex: 1,
    paddingRight: 10,
  },
  itemTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  itemDate: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  amountText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  savedText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
