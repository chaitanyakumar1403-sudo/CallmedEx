/**
 * Video Consultation Screen — Daily.co WebView integration for telemedicine calls.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { consultationService } from '../../src/services/consultationApi';

// Conditionally import WebView — it may not be installed yet
let WebView: any;
try {
  WebView = require('react-native-webview').WebView;
} catch {
  WebView = null;
}

export default function VideoConsultationScreen() {
  const { consultationId } = useLocalSearchParams<{ consultationId: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();

  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function joinRoom() {
      if (!consultationId) {
        setError('No consultation ID provided.');
        setLoading(false);
        return;
      }
      try {
        const room = await consultationService.joinConsultation(consultationId);
        const url = room.token
          ? `${room.room_url}?t=${room.token}`
          : room.room_url;
        setRoomUrl(url);
      } catch (e: any) {
        setError(e.message || 'Failed to join consultation room.');
      } finally {
        setLoading(false);
      }
    }
    joinRoom();
  }, [consultationId]);

  const handleEndCall = () => {
    Alert.alert('End Call', 'Are you sure you want to leave this consultation?', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await consultationService.endConsultation({
              consultation_id: consultationId!,
            });
          } catch {
            // Best effort
          }
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Connecting to doctor...</Text>
      </View>
    );
  }

  if (error || !roomUrl) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>
          {error || 'Unable to load video room.'}
        </Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  if (!WebView) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.errorText, { color: themeColors.danger.DEFAULT }]}>
          Video calling requires react-native-webview. Please install it.
        </Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: roomUrl }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.center, StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      />

      {/* Floating End Call Button */}
      <View style={styles.controlsOverlay}>
        <Button
          title="End Call"
          onPress={handleEndCall}
          style={styles.endButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  webview: { flex: 1 },
  loadingText: { color: '#fff', fontSize: 16, marginTop: spacing.md },
  errorText: { fontSize: 16, marginBottom: spacing.md, textAlign: 'center', padding: spacing.md },
  controlsOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#EF4444',
    borderRadius: 30,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
});
