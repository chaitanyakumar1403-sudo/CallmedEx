// mobile/src/components/widgets/kit/VerifyChecklist.tsx
// 5-Point intake verification checklist with check/flag toggles for lab staff.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §6.8 & §5.3

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Glass } from '../../glass/Glass';

export interface VerificationItem {
  id: string;
  point: string;
  passed: boolean;
  notes?: string;
}

export interface VerifyChecklistProps {
  items: VerificationItem[];
  onToggleItem: (id: string, passed: boolean) => void;
  readOnly?: boolean;
}

export const VerifyChecklist: React.FC<VerifyChecklistProps> = ({
  items,
  onToggleItem,
  readOnly = false,
}) => {
  const allPassed = items.every((i) => i.passed);

  return (
    // G4 Clinical Opaque Card (§3.2 mandate for verification decisions)
    <Glass tier="G4" style={styles.container} specular={false}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShieldCheck size={16} color="#34d399" />
          <Text style={styles.title}>5-POINT INTAKE VERIFICATION</Text>
        </View>
        <View style={[styles.badge, allPassed ? styles.badgeSuccess : styles.badgeWarn]}>
          <Text style={[styles.badgeText, allPassed ? styles.badgeSuccessText : styles.badgeWarnText]}>
            {allPassed ? 'ALL VERIFIED' : 'ACTION REQUIRED'}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            disabled={readOnly}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onToggleItem(item.id, !item.passed);
            }}
            style={styles.itemRow}
          >
            <View style={styles.pointInfo}>
              <Text style={styles.pointTitle}>{item.point}</Text>
              {item.notes && <Text style={styles.notesText}>{item.notes}</Text>}
            </View>

            <View style={styles.statusCol}>
              {item.passed ? (
                <CheckCircle2 size={20} color="#34d399" />
              ) : (
                <XCircle size={20} color="#ef4444" />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Glass>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  badgeWarn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeSuccessText: {
    color: '#34d399',
  },
  badgeWarnText: {
    color: '#f87171',
  },
  list: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pointInfo: {
    flex: 1,
    paddingRight: 10,
  },
  pointTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '500',
  },
  notesText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  statusCol: {
    paddingLeft: 6,
  },
});
