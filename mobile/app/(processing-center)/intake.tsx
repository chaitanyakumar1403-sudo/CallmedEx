import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { AppShell } from '../../src/components/glass/AppShell';
import { Glass } from '../../src/components/glass/Glass';
import { VerifyChecklist, VerificationItem } from '../../src/components/widgets/kit/VerifyChecklist';
import { HoldToTrigger } from '../../src/components/widgets/HoldToTrigger';
import { ScanSheet } from '../../src/components/widgets/kit/ScanSheet';
import { QrCode, CheckCircle, AlertOctagon } from 'lucide-react-native';

export default function ProcessingCenterIntakeScreen() {
  const [barcode, setBarcode] = useState('CMX-882190');
  const [scanVisible, setScanVisible] = useState(false);
  const [checklist, setChecklist] = useState<VerificationItem[]>([
    { id: '1', point: '1. Patient Identity Match', passed: true },
    { id: '2', point: '2. Tube Type & Color Conformity', passed: true },
    { id: '3', point: '3. Volume Sufficiency (>2.0mL)', passed: true },
    { id: '4', point: '4. Cold Chain Integrity (2–8°C)', passed: true },
    { id: '5', point: '5. Physical Quality (Non-hemolyzed)', passed: true },
  ]);

  const toggleItem = (id: string, passed: boolean) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, passed } : item))
    );
  };

  const handleApprove = () => {
    Alert.alert('Intake Verified', `Tube ${barcode} accepted and added to ready batch.`);
  };

  const handleReject = () => {
    Alert.alert('Specimen Flagged', `Tube ${barcode} flagged for lab supervisor review.`);
  };

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>5-Point Specimen Intake</Text>
          <Text style={styles.headerSubtitle}>Mandatory Clinical Verification</Text>
        </View>

        {/* Scanned Barcode Strip */}
        <Glass tier="G1" style={styles.barcodeStrip} specular>
          <View>
            <Text style={styles.barcodeLabel}>CURRENT SPECIMEN</Text>
            <Text style={styles.barcodeValue}>{barcode}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setScanVisible(true)}
            style={styles.scanBtn}
          >
            <QrCode size={16} color="#ffffff" />
            <Text style={styles.scanBtnText}>Scan Next</Text>
          </TouchableOpacity>
        </Glass>

        {/* 5-Point Verification Checklist */}
        <VerifyChecklist items={checklist} onToggleItem={toggleItem} />

        {/* Approval CTA */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleApprove}
          style={styles.approveBtn}
        >
          <CheckCircle size={18} color="#ffffff" />
          <Text style={styles.approveBtnText}>Approve & Stamp Custody Event</Text>
        </TouchableOpacity>

        {/* Safety Hold-To-Trigger for Rejection */}
        <View style={{ marginTop: 12 }}>
          <HoldToTrigger
            label="HOLD TO REJECT SPECIMEN"
            subLabel="Hold for 1.5s to flag and notify phlebotomist"
            color="#ef4444"
            onTrigger={handleReject}
          />
        </View>

        <ScanSheet
          visible={scanVisible}
          onClose={() => setScanVisible(false)}
          onScanned={(code) => setBarcode(code)}
        />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  header: {
    marginBottom: 14,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  barcodeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
  },
  barcodeLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  barcodeValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#059669',
  },
  scanBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#10b981',
    marginTop: 10,
  },
  approveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
