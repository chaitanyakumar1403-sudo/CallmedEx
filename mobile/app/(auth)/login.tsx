import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function LoginScreen() {
  const router = useRouter();
  const { loginEmail, sendPhoneOTP, biometricAvailable, biometricType, loginWithBiometrics } = useAuth();
  const { themeColors, isDark } = useTheme();

  const [authMode, setAuthMode] = useState<'otp' | 'email'>('otp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOTP = async () => {
    if (!phone || phone.trim().length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await sendPhoneOTP(phone.trim());
      router.push({
        pathname: '/(auth)/otp-verify',
        params: { phone: res.phone, devOtp: res.dev_otp || '' },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginEmail(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const success = await loginWithBiometrics();
      if (!success) {
        Alert.alert('Biometric Login', 'Biometric authentication was not recognized or has not been enabled on this device yet.');
      }
    } catch (err: any) {
      setError(err.message || 'Biometric authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#0A2540' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>+</Text>
          </View>
          <Text style={styles.title}>CallMedex</Text>
          <Text style={styles.subtitle}>UNIFIED HEALTHCARE PLATFORM</Text>
        </View>

        {/* Login Card */}
        <Card style={styles.card}>
          {/* Mode Switcher Tabs */}
          <View style={[styles.tabContainer, { backgroundColor: isDark ? '#1C293E' : '#F1F5F9' }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setAuthMode('otp');
                setError(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: authMode === 'otp' }}
              accessibilityLabel="Phone OTP Login"
              style={[
                styles.tabButton,
                authMode === 'otp' && { backgroundColor: themeColors.primary.DEFAULT },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: authMode === 'otp' ? '#FFFFFF' : themeColors.textSecondary },
                ]}
              >
                Phone OTP
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setAuthMode('email');
                setError(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: authMode === 'email' }}
              accessibilityLabel="Email and Password Login"
              style={[
                styles.tabButton,
                authMode === 'email' && { backgroundColor: themeColors.primary.DEFAULT },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: authMode === 'email' ? '#FFFFFF' : themeColors.textSecondary },
                ]}
              >
                Email & Password
              </Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: themeColors.danger.light }]}>
              <Text style={[styles.errorText, { color: themeColors.danger.text }]}>{error}</Text>
            </View>
          ) : null}

          {authMode === 'otp' ? (
            <View style={styles.formSection}>
              <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
                Instant Patient & Doctor Login
              </Text>
              <Text style={[styles.sectionSubtext, { color: themeColors.textSecondary }]}>
                Enter your 10-digit Indian phone number to receive a secure MSG91 OTP.
              </Text>

              <Input
                label="Mobile Number"
                placeholder="98765 43210"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                leftIcon={<Text style={{ color: themeColors.textSecondary, fontWeight: '700' }}>+91</Text>}
              />

              <Button
                title="Send Verification Code"
                onPress={handleSendOTP}
                variant="accent"
                size="lg"
                loading={loading}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <View style={styles.formSection}>
              <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
                Clinical & Staff Sign In
              </Text>
              <Text style={[styles.sectionSubtext, { color: themeColors.textSecondary }]}>
                Sign in with your registered CallMedex healthcare credentials.
              </Text>

              <Input
                label="Email Address"
                placeholder="doctor@callmedex.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Input
                label="Password"
                placeholder="••••••••••••"
                isPassword
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                onPress={() => router.push('/(auth)/forgot-password')}
                style={{ alignSelf: 'flex-end', marginBottom: 16 }}
              >
                <Text style={{ fontSize: 13, color: themeColors.primary.DEFAULT, fontWeight: '600' }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <Button
                title="Sign In"
                onPress={handleEmailLogin}
                variant="primary"
                size="lg"
                loading={loading}
                style={styles.actionButton}
              />
            </View>
          )}

          {/* Biometric Quick Login */}
          {biometricAvailable ? (
            <View style={styles.biometricSection}>
              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
              <Button
                title={`Log in with ${biometricType}`}
                onPress={handleBiometricLogin}
                variant="outline"
                size="md"
                style={styles.biometricButton}
              />
            </View>
          ) : null}

          {/* Register Callout */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
              New healthcare provider or patient?
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              accessibilityRole="button"
              accessibilityLabel="Create an Account"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.registerLink, { color: themeColors.accent.dark }]}>
                Create an Account
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.screenPaddingHorizontal,
    paddingVertical: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00D4B2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    color: '#0A2540',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
  },
  title: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.heavy,
  },
  subtitle: {
    color: '#00D4B2',
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 2,
    marginTop: 4,
  },
  card: {
    padding: spacing.xl,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: spacing.buttonRadius,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: spacing.buttonRadius - 2,
  },
  tabText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  formSection: {
    marginTop: spacing.xs,
  },
  sectionHeading: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: typography.fontSize.caption,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  actionButton: {
    marginTop: spacing.md,
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
  biometricSection: {
    marginTop: spacing.lg,
  },
  divider: {
    height: 1,
    marginBottom: spacing.lg,
  },
  biometricButton: {
    width: '100%',
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSize.caption,
    marginBottom: 4,
  },
  registerLink: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
});
