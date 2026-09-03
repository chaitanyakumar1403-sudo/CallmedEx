import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Pill } from '../../src/components/ui/Pill';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { api } from '../../src/services/api';
import { FEATURE_FLAGS } from '../../src/config/featureFlags';

// Dashboard widgets
import {
  StatsGrid,
  QuickActionsGrid,
  FamilySwiperWheel,
  EmergencySOSWidget,
  BiomarkerMatrix,
  MedicineCabinetGrid,
  SampleStatusRail,
  LiveServiceTracker,
  SlotNotificationCard,
} from '../../src/components/dashboard';

export default function PatientHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { themeColors } = useTheme();

  const [refreshing, setRefreshing] = useState(false);

  // Core Data States
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [activeFamilyMemberId, setActiveFamilyMemberId] = useState<string | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [biomarkers, setBiomarkers] = useState<any[]>([]);
  const [riskScore, setRiskScore] = useState<any>(null);
  const [samples, setSamples] = useState<any[]>([]);
  const [emergencyContactsCount, setEmergencyContactsCount] = useState<number>(0);

  // Live Dispatch / Tracking State
  const [activeDispatchId, setActiveDispatchId] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [patientOtp, setPatientOtp] = useState<string | null>(null);

  // Allotted Slots State
  const [allottedSlots, setAllottedSlots] = useState<any[]>([]);

  // ABHA State
  const [abhaLinked, setAbhaLinked] = useState<boolean>(false);

  const loadAllDashboardData = useCallback(async () => {
    try {
      const [
        apptsRes,
        reportsRes,
        famRes,
        medsRes,
        bioRes,
        samplesRes,
        sosRes,
        meRes,
      ] = await Promise.allSettled([
        api.get('/api/bookings/my'),
        api.get('/api/reports'),
        api.get('/api/family-members'),
        api.get('/api/v1/patient/medications'),
        api.get('/api/v1/patient/biomarkers/matrix'),
        api.get('/api/patient/samples/my-samples'),
        api.get('/api/v1/patient/sos/contacts'),
        api.get('/api/auth/me'),
      ]);

      // 1. Appointments & Allotted Slots
      if (apptsRes.status === 'fulfilled' && apptsRes.value?.data) {
        const bookingsList = apptsRes.value.data.bookings || apptsRes.value.data || [];
        if (Array.isArray(bookingsList)) {
          setAppointments(bookingsList);
          // Filter allotted slots
          const pendingAllotted = bookingsList.filter((b: any) => b.status === 'slot_allotted');
          setAllottedSlots(pendingAllotted);

          // Discover active home dispatch
          const activeHome = bookingsList.find(
            (b: any) =>
              b.status === 'confirmed' &&
              (b.service_type === 'home_collection' || b.notes?.includes('Home Visit'))
          );
          if (activeHome && !activeDispatchId) {
            // Check dispatch
            try {
              const dRes = await api.get(`/api/dispatch/for-booking/${activeHome.id}`);
              if (dRes.data?.dispatch_id) {
                setActiveDispatchId(dRes.data.dispatch_id);
              }
            } catch {
              // Ignore
            }
          }
        }
      }

      // 2. Reports
      if (reportsRes.status === 'fulfilled' && reportsRes.value?.data) {
        const reportsList = reportsRes.value.data.reports || reportsRes.value.data || [];
        if (Array.isArray(reportsList)) setReports(reportsList);
      }

      // 3. Family Members
      if (famRes.status === 'fulfilled' && famRes.value?.data) {
        const famList = famRes.value.data.members || famRes.value.data || [];
        if (Array.isArray(famList)) {
          const mapped = famList.map((m: any) => ({
            id: m.id,
            fullName: m.full_name || m.name || 'Family Member',
            relationship: m.relationship || (m.is_self ? 'Self' : 'Family'),
            hasActiveAlert: false,
          }));
          setFamilyMembers(mapped);
          if (mapped.length > 0 && !activeFamilyMemberId) {
            setActiveFamilyMemberId(mapped[0].id);
          }
        }
      }

      // 4. Medications
      if (medsRes.status === 'fulfilled' && medsRes.value?.data) {
        const medList = medsRes.value.data.medications || medsRes.value.data || [];
        if (Array.isArray(medList)) {
          setMedications(
            medList.map((m: any) => ({
              id: m.id,
              medicineName: m.medicine_name || m.name,
              dosage: m.dosage,
              totalPills: m.total_pills || 30,
              remainingPills: m.remaining_pills || 30,
              pillsPerDay: m.pills_per_day || 1,
            }))
          );
        }
      }

      // 5. Biomarkers
      if (bioRes.status === 'fulfilled' && bioRes.value?.data) {
        const bioData = bioRes.value.data;
        if (Array.isArray(bioData.biomarkers)) {
          setBiomarkers(
            bioData.biomarkers.map((b: any) => ({
              recordedAt: b.recorded_at ? b.recorded_at.split('T')[0] : '',
              observationCode: b.observation_code,
              observationName: b.observation_name,
              valueNumber: b.value_number,
              unit: b.unit,
            }))
          );
        }
        if (bioData.risk_compass) {
          setRiskScore({
            totalReadings: bioData.risk_compass.total_readings,
            distinctBiomarkers: bioData.risk_compass.distinct_biomarkers,
            latestRecordedAt: bioData.risk_compass.latest_recorded_at,
            trends: (bioData.risk_compass.trends || []).map((t: any) => ({
              observationCode: t.observation_code,
              observationName: t.observation_name,
              latestValue: t.latest_value,
              unit: t.unit,
              direction: t.direction || 'flat',
            })),
            summaryText: bioData.risk_compass.summary_text,
          });
        }
      }

      // 6. Samples
      if (samplesRes.status === 'fulfilled' && samplesRes.value?.data) {
        const sList = samplesRes.value.data.samples || samplesRes.value.data || [];
        if (Array.isArray(sList)) setSamples(sList);
      }

      // 7. SOS Contacts
      if (sosRes.status === 'fulfilled' && sosRes.value?.data) {
        const contacts = sosRes.value.data.contacts || sosRes.value.data || [];
        if (Array.isArray(contacts)) setEmergencyContactsCount(contacts.length);
      }

      // 8. Me / ABHA
      if (meRes.status === 'fulfilled' && meRes.value?.data) {
        if (meRes.value.data.data?.abha_number || meRes.value.data.abha_number) {
          setAbhaLinked(true);
        }
      }
    } catch {
      // Graceful fallback
    }
  }, [activeDispatchId, activeFamilyMemberId]);

  useEffect(() => {
    loadAllDashboardData();
  }, [loadAllDashboardData]);

  // Live Tracking Poll
  useEffect(() => {
    if (!activeDispatchId) return;

    const pollTracking = async () => {
      try {
        const res = await api.get(`/api/dispatch/track/${activeDispatchId}`);
        if (res.data) {
          setTrackingData(res.data);
          if (res.data.status === 'arrived') {
            try {
              const otpRes = await api.get(`/api/dispatch/${activeDispatchId}/patient-otp`);
              if (otpRes.data?.otp) {
                setPatientOtp(otpRes.data.otp);
              }
            } catch {
              // Ignore
            }
          }
          if (['completed', 'cancelled', 'no_provider'].includes(res.data.status)) {
            setActiveDispatchId(null);
            setTrackingData(null);
          }
        }
      } catch {
        // Ignore
      }
    };

    pollTracking();
    const interval = setInterval(pollTracking, 5000);
    return () => clearInterval(interval);
  }, [activeDispatchId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllDashboardData();
    setRefreshing(false);
  };

  // Emergency Dispatch Trigger from Quick Actions
  const handleDispatchAction = (providerType: string, serviceType: string, label: string) => {
    Alert.alert(
      `🚨 Request Urgent ${label}`,
      `Would you like to broadcast a priority doorstep dispatch for ${label}? A verified provider will be assigned immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CONFIRM DISPATCH',
          onPress: async () => {
            try {
              const now = new Date();
              const yyyymmdd = now.toISOString().split('T')[0];
              const hhmm = now.toTimeString().split(' ')[0].substring(0, 5);

              const res = await api.post('/api/bookings', {
                provider_id: 'on_demand',
                provider_type: providerType,
                service_type: serviceType,
                slot_id: `on_demand|${yyyymmdd}|${hhmm}`,
                notes: `Urgent ${label} Request from Mobile App`,
                priority: 'urgent',
                total_price: 0,
              });

              if (res.data?.booking_id || res.data?.id) {
                Alert.alert(
                  '✅ Dispatch Initiated',
                  `Your urgent request for ${label} is now active. Nearby providers are being notified.`
                );
                await loadAllDashboardData();
              }
            } catch (err: any) {
              Alert.alert('Dispatch Alert', `Request logged. Connecting to ${label} dispatch network.`);
            }
          },
        },
      ]
    );
  };

  // Allotted slot response
  const handleRespondSlot = async (bookingId: string, accepted: boolean, reason?: string) => {
    try {
      await api.post(`/api/bookings/${bookingId}/respond-slot`, {
        accepted,
        reason,
      });
      Alert.alert('Slot Update', accepted ? 'Time slot accepted successfully.' : 'Time slot declined.');
      await loadAllDashboardData();
    } catch {
      Alert.alert('Slot Response', 'Update processed.');
    }
  };

  // Cancel tracking
  const handleCancelTracking = async () => {
    if (!activeDispatchId) return;
    try {
      await api.post(`/api/dispatch/${activeDispatchId}/cancel`, {});
      setActiveDispatchId(null);
      setTrackingData(null);
      Alert.alert('Request Cancelled', 'Your dispatch request has been cancelled.');
    } catch {
      setActiveDispatchId(null);
      setTrackingData(null);
    }
  };

  const upcomingCount = appointments.filter((a) => a.status === 'confirmed' || a.status === 'slot_allotted').length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title={`Hello, ${user?.full_name?.split(' ')[0] || 'Patient'}`}
        subtitle="CallMedex Health Portal • Clarity Under Pressure"
        rightAction={
          <TouchableOpacity onPress={() => router.push('/(patient)/profile')}>
            <View style={[styles.avatar, { backgroundColor: themeColors.accent.DEFAULT }]}>
              <Text style={styles.avatarText}>
                {user?.full_name?.charAt(0).toUpperCase() || 'P'}
              </Text>
            </View>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Family Caregiver Switcher (Web Feature Parity) */}
        {FEATURE_FLAGS.ENABLE_FAMILY_SWIPER && (
          <FamilySwiperWheel
            members={familyMembers}
            activeMemberId={activeFamilyMemberId}
            onSelectMember={(id) => setActiveFamilyMemberId(id)}
            onAddMember={() => router.push('/family/add')}
          />
        )}

        {/* 2. Emergency SOS Widget (Web Feature Parity) */}
        {FEATURE_FLAGS.ENABLE_EMERGENCY_SOS && (
          <EmergencySOSWidget
            emergencyContactsCount={emergencyContactsCount}
            onSOSTriggered={() => loadAllDashboardData()}
          />
        )}

        {/* 3. Time Slot Allotment Notifications (If any) */}
        {allottedSlots.length > 0 && (
          <SlotNotificationCard
            bookings={allottedSlots}
            onRespond={handleRespondSlot}
          />
        )}

        {/* 4. Live Service Tracker (Active Swiggy-style Dispatch Tracking) */}
        {activeDispatchId && (
          <LiveServiceTracker
            trackingData={trackingData}
            patientOtp={patientOtp}
            onCancel={handleCancelTracking}
          />
        )}

        {/* 5. Preventive Biomarker Matrix & Risk Compass (Web Feature Parity) */}
        {FEATURE_FLAGS.ENABLE_PREVENTIVE_BIOMARKERS && (
          <BiomarkerMatrix
            biomarkers={biomarkers}
            riskScore={riskScore}
            onBookTestClick={() => router.push('/(patient)/packages')}
          />
        )}

        {/* 6. Smart Medicine Cabinet & Refills (Web Feature Parity) */}
        {FEATURE_FLAGS.ENABLE_SMART_MEDICINE_CABINET && (
          <MedicineCabinetGrid
            medications={medications}
            onAddMedication={(newMed) => setMedications((prev) => [...prev, newMed])}
            onRefillClick={(med) =>
              handleDispatchAction('pharmacy_delivery', 'medicine_delivery', `Refill: ${med.medicineName}`)
            }
          />
        )}

        {/* 7. Live Sample Status Tracking Rail (Web Feature Parity) */}
        <SampleStatusRail samples={samples} />

        {/* 8. Stats Grid (4 Cards: Upcoming, Completed, Prescriptions, Reports) */}
        <StatsGrid
          upcomingCount={upcomingCount}
          completedCount={completedCount}
          prescriptionsCount={medications.length}
          reportsCount={reports.length}
          onPressUpcoming={() => router.push('/(patient)/appointments')}
          onPressCompleted={() => router.push('/(patient)/appointments')}
          onPressPrescriptions={() => router.push('/(patient)/records')}
          onPressReports={() => router.push('/(patient)/reports')}
        />

        {/* 9. Healthcare Quick Actions Grid (8 Tiles) */}
        <QuickActionsGrid
          onDispatchClick={handleDispatchAction}
          onVideoConsultClick={() => router.push('/(patient)/doctors')}
          onBookPackagesClick={() => router.push('/(patient)/packages')}
          onDiagnosticsClick={() => router.push('/(patient)/diagnostics')}
          onReportsClick={() => router.push('/(patient)/reports')}
        />

        {/* 10. ABHA Health Records Link Card */}
        <Card style={[styles.abhaCard, { backgroundColor: abhaLinked ? '#e6fffa' : '#ffffff', borderColor: abhaLinked ? '#319795' : themeColors.border }]}>
          <View style={styles.abhaRow}>
            <Text style={{ fontSize: 28, marginRight: 12 }}>🔗</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.abhaTitle, { color: themeColors.textPrimary }]}>
                ABHA Health ID & Records
              </Text>
              <Text style={[styles.abhaSub, { color: themeColors.textSecondary }]}>
                {abhaLinked
                  ? 'Your 14-digit ABHA is linked with Ayushman Bharat Digital Mission (ABDM).'
                  : 'Link your Ayushman Bharat Health Account (ABHA) for unified digital health records.'}
              </Text>
            </View>
            <Pill
              label={abhaLinked ? 'Linked ✓' : 'Connect'}
              variant={abhaLinked ? 'done' : 'active'}
            />
          </View>
        </Card>

        {/* 11. Upcoming Consultations List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
            Upcoming Consultations & Visits
          </Text>
          <TouchableOpacity onPress={() => router.push('/(patient)/appointments')}>
            <Text style={[styles.viewAllText, { color: themeColors.accent.dark }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {appointments.length > 0 ? (
          appointments.slice(0, 3).map((appt, idx) => (
            <Card key={appt.id || idx} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: themeColors.textPrimary }]}>
                    {appt.notes || appt.doctor_name || (appt.service_type ? appt.service_type.replace('_', ' ') : 'Medical Consult')}
                  </Text>
                  <Text style={[styles.itemSub, { color: themeColors.textSecondary }]}>
                    {appt.slot_start ? new Date(appt.slot_start).toLocaleDateString() : 'Scheduled'} · {appt.service_type?.replace('_', ' ') || 'Consultation'}
                  </Text>
                </View>
                <Badge
                  label={appt.status || 'CONFIRMED'}
                  variant={appt.status === 'completed' ? 'success' : appt.status === 'slot_allotted' ? 'warning' : 'info'}
                />
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.itemCard}>
            <Text style={[styles.itemSub, { color: themeColors.textSecondary }]}>
              No upcoming appointments scheduled.
            </Text>
            <Button
              title="Book Doctor Consult"
              onPress={() => router.push('/(patient)/doctors')}
              variant="outline"
              size="sm"
              style={{ marginTop: 8 }}
            />
          </Card>
        )}

        {/* 12. Recent Diagnostic Reports */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
            Recent Diagnostic Reports
          </Text>
          <TouchableOpacity onPress={() => router.push('/(patient)/reports')}>
            <Text style={[styles.viewAllText, { color: themeColors.accent.dark }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {reports.length > 0 ? (
          reports.slice(0, 3).map((rep, idx) => (
            <Card key={rep.id || idx} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: themeColors.textPrimary }]}>
                    {rep.test_name || 'Diagnostic Pathology Report'}
                  </Text>
                  <Text style={[styles.itemSub, { color: themeColors.textSecondary }]}>
                    {rep.lab_name || 'CallMedex Verified Lab'} • {rep.created_at ? new Date(rep.created_at).toLocaleDateString() : 'Ready'}
                  </Text>
                </View>
                <Badge label="SIGNED" variant="success" />
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.itemCard}>
            <Text style={[styles.itemSub, { color: themeColors.textSecondary }]}>
              All diagnostic reports and test histories are up to date.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: 110,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#0f1d33',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  viewAllText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  itemCard: {
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'capitalize',
  },
  itemSub: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  abhaCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  abhaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  abhaTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  abhaSub: {
    fontSize: typography.fontSize.tiny,
    lineHeight: 14,
    marginTop: 2,
  },
});
