/**
 * Live Provider Tracking Screen — Real-time map showing phlebotomist/nurse en route.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { spacing } from '../../src/theme/spacing';
import { dispatchService } from '../../src/services/dispatch';
import { DISPATCH_STATUS_LABELS } from '../../src/constants';
import type { DispatchTrackResponse, DispatchStatus } from '../../src/types/api';

const STATUS_STEPS: DispatchStatus[] = [
  'searching',
  'provider_notified',
  'provider_accepted',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
];

const STATUS_TO_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  searching: 'info',
  provider_notified: 'warning',
  provider_accepted: 'success',
  en_route: 'info',
  arrived: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_provider: 'danger',
};

export default function TrackingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();

  const [dispatch, setDispatch] = useState<DispatchTrackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDispatch = async () => {
    if (!bookingId) return;
    try {
      const data = await dispatchService.getDispatchForBooking(bookingId);
      setDispatch(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load tracking info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatch();
    intervalRef.current = setInterval(fetchDispatch, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bookingId]);

  const status = dispatch?.status as DispatchStatus | undefined;
  const isTerminal = status && ['completed', 'cancelled', 'no_provider'].includes(status);

  useEffect(() => {
    if (isTerminal && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [isTerminal]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent.DEFAULT} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Loading tracking info...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Track Provider" onBack={() => router.back()} />

      {!dispatch ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            No dispatch found for this booking.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Map placeholder */}
          <View style={[styles.mapPlaceholder, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.mapText, { color: themeColors.textSecondary }]}>
              📍 Live Map
            </Text>
            {dispatch.provider_lat != null && dispatch.provider_lng != null && (
              <Text style={[styles.coordText, { color: themeColors.textSecondary }]}>
                Provider: {dispatch.provider_lat.toFixed(4)}, {dispatch.provider_lng.toFixed(4)}
              </Text>
            )}
          </View>

          {/* Status Card */}
          <Card elevated style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Badge
                label={status ? DISPATCH_STATUS_LABELS[status] || status : 'Unknown'}
                variant={status ? STATUS_TO_BADGE_VARIANT[status] || 'neutral' : 'neutral'}
              />
              {dispatch.eta_minutes != null && !isTerminal && (
                <Text style={[styles.eta, { color: themeColors.textPrimary }]}>
                  ETA: {dispatch.eta_minutes} min
                </Text>
              )}
            </View>

            {dispatch.provider_name && (
              <Text style={[styles.providerName, { color: themeColors.textPrimary }]}>
                {dispatch.provider_name}
              </Text>
            )}
          </Card>

          {/* Status Timeline */}
          <Card style={styles.timelineCard}>
            <Text style={[styles.timelineTitle, { color: themeColors.textPrimary }]}>
              Status Timeline
            </Text>
            {STATUS_STEPS.map((s) => {
              const isActive = s === status;
              const isPast =
                status &&
                STATUS_STEPS.indexOf(s) <= STATUS_STEPS.indexOf(status as DispatchStatus);
              return (
                <View key={s} style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: isPast
                          ? themeColors.success.DEFAULT
                          : themeColors.border,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.timelineLabel,
                      {
                        color: isActive
                          ? themeColors.textPrimary
                          : themeColors.textSecondary,
                        fontWeight: isActive ? '700' : '400',
                      },
                    ]}
                  >
                    {DISPATCH_STATUS_LABELS[s] || s}
                  </Text>
                </View>
              );
            })}
          </Card>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: spacing.md },
  loadingText: { fontSize: 14, marginTop: spacing.sm },
  emptyText: { fontSize: 14 },
  mapPlaceholder: {
    height: 200,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  mapText: { fontSize: 24 },
  coordText: { fontSize: 12, marginTop: 4 },
  statusCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  eta: { fontSize: 16, fontWeight: '700' },
  providerName: { fontSize: 15, fontWeight: '600' },
  timelineCard: { padding: spacing.lg },
  timelineTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLabel: { fontSize: 14 },
});
