// mobile/src/components/widgets/kit/ScanSheet.tsx
// High-speed specimen barcode & QR code scanner viewfinder sheet.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.7

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { QrCode, X, Flashlight, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Glass } from '../../glass/Glass';

export interface ScanSheetProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  title?: string;
}

export const ScanSheet: React.FC<ScanSheetProps> = ({
  visible,
  onClose,
  onScanned,
  title = 'Scan Specimen Tube Barcode',
}) => {
  const [torch, setTorch] = useState(false);

  const simulateScan = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onScanned(`CMX-${Math.floor(100000 + Math.random() * 900000)}`);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheetContainer}>
          <Glass tier="G3" style={styles.glassBody} specular>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Viewfinder Area */}
            <View style={styles.viewfinder}>
              <View style={styles.scanTargetCornerTL} />
              <View style={styles.scanTargetCornerTR} />
              <View style={styles.scanTargetCornerBL} />
              <View style={styles.scanTargetCornerBR} />

              <View style={styles.laserLine} />
              <Camera size={32} color="rgba(255,255,255,0.4)" />
              <Text style={styles.guideText}>Align barcode within the target box</Text>
            </View>

            {/* Controls */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                onPress={() => setTorch(!torch)}
                style={[styles.toolBtn, torch && styles.toolBtnActive]}
              >
                <Flashlight size={18} color={torch ? '#38bdf8' : '#94a3b8'} />
                <Text style={[styles.toolBtnText, torch && { color: '#38bdf8' }]}>
                  {torch ? 'Torch ON' : 'Torch'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={simulateScan}
                style={styles.simulateBtn}
              >
                <QrCode size={18} color="#ffffff" />
                <Text style={styles.simulateBtnText}>Simulate Test Barcode</Text>
              </TouchableOpacity>
            </View>
          </Glass>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
  },
  glassBody: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  viewfinder: {
    height: 220,
    borderRadius: 20,
    backgroundColor: '#09101c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 18,
  },
  scanTargetCornerTL: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#38bdf8',
  },
  scanTargetCornerTR: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#38bdf8',
  },
  scanTargetCornerBL: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#38bdf8',
  },
  scanTargetCornerBR: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#38bdf8',
  },
  laserLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  guideText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  toolBtnActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56,189,248,0.1)',
  },
  toolBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  simulateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0284c7',
  },
  simulateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
