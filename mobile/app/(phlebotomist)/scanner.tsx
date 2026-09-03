import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function PhlebotomistScannerScreen() {
  const { themeColors } = useTheme();
  const [barcode, setBarcode] = useState('');
  const [patientId, setPatientId] = useState('Suresh Menon');
  const [scannedTubes, setScannedTubes] = useState<string[]>([]);

  const handleManualAdd = () => {
    if (!barcode) return;
    setScannedTubes([...scannedTubes, barcode]);
    setBarcode('');
    Alert.alert('Barcode Linked', `Vacutainer Tube ${barcode} successfully tagged to ${patientId}.`);
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Barcode Tube Scanner" subtitle="Diagnostic Vacutainer Labeling" />

      <View style={styles.content}>
        <Card style={styles.viewfinderCard}>
          <View style={styles.viewfinderBorder}>
            <Text style={styles.scanTargetIcon}>📷</Text>
            <Text style={[styles.viewfinderText, { color: themeColors.textPrimary }]}>
              Point camera at Vacutainer Barcode / QR
            </Text>
          </View>
        </Card>

        <Card style={styles.manualCard}>
          <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>Manual Tube Tagging</Text>
          <Input
            label="Barcode ID / Vacutainer #"
            placeholder="e.g. VAC-998877"
            value={barcode}
            onChangeText={setBarcode}
          />
          <Button
            title="+ Link Vacutainer Tube"
            onPress={handleManualAdd}
            variant="accent"
            size="md"
          />
        </Card>

        {scannedTubes.length > 0 ? (
          <Card style={styles.scannedCard}>
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
              Linked Tubes ({scannedTubes.length})
            </Text>
            {scannedTubes.map((t, idx) => (
              <Text key={idx} style={[styles.tubeItem, { color: themeColors.textSecondary }]}>
                ✅ Tube #{idx + 1}: {t}
              </Text>
            ))}
          </Card>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.screenPaddingHorizontal,
  },
  viewfinderCard: {
    marginTop: spacing.md,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderBorder: {
    width: '90%',
    height: '85%',
    borderWidth: 2,
    borderColor: '#00D4B2',
    borderStyle: 'dashed',
    borderRadius: spacing.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTargetIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  viewfinderText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  manualCard: {
    marginTop: spacing.md,
  },
  cardTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  scannedCard: {
    marginTop: spacing.md,
  },
  tubeItem: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    marginTop: 4,
  },
});
