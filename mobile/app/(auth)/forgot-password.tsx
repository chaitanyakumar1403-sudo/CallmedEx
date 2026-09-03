import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { api } from '../../src/services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleResetRequest = async () => {
    if (!emailOrPhone.trim()) {
      Alert.alert('Validation Error', 'Please enter your registered email address or phone number.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', {
        identity: emailOrPhone.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      // Regardless of whether account exists, show submitted state for security or show error
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandLogo}>🏥 CallMedex</Text>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            Reset Your Password
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Enter your verified email or mobile number to receive secure reset instructions.
          </Text>
        </View>

        {!submitted ? (
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>
                Registered Email or Mobile Phone
              </Text>
              <TextInput
                placeholder="patient@callmedex.in or 9876543210"
                placeholderTextColor={themeColors.textMuted}
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
              />
            </View>

            <Button
              title={loading ? 'Sending Instructions...' : 'Send Password Reset Link'}
              onPress={handleResetRequest}
              loading={loading}
              variant="primary"
              size="lg"
              style={styles.submitBtn}
            />

            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: themeColors.primary.DEFAULT }]}>
                ← Back to Login
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.successCard, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>📩</Text>
            <Text style={styles.successTitle}>Reset Instructions Sent</Text>
            <Text style={styles.successMessage}>
              If an account is associated with &quot;{emailOrPhone}&quot;, password reset instructions have been dispatched.
            </Text>

            <Button
              title="Return to Login"
              onPress={() => router.replace('/(auth)/login')}
              variant="primary"
              size="md"
              style={{ marginTop: 16 }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPaddingHorizontal,
    justifyContent: 'center',
    minHeight: '100%',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandLogo: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00D4B2',
    marginBottom: 8,
  },
  title: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.fontSize.caption,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 18,
  },
  card: {
    padding: spacing.xl,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: spacing.buttonRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.fontSize.body,
  },
  submitBtn: {
    marginBottom: spacing.md,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
  },
  successCard: {
    padding: spacing.xl,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: '800',
    color: '#15803d',
    marginBottom: 6,
  },
  successMessage: {
    fontSize: typography.fontSize.caption,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 18,
  },
});
