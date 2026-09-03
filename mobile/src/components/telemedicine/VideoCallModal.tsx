import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

interface VideoCallModalProps {
  visible: boolean;
  onClose: () => void;
  roomName: string;
  doctorName?: string;
  patientName?: string;
  isDoctor?: boolean;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  visible,
  onClose,
  roomName,
  doctorName = 'Dr. Ramesh Sharma',
  patientName = 'Patient',
  isDoctor = false,
}) => {
  const { themeColors } = useTheme();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [duration, setDuration] = useState(0);
  const [showPrescriptionSheet, setShowPrescriptionSheet] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDuration(0);
      return;
    }
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsVideoOff(!isVideoOff);
  };

  const handleFlipCamera = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFrontCamera(!isFrontCamera);
  };

  const handleEndCall = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('End Consultation', 'Are you sure you want to end this clinical video session?', [
      { text: 'Resume', style: 'cancel' },
      {
        text: 'End Call',
        style: 'destructive',
        onPress: () => {
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.peerName}>{isDoctor ? patientName : doctorName}</Text>
            <Text style={styles.timerText}>🟢 Live: {formatTimer(duration)}</Text>
          </View>
          <Badge label="🔒 256-BIT ENCRYPTED" variant="success" />
        </View>

        {/* Main Video View (Remote Participant) */}
        <View style={styles.mainFeed}>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderIcon}>{isDoctor ? '👤' : '🩺'}</Text>
            <Text style={styles.feedStatusText}>
              HD Telemedicine Stream Active
            </Text>
            <Text style={styles.roomTag}>Room: {roomName}</Text>
          </View>

          {/* Picture-in-Picture Local User Feed */}
          <View style={[styles.pipWindow, { backgroundColor: themeColors.cardElevated }]}>
            <Text style={styles.pipText}>
              {isVideoOff ? '📷 Camera Off' : isFrontCamera ? 'Front Cam' : 'Back Cam'}
            </Text>
          </View>
        </View>

        {/* Doctor-Specific e-Prescription Floating Drawer */}
        {isDoctor ? (
          <View style={styles.doctorPrescriptionBar}>
            <Button
              title="📝 Digital e-Prescription (NMC Format)"
              onPress={() => Alert.alert('Prescription', 'Author digital e-prescription with salt composition and dosage.')}
              variant="outline"
              size="sm"
            />
          </View>
        ) : null}

        {/* Bottom Call Controls */}
        <View style={styles.controlsBar}>
          {/* Mute Button */}
          <TouchableOpacity
            onPress={handleToggleMute}
            style={[styles.controlBtn, isMuted && { backgroundColor: '#E63946' }]}
          >
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Video Toggle */}
          <TouchableOpacity
            onPress={handleToggleVideo}
            style={[styles.controlBtn, isVideoOff && { backgroundColor: '#E63946' }]}
          >
            <Text style={styles.controlIcon}>{isVideoOff ? '🚫' : '📹'}</Text>
            <Text style={styles.controlLabel}>{isVideoOff ? 'Start Video' : 'Stop Video'}</Text>
          </TouchableOpacity>

          {/* Flip Camera */}
          <TouchableOpacity onPress={handleFlipCamera} style={styles.controlBtn}>
            <Text style={styles.controlIcon}>🔄</Text>
            <Text style={styles.controlLabel}>Flip</Text>
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity onPress={handleEndCall} style={[styles.controlBtn, styles.endCallBtn]}>
            <Text style={styles.controlIcon}>📞</Text>
            <Text style={styles.controlLabel}>End</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#061626',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingVertical: spacing.md,
  },
  peerName: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  timerText: {
    color: '#00D4B2',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 2,
  },
  mainFeed: {
    flex: 1,
    marginHorizontal: spacing.screenPaddingHorizontal,
    borderRadius: spacing.cardRadius,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    position: 'relative',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  feedStatusText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  roomTag: {
    color: '#64748B',
    fontSize: typography.fontSize.tiny,
    marginTop: 4,
  },
  pipWindow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: spacing.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00D4B2',
    ...shadows.lg,
  },
  pipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  doctorPrescriptionBar: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.sm,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E2E4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIcon: {
    fontSize: 22,
  },
  controlLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  endCallBtn: {
    backgroundColor: '#E63946',
    ...shadows.sosGlow,
  },
});
