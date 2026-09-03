/**
 * Payment Screen — Razorpay checkout for booking payments.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { paymentsService } from '../../src/services/paymentsApi';
import { formatCurrency } from '../../src/utils/formatters';

export default function PaymentScreen() {
  const { bookingId, amount } = useLocalSearchParams<{ bookingId: string; amount: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();

  const [processing, setProcessing] = useState(false);
  const parsedAmount = parseFloat(amount || '0');

  const handlePayment = async () => {
    if (!bookingId) return;
    setProcessing(true);
    try {
      const order = await paymentsService.createOrder(bookingId, parsedAmount);

      // In production, this would invoke Razorpay SDK.
      // For now, display confirmation with order_id.
      Alert.alert(
        'Payment Initiated',
        `Order #${order.order_id.slice(0, 8)} created. Amount: ${formatCurrency(parsedAmount)}`,
        [
          {
            text: 'Done',
            onPress: () => router.replace(`/booking/${bookingId}`),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Payment Failed', e.message || 'Could not process payment.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Payment" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card elevated style={styles.summaryCard}>
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>Booking</Text>
          <Text style={[styles.value, { color: themeColors.textPrimary }]}>
            #{bookingId?.slice(0, 8) || '—'}
          </Text>
        </Card>

        <Card elevated style={styles.amountCard}>
          <Text style={[styles.amountLabel, { color: themeColors.textSecondary }]}>
            Total Amount
          </Text>
          <Text style={[styles.amountValue, { color: themeColors.accent.DEFAULT }]}>
            {formatCurrency(parsedAmount)}
          </Text>
        </Card>

        <Text style={[styles.disclaimer, { color: themeColors.textMuted }]}>
          Payment is processed securely via Razorpay. Your card details are never stored.
        </Text>

        <Button
          title={processing ? 'Processing...' : 'Pay Now'}
          onPress={handlePayment}
          disabled={processing || !bookingId}
          loading={processing}
          style={styles.payButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 80 },
  summaryCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '600' },
  amountCard: {
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  amountLabel: { fontSize: 14, marginBottom: spacing.xs },
  amountValue: { fontSize: 36, fontWeight: '800' },
  disclaimer: { fontSize: 12, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 18 },
  payButton: { marginTop: spacing.md },
});
