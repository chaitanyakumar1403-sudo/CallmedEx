import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { paymentsService } from '../../services/payments';

interface PaymentCheckoutModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  title: string;
  amount: number;
  providerName?: string;
  onSuccess: (paymentId: string) => void;
}

export const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  visible,
  onClose,
  bookingId,
  title,
  amount,
  providerName = 'CallMedex Healthcare Partner',
  onSuccess,
}) => {
  const { themeColors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');

  const gstAmount = Math.round(amount * 0.18);
  const totalAmount = amount + gstAmount;

  const handlePayNow = async () => {
    try {
      setLoading(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Step 1: Create Order on backend
      const order = await paymentsService.createOrder(
        bookingId,
        totalAmount,
        undefined,
        `Payment for ${title}`
      );

      // Step 2: Simulate/Trigger Razorpay Native Flow
      const mockPaymentId = `pay_mock_${Date.now()}`;
      const mockSignature = `sig_mock_${Date.now()}`;

      // Step 3: Verify with Backend
      await paymentsService.verifyPayment({
        razorpay_order_id: order.id,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: mockSignature,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        'Payment Successful! 🎉',
        `Transaction ID: ${mockPaymentId}\nAmount Paid: ₹${totalAmount}\nYour booking has been confirmed.`,
        [
          {
            text: 'View Receipt',
            onPress: () => {
              onSuccess(mockPaymentId);
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Payment Failed', err.message || 'Could not process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: themeColors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: themeColors.textPrimary }]}>Secure Checkout</Text>
              <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                {providerName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ fontSize: 18, color: themeColors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Bill Summary */}
            <Card style={styles.billCard}>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
                Order Summary
              </Text>
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: themeColors.textSecondary }]}>{title}</Text>
                <Text style={[styles.billValue, { color: themeColors.textPrimary }]}>₹{amount}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: themeColors.textSecondary }]}>
                  GST & Convenience Fee (18%)
                </Text>
                <Text style={[styles.billValue, { color: themeColors.textPrimary }]}>
                  ₹{gstAmount}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              <View style={styles.billRow}>
                <Text style={[styles.totalLabel, { color: themeColors.textPrimary }]}>Total Payable</Text>
                <Text style={[styles.totalValue, { color: themeColors.accent.dark }]}>
                  ₹{totalAmount}
                </Text>
              </View>
            </Card>

            {/* Payment Method Selector */}
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary, marginTop: spacing.md }]}>
              Select Payment Method
            </Text>

            <TouchableOpacity
              onPress={() => setSelectedMethod('upi')}
              style={[
                styles.methodOption,
                { borderColor: selectedMethod === 'upi' ? themeColors.primary.DEFAULT : themeColors.border },
              ]}
            >
              <Text style={styles.methodIcon}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodTitle, { color: themeColors.textPrimary }]}>
                  Instant UPI (GPay / PhonePe / Paytm / BHIM)
                </Text>
                <Text style={[styles.methodDesc, { color: themeColors.textSecondary }]}>
                  Zero transaction charges • Instant confirmation
                </Text>
              </View>
              {selectedMethod === 'upi' && <Badge label="✓" variant="success" />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedMethod('card')}
              style={[
                styles.methodOption,
                { borderColor: selectedMethod === 'card' ? themeColors.primary.DEFAULT : themeColors.border },
              ]}
            >
              <Text style={styles.methodIcon}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodTitle, { color: themeColors.textPrimary }]}>
                  Credit / Debit Card
                </Text>
                <Text style={[styles.methodDesc, { color: themeColors.textSecondary }]}>
                  Visa, Mastercard, RuPay, Amex
                </Text>
              </View>
              {selectedMethod === 'card' && <Badge label="✓" variant="success" />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedMethod('netbanking')}
              style={[
                styles.methodOption,
                { borderColor: selectedMethod === 'netbanking' ? themeColors.primary.DEFAULT : themeColors.border },
              ]}
            >
              <Text style={styles.methodIcon}>🏦</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodTitle, { color: themeColors.textPrimary }]}>
                  Net Banking
                </Text>
                <Text style={[styles.methodDesc, { color: themeColors.textSecondary }]}>
                  All Major Indian Banks
                </Text>
              </View>
              {selectedMethod === 'netbanking' && <Badge label="✓" variant="success" />}
            </TouchableOpacity>

            {/* Security Badge */}
            <View style={styles.securityBox}>
              <Text style={styles.securityText}>
                🔒 256-Bit SSL Encrypted • RBI & Razorpay PCI-DSS Compliant
              </Text>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
            <Button
              title={`Pay ₹${totalAmount}`}
              onPress={handlePayNow}
              loading={loading}
              variant="primary"
              size="lg"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: spacing.cardRadius,
    borderTopRightRadius: spacing.cardRadius,
    maxHeight: '85%',
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.screenPaddingHorizontal,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  body: {
    padding: spacing.screenPaddingHorizontal,
  },
  billCard: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  billLabel: {
    fontSize: typography.fontSize.body,
  },
  billValue: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.medium,
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  totalValue: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.cardRadius,
    borderWidth: 1.5,
    marginVertical: 6,
  },
  methodIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  methodTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  methodDesc: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2,
  },
  securityBox: {
    marginVertical: spacing.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  securityText: {
    color: '#64748B',
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});
