import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Input } from '../../src/components/ui/Input';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { locationService, EmergencyContact } from '../../src/services/location';

export default function ProfileScreen() {
  const { user, logout, biometricAvailable, biometricType, isBiometricEnabled, enableBiometrics } = useAuth();
  const { themeColors, isDark, toggleTheme } = useTheme();

  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: '1', name: 'Sanjay Kumar (Brother)', phone: '+919876543210', relationship: 'Brother', is_active: true },
    { id: '2', name: 'Sunita Sharma (Spouse)', phone: '+919812345678', relationship: 'Spouse', is_active: true },
  ]);

  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRel, setContactRel] = useState('Family');

  const handleBiometricToggle = async () => {
    if (!isBiometricEnabled) {
      const success = await enableBiometrics();
      if (success) {
        Alert.alert('Biometrics Enabled', `${biometricType} is now configured for one-touch secure login.`);
      }
    }
  };

  const handleAddContact = async () => {
    if (!contactName || !contactPhone) {
      Alert.alert('Missing Details', 'Please provide a name and mobile number for the emergency contact.');
      return;
    }

    const newContact: EmergencyContact = {
      id: `c_${Date.now()}`,
      name: `${contactName} (${contactRel})`,
      phone: contactPhone,
      relationship: contactRel,
      is_active: true,
    };

    setContacts((prev) => [...prev, newContact]);
    setContactModalVisible(false);
    setContactName('');
    setContactPhone('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Contact Saved', `${contactName} will receive instant SMS and live GPS alerts during emergencies.`);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your CallMedex account on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header title="My Profile" subtitle="Account, ABHA Card & Security" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Profile Card */}
        <Card elevated style={styles.userCard}>
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: themeColors.primary.DEFAULT }]}>
              <Text style={styles.avatarText}>
                {user?.full_name?.charAt(0).toUpperCase() || 'P'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.userName, { color: themeColors.textPrimary }]}>
                {user?.full_name || 'Rahul Sharma'}
              </Text>
              <Text style={[styles.userContact, { color: themeColors.textSecondary }]}>
                {user?.mobile || '+91 98765 43210'}
              </Text>
              <View style={{ marginTop: 6, flexDirection: 'row', gap: 6 }}>
                <Badge label="VERIFIED PATIENT" variant="success" />
                <Badge label="NMC / ABDM LINKED" variant="info" />
              </View>
            </View>
          </View>
        </Card>

        {/* National Health Authority — ABHA Health Card */}
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          ABHA Digital Health Card
        </Text>
        <Card style={[styles.abhaCard, { backgroundColor: '#0F2744', borderColor: '#38BDF8' }]}>
          <View style={styles.abhaHeader}>
            <Text style={styles.abhaEmblem}>🇮🇳 National Health Authority</Text>
            <Text style={styles.abhaTag}>ABDM COMPLIANT</Text>
          </View>
          <Text style={styles.abhaName}>{user?.full_name || 'Rahul Sharma'}</Text>
          <Text style={styles.abhaNumber}>ABHA Number: 91-4820-1928-3920</Text>
          <Text style={styles.abhaAddress}>ABHA Address: rahul.sharma@abdm</Text>
          <View style={styles.abhaFooter}>
            <Text style={styles.abhaQrText}>QR Health Locker • Connected</Text>
            <Badge label="ACTIVE" variant="success" />
          </View>
        </Card>

        {/* Security & Preferences */}
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          Security & Hardware Preferences
        </Text>
        <Card style={styles.settingsCard}>
          {biometricAvailable ? (
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                  {biometricType} Quick Login
                </Text>
                <Text style={[styles.settingSub, { color: themeColors.textSecondary }]}>
                  Use device biometrics for instant healthcare record access
                </Text>
              </View>
              <Switch
                value={isBiometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: '#CBD5E1', true: themeColors.accent.DEFAULT }}
              />
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                Dark Clinical Theme
              </Text>
              <Text style={[styles.settingSub, { color: themeColors.textSecondary }]}>
                Toggle high-contrast dark mode for low-light clinical environments
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#CBD5E1', true: themeColors.accent.DEFAULT }}
            />
          </View>
        </Card>

        {/* Emergency Contacts */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Emergency SOS Contacts
          </Text>
          <TouchableOpacity onPress={() => setContactModalVisible(true)}>
            <Text style={[styles.addText, { color: themeColors.accent.dark }]}>+ Add Contact</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.settingsCard}>
          {contacts.map((c) => (
            <View key={c.id} style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: themeColors.textPrimary }]}>{c.name}</Text>
                <Text style={[styles.contactPhone, { color: themeColors.textSecondary }]}>{c.phone}</Text>
              </View>
              <Badge label="SMS ALERT ON" variant="success" />
            </View>
          ))}
        </Card>

        {/* Sign Out Button */}
        <Button
          title="Sign Out of CallMedex"
          onPress={handleLogout}
          variant="danger"
          size="lg"
          style={styles.logoutButton}
        />

        <Text style={styles.versionText}>CallMedex Native v1.0.0 • Production Build</Text>
      </ScrollView>

      {/* Add Emergency Contact Modal */}
      {contactModalVisible && (
        <Modal visible={contactModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { backgroundColor: themeColors.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                  Add Emergency Contact
                </Text>
                <TouchableOpacity
                  onPress={() => setContactModalVisible(false)}
                  style={{ padding: 6, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel="Close Modal"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ fontSize: 18, color: themeColors.textSecondary }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: spacing.md }}>
                <Input
                  label="Contact Name"
                  placeholder="e.g. Ramesh Sharma"
                  value={contactName}
                  onChangeText={setContactName}
                />
                <Input
                  label="Mobile Phone (+91)"
                  placeholder="e.g. 9876543210"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                />
                <Input
                  label="Relationship"
                  placeholder="e.g. Spouse, Father, Sibling"
                  value={contactRel}
                  onChangeText={setContactRel}
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Save Emergency Contact"
                  onPress={handleAddContact}
                  variant="primary"
                  size="md"
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: 100,
  },
  userCard: {
    marginTop: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#00D4B2',
    fontSize: 26,
    fontWeight: '800',
  },
  userName: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  userContact: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  addText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  abhaCard: {
    padding: spacing.md,
    borderRadius: spacing.cardRadius,
    borderWidth: 1.5,
  },
  abhaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  abhaEmblem: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
  },
  abhaTag: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  abhaName: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  abhaNumber: {
    color: '#38BDF8',
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  abhaAddress: {
    color: '#94A3B8',
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  abhaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  abhaQrText: {
    color: '#00D4B2',
    fontSize: 10,
    fontWeight: '700',
  },
  settingsCard: {
    padding: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  settingLabel: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  settingSub: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  contactName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  contactPhone: {
    fontSize: typography.fontSize.caption,
    marginTop: 1,
  },
  logoutButton: {
    marginTop: spacing.xl,
  },
  versionText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: typography.fontSize.tiny,
    marginTop: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: spacing.cardRadius,
    borderTopRightRadius: spacing.cardRadius,
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  modalActions: {
    marginTop: spacing.md,
  },
});
