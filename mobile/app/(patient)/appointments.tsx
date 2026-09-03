import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { VideoCallModal } from '../../src/components/telemedicine/VideoCallModal';
import { PaymentCheckoutModal } from '../../src/components/payments/PaymentCheckoutModal';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { api } from '../../src/services/api';

export default function AppointmentsScreen() {
  const { themeColors } = useTheme();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<any | null>(null);

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/api/appointments');
      if (res.data) {
        setAppointments(res.data);
      } else if (Array.isArray(res)) {
        setAppointments(res);
      }
    } catch {
      // Show empty state — no mock data in production
      setAppointments([]);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleJoinCall = (appt: any) => {
    setActiveCall(appt);
  };

  const handlePayNow = (appt: any) => {
    setCheckoutItem(appt);
  };

  const handlePaymentSuccess = (paymentId: string) => {
    if (checkoutItem) {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === checkoutItem.id
            ? { ...a, status: 'CONFIRMED', payment_status: 'PAID' }
            : a
        )
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="My Consultations" subtitle="Appointments & Telemedicine Schedule" />

      {/* Tabs */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: themeColors.card, borderBottomColor: themeColors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'upcoming' && { borderBottomColor: themeColors.accent.DEFAULT },
          ]}
          onPress={() => setActiveTab('upcoming')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'upcoming' }}
          accessibilityLabel="Upcoming Appointments"
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'upcoming'
                    ? themeColors.primary.DEFAULT
                    : themeColors.textSecondary,
              },
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'past' && { borderBottomColor: themeColors.accent.DEFAULT },
          ]}
          onPress={() => setActiveTab('past')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'past' }}
          accessibilityLabel="Past Visits"
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'past'
                    ? themeColors.primary.DEFAULT
                    : themeColors.textSecondary,
              },
            ]}
          >
            Past Visits
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={appointments.filter((a) =>
          activeTab === 'upcoming' ? a.status !== 'COMPLETED' : a.status === 'COMPLETED'
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            title="No Appointments Found"
            description="You have no scheduled appointments in this category."
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.doctorName, { color: themeColors.textPrimary }]}>
                  {item.doctor_name}
                </Text>
                <Text style={[styles.specialty, { color: themeColors.textSecondary }]}>
                  {item.specialty} • {item.type}
                </Text>
                <Text style={[styles.dateText, { color: themeColors.accent.dark }]}>
                  📅 {item.date}
                </Text>
                <Text style={[styles.feeText, { color: themeColors.textSecondary }]}>
                  Consultation Fee: ₹{item.fee || 500}
                </Text>
              </View>
              <Badge
                label={item.status}
                variant={
                  item.status === 'CONFIRMED'
                    ? 'success'
                    : item.status === 'PENDING_PAYMENT'
                    ? 'warning'
                    : 'neutral'
                }
              />
            </View>

            {item.status === 'PENDING_PAYMENT' && (
              <View style={[styles.actionRow, { borderTopColor: themeColors.border }]}>
                <Button
                  title={`💳 Pay ₹${item.fee} to Confirm`}
                  onPress={() => handlePayNow(item)}
                  variant="primary"
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {item.type.includes('Video') && item.status === 'CONFIRMED' && (
              <View style={[styles.actionRow, { borderTopColor: themeColors.border }]}>
                <Button
                  title="🎥 Join Video Room"
                  onPress={() => handleJoinCall(item)}
                  variant="accent"
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </Card>
        )}
      />

      {/* Video Call Modal */}
      {activeCall && (
        <VideoCallModal
          visible={!!activeCall}
          onClose={() => setActiveCall(null)}
          roomName={activeCall.room_name || 'callmedex-consult'}
          doctorName={activeCall.doctor_name}
          patientName="You"
          isDoctor={false}
        />
      )}

      {/* Razorpay Checkout Modal */}
      {checkoutItem && (
        <PaymentCheckoutModal
          visible={!!checkoutItem}
          onClose={() => setCheckoutItem(null)}
          bookingId={checkoutItem.id}
          title={`Teleconsultation with ${checkoutItem.doctor_name}`}
          amount={checkoutItem.fee || 500}
          providerName={checkoutItem.doctor_name}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  list: {
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: 100,
  },
  card: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  doctorName: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  specialty: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  dateText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 6,
  },
  feeText: {
    fontSize: typography.fontSize.tiny,
    marginTop: 4,
  },
  actionRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
});
