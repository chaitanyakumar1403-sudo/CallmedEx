// mobile/src/components/widgets/kit/LiveTrack.tsx
// Real-time dispatch tracking radar pulse and provider distance meter.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.2

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Navigation, Clock, ShieldCheck, User } from 'lucide-react-native';
import { Glass } from '../../glass/Glass';

export interface LiveTrackProps {
  providerName: string;
  providerRating?: number;
  status: string;
  etaMinutes: number;
  distanceKm: number;
}

export const LiveTrack: React.FC<LiveTrackProps> = ({
  providerName,
  providerRating = 4.9,
  status,
  etaMinutes,
  distanceKm,
}) => {
  return (
    <Glass tier="G1" style={styles.container} specular>
      {/* Radar Map Simulation Area */}
      <View style={styles.radarZone}>
        <View style={styles.radarCircleOuter} />
        <View style={styles.radarCircleMid} />
        <View style={styles.radarPulseCenter}>
          <Navigation size={18} color="#ffffff" style={styles.navIcon} />
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      {/* Telemetry Strip */}
      <View style={styles.telemetryRow}>
        <View style={styles.metricBox}>
          <Clock size={16} color="#38bdf8" />
          <View>
            <Text style={styles.metricVal}>
              {etaMinutes > 0 ? `${etaMinutes} mins` : 'Arrived'}
            </Text>
            <Text style={styles.metricSub}>Estimated Arrival</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricBox}>
          <Navigation size={16} color="#34d399" />
          <View>
            <Text style={styles.metricVal}>
              {distanceKm > 0 ? `${distanceKm} km` : '0 km'}
            </Text>
            <Text style={styles.metricSub}>Distance</Text>
          </View>
        </View>
      </View>

      {/* Provider Details */}
      <View style={styles.providerRow}>
        <View style={styles.avatarCircle}>
          <User size={16} color="#38bdf8" />
        </View>
        <View style={styles.providerInfo}>
          <Text style={styles.providerName}>{providerName}</Text>
          <Text style={styles.providerSub}>
            ⭐ {providerRating} &bull; Verified Field Specialist
          </Text>
        </View>
        <ShieldCheck size={18} color="#34d399" />
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
  radarZone: {
    height: 140,
    borderRadius: 16,
    backgroundColor: '#0c1626',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 14,
  },
  radarCircleOuter: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.15)',
  },
  radarCircleMid: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  radarPulseCenter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  navIcon: {
    transform: [{ rotate: '45deg' }],
  },
  statusPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(2,132,199,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.4)',
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 12,
    marginBottom: 12,
  },
  metricBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricVal: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  metricSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  providerSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
});
