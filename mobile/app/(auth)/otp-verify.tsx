import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Header } from '../../src/components/ui/Header';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function OTPVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string; devOtp?: string }>();
  const phone = params.phone || '';
  const devOtp = params.devOtp || '';

  const { verifyPhoneOTP, sendPhoneOTP } = useAuth();
  const { themeColors } = useTheme();

  const [otp, setOtp] = useState(devOtp || '');
  const [fullName, setFullName] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length < 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifyPhoneOTP(phone, otp, fullName.trim() || undefined);
      // Navigation will be automatically handled by AuthContext listener in _layout.tsx
    } catch (err: any) {
      setError(err.message || 'Verification failed. Incorrect or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError(null);
    try {
      const res = await sendPhoneOTP(phone);
      if (res.dev_otp) setOtp(res.dev_otp);
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Verify Mobile" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <View style={styles.badgeContainer}>
              <View style={[styles.iconCircle, { backgroundColor: themeColors.accent.subtle }]}>
                <Text style={[styles.phoneIcon, { color: themeColors.accent.dark }]}>📱</Text>
              </View>
            </View>

            <Text style={[styles.title, { color: themeColors.textPrimary }]}>Enter Verification Code</Text>
            <Text style={[styles.subtext, { color: themeColors.textSecondary }]}>
              We sent a 6-digit verification code via SMS to{' '}
              <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>{phone}</Text>
            </Text>

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: themeColors.danger.light }]}>
                <Text style={[styles.errorText, { color: themeColors.danger.text }]}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="6-Digit OTP"
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              style={styles.otpInput}
            />

            <Input
              label="Your Full Name (Optional if already registered)"
              placeholder="e.g. Ananya Sharma"
              value={fullName}
              onChangeText={setFullName}
            />

            <Button
              title="Verify & Continue"
              onPress={handleVerify}
              variant="accent"
              size="lg"
              loading={loading}
              style={styles.verifyButton}
            />

            <View style={styles.resendContainer}>
              <Text style={[styles.resendText, { color: themeColors.textSecondary }]}>
                Didn't receive the SMS?
              </Text>
              <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
                <Text
                  style={[
                    styles.resendLink,
                    { color: countdown > 0 ? themeColors.textMuted : themeColors.accent.dark },
                  ]}
                >
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPaddingHorizontal,
    paddingVertical: spacing.xl,
  },
  card: {
    padding: spacing.xl,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtext: {
    fontSize: typography.fontSize.caption,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  otpInput: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: spacing.buttonRadius,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
  },
  verifyButton: {
    marginTop: spacing.md,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    fontSize: typography.fontSize.caption,
    marginBottom: 4,
  },
  resendLink: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
});
