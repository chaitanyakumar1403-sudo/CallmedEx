import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card } from './Card';
import { Button } from './Button';
import { Pill } from './Pill';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatINR } from './PackageCard';

export interface DoctorData {
  doctor_id?: string;
  id?: string;
  name: string;
  specialization: string;
  qualification?: string;
  experience_years?: number;
  consultation_fee: number;
  languages?: string[];
  city?: string;
  available?: boolean;
  rating?: number;
  consultation_mode?: string;
}

interface DoctorCardProps {
  doctor: DoctorData;
  onBook: (doctor: DoctorData) => void;
  style?: ViewStyle;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({
  doctor,
  onBook,
  style,
}) => {
  const { themeColors } = useTheme();

  return (
    <Card style={[styles.card, { borderColor: themeColors.border }, style]}>
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: themeColors.primary.light }]}>
          <Text style={styles.avatarText}>
            {doctor.name ? doctor.name.replace('Dr.', '').trim().charAt(0) : 'D'}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: themeColors.textPrimary }]}>
              {doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`}
            </Text>
            {doctor.rating ? (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>⭐ {doctor.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.specialization, { color: themeColors.accent.dark }]}>
            {doctor.specialization}
          </Text>
          <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
            {[doctor.qualification, doctor.experience_years ? `${doctor.experience_years} yrs exp` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      {/* Badges / Languages / Modes */}
      <View style={styles.badgeRow}>
        {doctor.available !== false ? (
          <Pill label="Available Today" variant="done" />
        ) : (
          <Pill label="Next Available Tomorrow" variant="waiting" />
        )}
        {doctor.languages && doctor.languages.length > 0 && (
          <Pill
            label={`🗣️ ${doctor.languages.slice(0, 2).join(', ')}`}
            variant="neutral"
            style={{ marginLeft: 6 }}
          />
        )}
        {doctor.city && (
          <Pill label={`📍 ${doctor.city}`} variant="neutral" style={{ marginLeft: 6 }} />
        )}
      </View>

      {/* Footer */}
      <View style={styles.footerRow}>
        <View>
          <Text style={[styles.feeLabel, { color: themeColors.textMuted }]}>Consultation Fee</Text>
          <Text style={[styles.feeText, { color: themeColors.textPrimary }]}>
            {formatINR(doctor.consultation_fee)}
          </Text>
        </View>

        <Button
          title="Book Consult"
          size="sm"
          variant="primary"
          onPress={() => onBook(doctor)}
          style={styles.bookButton}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.cardPadding,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.bold,
  },
  ratingBadge: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  specialization: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
    marginTop: 1,
  },
  metaText: {
    fontSize: typography.fontSize.tiny,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  feeLabel: {
    fontSize: typography.fontSize.tiny,
  },
  feeText: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: typography.fontWeight.heavy,
  },
  bookButton: {
    minWidth: 110,
  },
});
