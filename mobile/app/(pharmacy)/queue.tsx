import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { pharmacyService } from '../../src/services/pharmacyApi';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { PharmacyOrder } from '../../src/types/api';

export default function PharmacyQueueScreen() {
  const { themeColors } = useTheme();

  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const data = await pharmacyService.getIncomingOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load pharmacy orders queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleDispense = async (order: PharmacyOrder) => {
    const nextStatus = order.status === 'pending' || order.status === 'PENDING_VERIFICATION' ? 'packed' : 'dispatched';
    setActionLoadingId(order.id);
    try {
      await pharmacyService.updateOrderStatus(order.id, nextStatus);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      );
      Alert.alert(
        'Order Status Updated! 📦',
        nextStatus === 'packed'
          ? 'Prescription verified and packed with tamper-evident seal.'
          : 'Order handed over to CallMedex delivery executive.'
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Status Update Failed', err.message || 'Could not update order status on server.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'dispatched':
      case 'delivered':
      case 'completed':
        return 'success';
      case 'packed':
      case 'ready':
        return 'info';
      case 'pending':
      case 'pending_verification':
      default:
        return 'warning';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Pharmacy Orders"
        subtitle="Digital e-Prescription Fulfillment Queue"
        rightAction={<Badge label={`${orders.length} ACTIVE`} variant="info" />}
      />

      {loading && orders.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary.DEFAULT} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading incoming prescription queue...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>{error}</Text>
          <Button title="Retry" onPress={fetchOrders} variant="primary" size="sm" style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Card style={[styles.card, { alignItems: 'center', padding: spacing.xl }]}>
              <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>💊</Text>
              <Text style={[styles.title, { color: themeColors.textPrimary, textAlign: 'center' }]}>
                No Pending Pharmacy Orders
              </Text>
              <Text style={[styles.sub, { color: themeColors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
                New e-prescriptions routed to your pharmacy will appear here in real-time.
              </Text>
            </Card>
          }
          renderItem={({ item }) => {
            const isActionLoading = actionLoadingId === item.id;
            const items = item.items || [];
            const patientName = item.patient_name || `Patient #${item.patient_id.slice(0, 8)}`;

            return (
              <Card style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: themeColors.textPrimary }]}>
                      {patientName}
                    </Text>
                    <Text style={[styles.sub, { color: themeColors.textSecondary }]}>
                      Order ID: {item.id.slice(0, 12)}
                    </Text>
                    <Text style={[styles.contact, { color: themeColors.textMuted }]}>
                      📅 {new Date(item.created_at || Date.now()).toLocaleDateString()}
                    </Text>
                  </View>
                  <Badge
                    label={(item.status || 'PENDING').toUpperCase()}
                    variant={getBadgeVariant(item.status)}
                  />
                </View>

                {/* Prescribed Drugs Breakdown */}
                {items.length > 0 && (
                  <View
                    style={[
                      styles.medBox,
                      { backgroundColor: themeColors.inputBackground },
                    ]}
                  >
                    {items.map((m, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.drugName, { color: themeColors.textPrimary }]}>
                            • {m.name}
                          </Text>
                          <Text style={[styles.drugSalt, { color: themeColors.textSecondary }]}>
                            Qty: {m.quantity}
                          </Text>
                        </View>
                        <Text style={[styles.itemPrice, { color: themeColors.primary.DEFAULT }]}>
                          ₹{m.price}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Total & Action */}
                <View style={[styles.footerRow, { borderTopColor: themeColors.border }]}>
                  <View>
                    <Text style={[styles.totalLabel, { color: themeColors.textSecondary }]}>
                      Total Order Value
                    </Text>
                    <Text style={[styles.totalAmount, { color: themeColors.primary.DEFAULT }]}>
                      ₹{item.total_amount || 0}
                    </Text>
                  </View>

                  <Button
                    title={
                      item.status === 'packed'
                        ? '🚀 Mark Dispatched'
                        : item.status === 'dispatched'
                        ? '✅ Dispatched'
                        : '📦 Verify & Pack'
                    }
                    onPress={() => handleDispense(item)}
                    variant={item.status === 'dispatched' ? 'outline' : 'primary'}
                    size="sm"
                    loading={isActionLoading}
                    disabled={isActionLoading || item.status === 'dispatched'}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.body },
  errorText: { fontSize: typography.fontSize.body, textAlign: 'center' },
  card: { marginTop: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
  sub: { fontSize: typography.fontSize.caption, marginTop: 2 },
  contact: { fontSize: typography.fontSize.tiny, marginTop: 4 },
  medBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  drugName: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold },
  drugSalt: { fontSize: typography.fontSize.tiny, marginTop: 1 },
  itemPrice: { fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.bold },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  totalLabel: { fontSize: typography.fontSize.tiny },
  totalAmount: { fontSize: typography.fontSize.bodyLarge, fontWeight: typography.fontWeight.bold },
});
