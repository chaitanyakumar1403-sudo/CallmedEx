/**
 * Pharmacy Orders Screen — View and manage prescription orders.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { spacing } from '../../src/theme/spacing';
import { pharmacyService } from '../../src/services/pharmacyApi';
import { formatDateTime, formatCurrency } from '../../src/utils/formatters';
import type { BadgeVariant } from '../../src/components/ui/Badge';

interface PharmacyOrder {
  id: string;
  patient_name?: string;
  status: string;
  total_amount?: number;
  items_count?: number;
  created_at: string;
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: 'warning',
  processing: 'info',
  ready: 'success',
  dispatched: 'info',
  delivered: 'success',
  cancelled: 'danger',
};

export default function PharmacyOrdersScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await pharmacyService.getIncomingOrders();
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const renderOrder = ({ item }: { item: PharmacyOrder }) => (
    <TouchableOpacity onPress={() => {/* Navigate to order detail */}}>
      <Card style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={[styles.orderId, { color: themeColors.textPrimary }]}>
            #{item.id.slice(0, 8)}
          </Text>
          <Badge
            label={item.status}
            variant={STATUS_VARIANT[item.status] || 'neutral'}
          />
        </View>
        {item.patient_name && (
          <Text style={[styles.patientName, { color: themeColors.textSecondary }]}>
            Patient: {item.patient_name}
          </Text>
        )}
        <View style={styles.orderFooter}>
          <Text style={[styles.date, { color: themeColors.textMuted }]}>
            {formatDateTime(item.created_at)}
          </Text>
          {item.total_amount != null && (
            <Text style={[styles.amount, { color: themeColors.accent.DEFAULT }]}>
              {formatCurrency(item.total_amount)}
            </Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Prescription Orders" />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>💊</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No orders yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: 80 },
  orderCard: { padding: spacing.md, marginBottom: spacing.sm },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderId: { fontSize: 15, fontWeight: '700' },
  patientName: { fontSize: 13, marginBottom: spacing.xs },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: '700' },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 14, marginTop: spacing.md },
});
