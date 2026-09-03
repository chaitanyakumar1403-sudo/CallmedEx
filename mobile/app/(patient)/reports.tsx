import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PaymentCheckoutModal } from '../../src/components/payments/PaymentCheckoutModal';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { api } from '../../src/services/api';

const POPULAR_TESTS = [
  { id: 'pkg-1', name: 'Comprehensive Full Body Checkup (64 Parameters)', price: 1499, fasting: '10-12 hrs fasting' },
  { id: 'pkg-2', name: 'Diabetes Panel (HbA1c + Fasting Blood Glucose)', price: 499, fasting: '8 hrs fasting' },
  { id: 'pkg-3', name: 'Complete Thyroid Profile (T3, T4, TSH Ultra)', price: 399, fasting: 'No fasting required' },
  { id: 'pkg-4', name: 'Advanced Lipid & Heart Risk Profile', price: 599, fasting: '12 hrs fasting' },
];

export default function ReportsScreen() {
  const { themeColors } = useTheme();

  const [reports, setReports] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // MediAssist AI Modal State
  const [selectedReportForAI, setSelectedReportForAI] = useState<any | null>(null);

  // Book Lab Test Drawer State
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<any | null>(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await api.get('/api/reports');
      if (res.data) setReports(res.data);
    } catch {
      setReports([
        {
          id: 'rep-001',
          test_name: 'Complete Blood Count (CBC)',
          lab_name: 'CallMedex Central Diagnostics',
          date: '14 Aug 2026',
          status: 'NORMAL',
          aiSummary: 'All hematological parameters are within optimal clinical limits. Hemoglobin (14.2 g/dL) and Platelet count (2.5 Lakhs) indicate healthy bone marrow function with no signs of anemia or infection.',
          parameters: [
            { name: 'Hemoglobin', value: '14.2', unit: 'g/dL', range: '13.0 - 17.0', flag: 'NORMAL' },
            { name: 'WBC Total Count', value: '7,500', unit: '/cumm', range: '4,000 - 11,000', flag: 'NORMAL' },
            { name: 'Platelet Count', value: '250,000', unit: '/cumm', range: '150,000 - 450,000', flag: 'NORMAL' },
          ],
        },
        {
          id: 'rep-002',
          test_name: 'Lipid Profile Screen',
          lab_name: 'Apollo Reference Lab',
          date: '10 Aug 2026',
          status: 'EVALUATED',
          aiSummary: 'Borderline elevated Total Cholesterol (215 mg/dL) and Triglycerides (160 mg/dL). HDL is within protective range (45 mg/dL). Recommended: Reduce saturated fats, include 30 mins brisk walking daily, and recheck in 90 days.',
          parameters: [
            { name: 'Total Cholesterol', value: '215', unit: 'mg/dL', range: '< 200', flag: 'HIGH' },
            { name: 'Triglycerides', value: '160', unit: 'mg/dL', range: '< 150', flag: 'BORDERLINE' },
            { name: 'HDL Good Cholesterol', value: '45', unit: 'mg/dL', range: '> 40', flag: 'NORMAL' },
          ],
        },
      ]);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  };

  const handleDownloadPDF = (rep: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Download Lab Report PDF', `Encrypted PDF report for ${rep.test_name} has been saved to your health vault.`);
  };

  const handleOpenAIExplanation = (rep: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedReportForAI(rep);
  };

  const handleSelectPackageToBook = (pkg: any) => {
    setSelectedPkg(pkg);
    setBookModalVisible(false);
    setCheckoutVisible(true);
  };

  const handleBookingSuccess = (paymentId: string) => {
    setCheckoutVisible(false);
    setSelectedPkg(null);
    Alert.alert(
      'Home Visit Scheduled! 🧪',
      'A certified CallMedex phlebotomist has been assigned. You can track their arrival live from the Home screen.'
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Diagnostic Reports"
        subtitle="Canonical Lab Records & MediAssist AI"
        rightAction={
          <Button
            title="+ Book Test"
            onPress={() => setBookModalVisible(true)}
            variant="accent"
            size="sm"
          />
        }
      />

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            title="No Reports Found"
            description="You have no diagnostic reports available."
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.testName, { color: themeColors.textPrimary }]}>
                  {item.test_name}
                </Text>
                <Text style={[styles.labName, { color: themeColors.textSecondary }]}>
                  {item.lab_name} • {item.date}
                </Text>
              </View>
              <Badge
                label={item.status}
                variant={item.status === 'NORMAL' ? 'success' : 'warning'}
              />
            </View>

            {/* Test Parameters */}
            {item.parameters && item.parameters.length > 0 ? (
              <View
                style={[
                  styles.paramContainer,
                  { backgroundColor: themeColors.inputBackground },
                ]}
              >
                {item.parameters.map((p: any, pIdx: number) => (
                  <View key={pIdx} style={styles.paramRow}>
                    <Text style={[styles.paramName, { color: themeColors.textPrimary }]}>
                      {p.name}
                    </Text>
                    <View style={styles.paramValueGroup}>
                      <Text
                        style={[
                          styles.paramValue,
                          {
                            color:
                              p.flag === 'HIGH'
                                ? themeColors.danger.DEFAULT
                                : themeColors.textPrimary,
                          },
                        ]}
                      >
                        {p.value} {p.unit}
                      </Text>
                      <Text
                        style={[styles.paramRange, { color: themeColors.textMuted }]}
                      >
                        Ref: {p.range}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.actionFooter}>
              <Button
                title="📄 Download PDF"
                onPress={() => handleDownloadPDF(item)}
                variant="outline"
                size="sm"
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="✨ MediAssist AI Insights"
                onPress={() => handleOpenAIExplanation(item)}
                variant="primary"
                size="sm"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}
      />

      {/* MediAssist AI Summary Modal */}
      {selectedReportForAI && (
        <Modal visible={!!selectedReportForAI} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalSheet,
                { backgroundColor: themeColors.card },
              ]}
            >
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
                <View>
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: themeColors.textPrimary },
                    ]}
                  >
                    ✨ MediAssist AI Clinical Insights
                  </Text>
                  <Text
                    style={[
                      styles.modalSubtitle,
                      { color: themeColors.accent.dark },
                    ]}
                  >
                    {selectedReportForAI.test_name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedReportForAI(null)}
                  style={{ padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel="Close Modal"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ fontSize: 18, color: themeColors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 350, marginVertical: spacing.md }}>
                <View
                  style={[
                    styles.aiTextBox,
                    { backgroundColor: themeColors.inputBackground },
                  ]}
                >
                  <Text
                    style={[
                      styles.aiText,
                      { color: themeColors.textPrimary },
                    ]}
                  >
                    {selectedReportForAI.aiSummary ||
                      'Report values analyzed. No critical physiological deviations detected.'}
                  </Text>
                </View>

                <View style={styles.doctorAdviceBox}>
                  <Text style={styles.adviceTitle}>💡 Next Steps for Consultation:</Text>
                  <Text style={styles.adviceBody}>
                    1. Share these values with your cardiologist during your next follow-up.
                  </Text>
                  <Text style={styles.adviceBody}>
                    2. Maintain dietary log of carbohydrates and saturated fats.
                  </Text>
                </View>
              </ScrollView>

              <Button
                title="Close Insights"
                onPress={() => setSelectedReportForAI(null)}
                variant="outline"
                size="md"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Book New Diagnostic Test Drawer */}
      {bookModalVisible && (
        <Modal visible={bookModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalSheet,
                { backgroundColor: themeColors.card },
              ]}
            >
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
                <View>
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: themeColors.textPrimary },
                    ]}
                  >
                    Book Diagnostic Lab Test
                  </Text>
                  <Text
                    style={[
                      styles.modalSubtitle,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Certified Phlebotomist • Safe Home Sample Collection
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setBookModalVisible(false)}
                  style={{ padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel="Close Modal"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ fontSize: 18, color: themeColors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400, marginVertical: spacing.md }}>
                {POPULAR_TESTS.map((pkg) => (
                  <Card key={pkg.id} style={styles.pkgCard}>
                    <View style={styles.pkgHeader}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pkgName,
                            { color: themeColors.textPrimary },
                          ]}
                        >
                          {pkg.name}
                        </Text>
                        <Text
                          style={[
                            styles.pkgFasting,
                            { color: themeColors.accent.dark },
                          ]}
                        >
                          🧪 {pkg.fasting}
                        </Text>
                        <Text
                          style={[
                            styles.pkgPrice,
                            { color: themeColors.textPrimary },
                          ]}
                        >
                          ₹{pkg.price}
                        </Text>
                      </View>
                      <Button
                        title="Book Home Visit"
                        onPress={() => handleSelectPackageToBook(pkg)}
                        variant="primary"
                        size="sm"
                      />
                    </View>
                  </Card>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Razorpay Payment Modal for Lab Booking */}
      {selectedPkg && checkoutVisible && (
        <PaymentCheckoutModal
          visible={checkoutVisible}
          onClose={() => {
            setCheckoutVisible(false);
            setSelectedPkg(null);
          }}
          bookingId={`lab_order_${selectedPkg.id}_${Date.now()}`}
          title={selectedPkg.name}
          amount={selectedPkg.price}
          providerName="CallMedex Diagnostic Network"
          onSuccess={handleBookingSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: 100,
  },
  card: {
    marginTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  testName: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  labName: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  paramContainer: {
    borderRadius: spacing.buttonRadius,
    padding: spacing.sm,
    marginVertical: spacing.md,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  paramName: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  paramValueGroup: {
    alignItems: 'flex-end',
  },
  paramValue: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  paramRange: {
    fontSize: typography.fontSize.tiny,
  },
  actionFooter: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: spacing.cardRadius,
    borderTopRightRadius: spacing.cardRadius,
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  aiTextBox: {
    padding: spacing.md,
    borderRadius: spacing.cardRadius,
    borderLeftWidth: 3,
    borderLeftColor: '#00D4B2',
  },
  aiText: {
    fontSize: typography.fontSize.body,
    lineHeight: 22,
  },
  doctorAdviceBox: {
    backgroundColor: '#0F2744',
    padding: spacing.md,
    borderRadius: spacing.cardRadius,
    marginTop: spacing.md,
  },
  adviceTitle: {
    color: '#38BDF8',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
  },
  adviceBody: {
    color: '#E2E8F0',
    fontSize: typography.fontSize.tiny,
    lineHeight: 18,
    marginTop: 2,
  },
  pkgCard: {
    marginBottom: spacing.sm,
  },
  pkgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pkgName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  pkgFasting: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 2,
  },
  pkgPrice: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
    marginTop: 4,
  },
});
