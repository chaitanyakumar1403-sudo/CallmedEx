// mobile/src/components/widgets/SpecimenPassport.tsx
// Tamper-evident specimen chain-of-custody passport with 5-point intake verification.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §9.1

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ShieldCheck, Thermometer, Clock, CheckCircle2 } from 'lucide-react-native';
import { Glass } from '../glass/Glass';

export interface CustodyEvent {
  id: string;
  eventType: string;
  label: string;
  actorRole: string;
  actorName?: string | null;
  temperatureCelsius?: number | null;
  at: string;
  verification?: Array<{ point: string; passed: boolean }> | null;
}

export interface SpecimenPassportProps {
  barcode: string;
  tubeType: string;
  status: string;
  isVerified?: boolean;
  events: CustodyEvent[];
}

export const SpecimenPassport: React.FC<SpecimenPassportProps> = ({
  barcode,
  tubeType,
  status,
  isVerified = false,
  events,
}) => {
  const getTubeStyle = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('LAVENDER') || t.includes('EDTA')) return { fill: '#9333ea', label: 'EDTA K2 Lavender' };
    if (t.includes('YELLOW') || t.includes('SST')) return { fill: '#eab308', label: 'Serum SST Yellow' };
    if (t.includes('GREY') || t.includes('FLUORIDE')) return { fill: '#94a3b8', label: 'Sodium Fluoride Grey' };
    if (t.includes('BLUE') || t.includes('CITRATE')) return { fill: '#0284c7', label: 'Sodium Citrate Blue' };
    return { fill: '#e11d48', label: type || 'Clinical Specimen' };
  };

  const tube = getTubeStyle(tubeType);

  return (
    <Glass tier="G1" style={styles.container} specular>
      {/* Header Badge */}
      <View style={styles.header}>
        <View style={styles.tubeBadgeRow}>
          <View style={[styles.tubeColorPill, { backgroundColor: tube.fill }]} />
          <View>
            <Text style={styles.barcodeText}>{barcode}</Text>
            <Text style={styles.tubeTypeText}>{tube.label}</Text>
          </View>
        </View>

        <View style={styles.statusBadge}>
          <ShieldCheck size={14} color="#34d399" />
          <Text style={styles.statusBadgeText}>
            {isVerified ? '5-Point Verified' : status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Custody Milestones Timeline */}
      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>CHAIN OF CUSTODY TRAIL</Text>
        <ScrollView style={styles.eventsScroll} nestedScrollEnabled>
          {events.map((ev, index) => {
            const isLast = index === events.length - 1;
            return (
              <View key={ev.id || index} style={styles.eventRow}>
                {/* Timeline connector */}
                <View style={styles.indicatorCol}>
                  <View style={[styles.dot, isLast && styles.activeDot]} />
                  {!isLast && <View style={styles.line} />}
                </View>

                {/* Event Details */}
                <View style={styles.eventContent}>
                  <View style={styles.eventTitleRow}>
                    <Text style={styles.eventLabel}>{ev.label}</Text>
                    {ev.temperatureCelsius !== null && ev.temperatureCelsius !== undefined && (
                      <View style={styles.tempBadge}>
                        <Thermometer size={11} color="#38bdf8" />
                        <Text style={styles.tempText}>{ev.temperatureCelsius}°C</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.eventMetaRow}>
                    {ev.actorName && (
                      <Text style={styles.actorText}>
                        By {ev.actorName} ({ev.actorRole}) &bull;{' '}
                      </Text>
                    )}
                    <Clock size={11} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.timeText}>
                      {ev.at ? new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>

                  {/* 5-Point Verification Box (G4 Clinical Opaque) */}
                  {ev.verification && ev.verification.length > 0 && (
                    <Glass tier="G4" style={styles.verificationCard} specular={false}>
                      <Text style={styles.verifHeading}>PROCESSING CENTER 5-POINT INTAKE</Text>
                      {ev.verification.map((v, vIdx) => (
                        <View key={vIdx} style={styles.verifRow}>
                          <Text style={styles.verifPoint}>{v.point}</Text>
                          <View style={styles.verifBadge}>
                            <CheckCircle2 size={12} color="#34d399" />
                            <Text style={styles.verifStatusText}>
                              {v.passed ? 'PASSED' : 'FLAGGED'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </Glass>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 14,
  },
  tubeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tubeColorPill: {
    width: 6,
    height: 38,
    borderRadius: 3,
  },
  barcodeText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tubeTypeText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  timelineSection: {
    marginTop: 14,
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  eventsScroll: {
    maxHeight: 280,
  },
  eventRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  indicatorCol: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#64748b',
    marginTop: 4,
  },
  activeDot: {
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  line: {
    flex: 1,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 4,
  },
  eventContent: {
    flex: 1,
    paddingLeft: 10,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventLabel: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '600',
  },
  tempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(14,116,144,0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tempText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  actorText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  timeText: {
    color: '#64748b',
    fontSize: 11,
  },
  verificationCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  verifHeading: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  verifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  verifPoint: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  verifBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifStatusText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
});
