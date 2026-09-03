import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export interface FamilyMemberItem {
  id: string;
  fullName: string;
  relationship: string;
  hasActiveAlert?: boolean;
  alertCount?: number;
  healthStatus?: string;
}

interface FamilySwiperWheelProps {
  members: FamilyMemberItem[];
  activeMemberId: string | null;
  onSelectMember: (id: string) => void;
  onAddMember?: () => void;
}

export const FamilySwiperWheel: React.FC<FamilySwiperWheelProps> = ({
  members = [],
  activeMemberId,
  onSelectMember,
  onAddMember,
}) => {
  const { themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerIcon}>👥</Text>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
            Family Caregiver Switcher
          </Text>
        </View>
        <Text style={[styles.countBadge, { color: themeColors.textSecondary }]}>
          {members.length} {members.length === 1 ? 'Member' : 'Members'}
        </Text>
      </View>

      {members.length === 0 ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAddMember}
          style={[styles.emptyContainer, { backgroundColor: themeColors.surface2 || '#f8fafc', borderColor: themeColors.border }]}
        >
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            + Add family members to switch and monitor profiles
          </Text>
        </TouchableOpacity>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          {members.map((member) => {
            const isActive = member.id === activeMemberId;
            return (
              <TouchableOpacity
                key={member.id}
                activeOpacity={0.8}
                onPress={() => onSelectMember(member.id)}
                style={[
                  styles.memberPill,
                  {
                    backgroundColor: isActive ? '#e0f2fe' : (themeColors.surface2 || '#f8fafc'),
                    borderColor: isActive ? '#0284c7' : themeColors.border,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: isActive ? '#0284c7' : '#cbd5e1' },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {member.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.memberName,
                      {
                        color: isActive ? '#0369a1' : themeColors.textPrimary,
                        fontWeight: isActive ? '800' : '600',
                      },
                    ]}
                  >
                    {member.fullName.split(' ')[0]}
                  </Text>
                  <Text style={[styles.memberRel, { color: themeColors.textSecondary }]}>
                    {member.relationship}
                  </Text>
                </View>
                {member.hasActiveAlert && (
                  <View style={styles.alertDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
  },
  countBadge: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyContainer: {
    padding: spacing.md,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.caption,
    textAlign: 'center',
  },
  scrollContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  memberName: {
    fontSize: typography.fontSize.caption,
  },
  memberRel: {
    fontSize: typography.fontSize.tiny,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d97706',
    marginLeft: 6,
  },
});
