import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { familyService } from '../../src/services/familyApi';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import type { Gender } from '../../src/types/api';

const RELATIONSHIPS = ['Spouse', 'Child', 'Father', 'Mother', 'Sibling', 'Senior Citizen'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];

export default function AddFamilyMemberScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState(GENDERS[0]);
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [bloodGroup, setBloodGroup] = useState(BLOOD_GROUPS[0]);
  const [abhaId, setAbhaId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    const parsedAge = parseInt(age.trim(), 10);

    if (!trimmedName) {
      Alert.alert('Validation Error', 'Please enter the family member\'s full legal name.');
      return;
    }

    if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 125) {
      Alert.alert('Validation Error', 'Please enter a valid age between 1 and 125.');
      return;
    }

    const birthYear = new Date().getFullYear() - parsedAge;
    const dateOfBirth = `${birthYear}-01-01`;

    setIsSaving(true);
    try {
      await familyService.addFamilyMember({
        name: trimmedName,
        relationship,
        gender: gender.toLowerCase() as Gender,
        date_of_birth: dateOfBirth,
        phone: phone.trim() || undefined,
        blood_group: bloodGroup,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Family Member Added! 👨‍👩‍👧',
        `${trimmedName} (${relationship}) has been linked to your health account.`
      );
      router.back();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Failed to Add', error.message || 'Could not save family member. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Add Family Member"
        subtitle="Link Dependents & Senior Citizens"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Input
            label="Full Legal Name *"
            placeholder="e.g. Meera Sharma"
            value={fullName}
            onChangeText={setFullName}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="Age (Years) *"
                placeholder="e.g. 32"
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="ABHA ID (Optional)"
                placeholder="91-XXXX-XXXX-XXXX"
                value={abhaId}
                onChangeText={setAbhaId}
              />
            </View>
          </View>

          {/* Relationship */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 4 }]}>
            Relationship with Primary Account Holder:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {RELATIONSHIPS.map((rel) => {
              const isSelected = relationship === rel;
              return (
                <TouchableOpacity
                  key={rel}
                  onPress={() => setRelationship(rel)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                      borderColor: isSelected ? themeColors.primary.DEFAULT : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                    {rel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Gender */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
            Gender:
          </Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => {
              const isSelected = gender === g;
              return (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGender(g)}
                  style={[
                    styles.genderBtn,
                    {
                      backgroundColor: isSelected ? themeColors.accent.DEFAULT : themeColors.inputBackground,
                      borderColor: isSelected ? themeColors.accent.dark : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.genderBtnText, { color: isSelected ? '#0A2540' : themeColors.textPrimary }]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Blood Group */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
            Blood Group:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {BLOOD_GROUPS.map((bg) => {
              const isSelected = bloodGroup === bg;
              return (
                <TouchableOpacity
                  key={bg}
                  onPress={() => setBloodGroup(bg)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? themeColors.primary.DEFAULT : themeColors.inputBackground,
                      borderColor: isSelected ? themeColors.primary.DEFAULT : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                    {bg}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Button
            title="💾 Save Family Member"
            onPress={handleSave}
            variant="primary"
            size="lg"
            loading={isSaving}
            disabled={isSaving}
            style={{ marginTop: spacing.lg }}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.screenPaddingHorizontal, paddingBottom: 100 },
  card: { marginTop: spacing.md, padding: spacing.md },
  row: { flexDirection: 'row' },
  fieldLabel: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  chipRow: { marginVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: spacing.buttonRadius, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold },
  genderRow: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  genderBtn: { flex: 1, paddingVertical: 8, borderRadius: spacing.buttonRadius, alignItems: 'center', borderWidth: 1 },
  genderBtnText: { fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold },
});
