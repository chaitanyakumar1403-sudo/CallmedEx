import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Header } from '../../src/components/ui/Header';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { authService } from '../../src/services/auth';

const ROLES = [
  { id: 'patient', label: 'Patient', icon: '👤' },
  { id: 'doctor', label: 'Doctor', icon: '🩺' },
  { id: 'phlebotomist', label: 'Phlebotomist', icon: '🧪' },
  { id: 'nurse', label: 'Nurse', icon: '👩‍⚕️' },
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { id: 'organization', label: 'Hospital / Clinic', icon: '🏥' },
  { id: 'staff', label: 'Front Desk', icon: '📋' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { loginEmail } = useAuth();
  const { themeColors } = useTheme();

  const [role, setRole] = useState('patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setError('Please fill in all mandatory fields');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authService.register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role,
        mobile: mobile.trim() ? `+91${mobile.replace(/\D/g, '')}` : undefined,
        license_number: licenseNumber.trim() || undefined,
        specialization: specialization.trim() || undefined,
        organization_name: orgName.trim() || undefined,
      });

      // Sign in automatically
      await loginEmail(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please review your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="Create Account" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Text style={[styles.heading, { color: themeColors.textPrimary }]}>Select Healthcare Role</Text>
            
            {/* Role Selector Grid */}
            <View style={styles.roleGrid}>
              {ROLES.map((r) => {
                const isSelected = role === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    activeOpacity={0.8}
                    onPress={() => setRole(r.id)}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: isSelected ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                        borderColor: isSelected ? themeColors.accent.DEFAULT : themeColors.border,
                      },
                    ]}
                  >
                    <Text style={styles.roleIcon}>{r.icon}</Text>
                    <Text
                      style={[
                        styles.roleLabel,
                        { color: isSelected ? '#FFFFFF' : themeColors.textPrimary },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: themeColors.danger.light }]}>
                <Text style={[styles.errorText, { color: themeColors.danger.text }]}>{error}</Text>
              </View>
            ) : null}

            {/* Core Fields */}
            <Input
              label="Full Name *"
              placeholder="e.g. Dr. Rajesh Verma"
              value={fullName}
              onChangeText={setFullName}
            />

            <Input
              label="Email Address *"
              placeholder="user@callmedex.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Input
              label="Mobile Number (Optional for SMS alerts)"
              placeholder="98765 43210"
              keyboardType="phone-pad"
              maxLength={10}
              value={mobile}
              onChangeText={setMobile}
              leftIcon={<Text style={{ color: themeColors.textSecondary, fontWeight: '700' }}>+91</Text>}
            />

            <Input
              label="Password *"
              placeholder="Minimum 8 characters"
              isPassword
              value={password}
              onChangeText={setPassword}
            />

            {/* Role Specific Dynamic Fields */}
            {role === 'doctor' ? (
              <>
                <Input
                  label="Medical Registration / MCI Number *"
                  placeholder="MCI-123456"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                />
                <Input
                  label="Specialization *"
                  placeholder="e.g. Cardiologist, General Physician"
                  value={specialization}
                  onChangeText={setSpecialization}
                />
              </>
            ) : null}

            {role === 'phlebotomist' ? (
              <Input
                label="Phlebotomy Certification / Badge ID *"
                placeholder="PHLEB-7890"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
              />
            ) : null}

            {role === 'nurse' ? (
              <Input
                label="Nursing Council Registration Number *"
                placeholder="NC-56789"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
              />
            ) : null}

            {role === 'organization' || role === 'pharmacy' ? (
              <>
                <Input
                  label="Entity / Pharmacy Name *"
                  placeholder="Apollo Diagnostics / City Pharmacy"
                  value={orgName}
                  onChangeText={setOrgName}
                />
                <Input
                  label="Drug / Facility License Number *"
                  placeholder="DL-987654"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                />
              </>
            ) : null}

            <Button
              title="Create Account"
              onPress={handleRegister}
              variant="accent"
              size="lg"
              loading={loading}
              style={styles.submitButton}
            />
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
    paddingVertical: spacing.lg,
  },
  card: {
    padding: spacing.xl,
  },
  heading: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.lg,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: spacing.buttonRadius,
    borderWidth: 1,
  },
  roleIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  roleLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
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
  submitButton: {
    marginTop: spacing.md,
  },
});
