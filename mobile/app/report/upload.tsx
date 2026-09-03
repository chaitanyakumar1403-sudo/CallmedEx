/**
 * Report Upload Screen — Camera/gallery capture for AI report analysis.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { reportsService } from '../../src/services/reports';

export default function ReportUploadScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    const permResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permResult.granted) {
      Alert.alert('Permission Required', `Please grant ${useCamera ? 'camera' : 'gallery'} access.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!imageUri) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: 'report.jpg',
        type: 'image/jpeg',
      } as any);

      const { job_id } = await reportsService.uploadReport(formData);
      Alert.alert(
        'Report Submitted',
        `Your report is being analyzed (Job: ${job_id.slice(0, 8)}). You'll receive results shortly.`,
        [
          {
            text: 'View Reports',
            onPress: () => router.replace('/(patient)/reports'),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message || 'Could not upload report. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Upload Report" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Upload a lab report image for AI-powered analysis. We'll extract biomarkers and provide health insights.
        </Text>

        {/* Image Preview */}
        {imageUri ? (
          <Card elevated style={styles.previewCard}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            <Button
              title="Change Image"
              onPress={() => setImageUri(null)}
              variant="outline"
              style={styles.changeButton}
            />
          </Card>
        ) : (
          <Card style={styles.uploadCard}>
            <Text style={styles.uploadIcon}>📄</Text>
            <Text style={[styles.uploadText, { color: themeColors.textSecondary }]}>
              Take a photo or select from gallery
            </Text>
            <View style={styles.buttonRow}>
              <Button
                title="📷 Camera"
                onPress={() => pickImage(true)}
                style={styles.pickButton}
              />
              <Button
                title="🖼️ Gallery"
                onPress={() => pickImage(false)}
                variant="outline"
                style={styles.pickButton}
              />
            </View>
          </Card>
        )}

        {/* Upload Button */}
        {imageUri && (
          <Button
            title={uploading ? 'Uploading...' : 'Analyze Report'}
            onPress={handleUpload}
            disabled={uploading}
            loading={uploading}
            style={styles.uploadButton}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 80 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  uploadCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  uploadIcon: { fontSize: 48 },
  uploadText: { fontSize: 14, textAlign: 'center' },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  pickButton: { flex: 1 },
  previewCard: {
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  changeButton: { alignSelf: 'center' },
  uploadButton: { marginTop: spacing.lg },
});
