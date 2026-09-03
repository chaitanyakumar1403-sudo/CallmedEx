// mobile/src/components/omnibar/Omnibar.tsx
// Morphing Omnibar (pill -> strip -> sheet) with voice, search, and context actions.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §4.2

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Search,
  Mic,
  QrCode,
  AlertTriangle,
  X,
  Compass,
  ArrowRight,
  Shield,
  Activity,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Glass } from '../glass/Glass';
import { useGlass } from '../../theme/GlassProvider';

export interface OmnibarProps {
  activeTripTitle?: string;
  activeTripSubtitle?: string;
  onPressAction?: () => void;
  onBarcodeScan?: () => void;
  onVoiceSearch?: () => void;
}

export const Omnibar: React.FC<OmnibarProps> = ({
  activeTripTitle,
  activeTripSubtitle,
  onPressAction,
  onBarcodeScan,
  onVoiceSearch,
}) => {
  const { roleAccent, activeRole } = useGlass();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const openSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsSheetOpen(true);
  };

  const closeSheet = () => {
    Haptics.selectionAsync().catch(() => {});
    setIsSheetOpen(false);
  };

  const hasActiveTrip = Boolean(activeTripTitle);

  return (
    <>
      {/* Resting Pill / Strip */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={openSheet}
        style={styles.touchable}
      >
        <Glass
          tier="G2"
          style={[
            styles.barGlass,
            { borderColor: hasActiveTrip ? roleAccent.primary : 'rgba(255,255,255,0.18)' },
          ]}
          specular
          accentGlow={hasActiveTrip}
        >
          <View style={styles.contentRow}>
            {hasActiveTrip ? (
              // Active Strip Mode
              <View style={styles.stripLeft}>
                <View style={[styles.pulseDot, { backgroundColor: roleAccent.primary }]} />
                <View style={styles.stripTextCol}>
                  <Text style={styles.stripTitle} numberOfLines={1}>
                    {activeTripTitle}
                  </Text>
                  <Text style={styles.stripSubtitle} numberOfLines={1}>
                    {activeTripSubtitle || 'Tap to view live details'}
                  </Text>
                </View>
              </View>
            ) : (
              // Resting Search Pill Mode
              <View style={styles.pillLeft}>
                <Search size={18} color="#94a3b8" />
                <Text style={styles.placeholderText} numberOfLines={1}>
                  Ask CallMedex or search services...
                </Text>
              </View>
            )}

            <View style={styles.actionsRight}>
              {onBarcodeScan && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.selectionAsync().catch(() => {});
                    onBarcodeScan();
                  }}
                  style={styles.iconBtn}
                >
                  <QrCode size={18} color="#cbd5e1" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  if (onVoiceSearch) onVoiceSearch();
                  else openSheet();
                }}
                style={[styles.micBtn, { backgroundColor: `${roleAccent.primary}33` }]}
              >
                <Mic size={16} color={roleAccent.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </Glass>
      </TouchableOpacity>

      {/* Expanded Command Sheet (G3 Glass Modal) */}
      <Modal
        visible={isSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={closeSheet}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeSheet}
          />
          <View style={styles.sheetContainer}>
            <Glass tier="G3" style={styles.sheetGlass} specular>
              {/* Sheet Drag Indicator */}
              <View style={styles.dragPill} />

              {/* Header with Search Input */}
              <View style={styles.searchHeader}>
                <View style={styles.inputWrapper}>
                  <Search size={18} color="#94a3b8" style={styles.inputSearchIcon} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search medicines, blood tests, clinics..."
                    placeholderTextColor="#64748b"
                    style={styles.textInput}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
                  <Text style={styles.closeText}>Done</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Quick Action Badges */}
                <Text style={styles.sectionHeading}>QUICK ACTIONS</Text>
                <View style={styles.chipsGrid}>
                  <TouchableOpacity
                    style={styles.actionChip}
                    onPress={() => {
                      closeSheet();
                      if (onBarcodeScan) onBarcodeScan();
                    }}
                  >
                    <QrCode size={16} color="#38bdf8" />
                    <Text style={styles.chipText}>Scan Barcode</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionChip}
                    onPress={() => {
                      closeSheet();
                      if (onPressAction) onPressAction();
                    }}
                  >
                    <Activity size={16} color="#34d399" />
                    <Text style={styles.chipText}>My Vitals</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionChip, { borderColor: 'rgba(239,68,68,0.3)' }]}
                    onPress={() => {
                      closeSheet();
                    }}
                  >
                    <AlertTriangle size={16} color="#f87171" />
                    <Text style={[styles.chipText, { color: '#fca5a5' }]}>Emergency SOS</Text>
                  </TouchableOpacity>
                </View>

                {/* Role Specific Shortcuts */}
                <Text style={[styles.sectionHeading, { marginTop: 18 }]}>
                  {activeRole.toUpperCase()} TOOLS
                </Text>
                <View style={styles.roleToolsList}>
                  <View style={styles.toolItem}>
                    <Shield size={18} color={roleAccent.primary} />
                    <View style={styles.toolInfo}>
                      <Text style={styles.toolTitle}>Trust Handshake / OTP</Text>
                      <Text style={styles.toolDesc}>Verify patient doorstep custody</Text>
                    </View>
                    <ArrowRight size={16} color="#64748b" />
                  </View>

                  <View style={styles.toolItem}>
                    <Compass size={18} color="#a78bfa" />
                    <View style={styles.toolInfo}>
                      <Text style={styles.toolTitle}>Real-Time Cold Chain</Text>
                      <Text style={styles.toolDesc}>Digital temperature logger monitor</Text>
                    </View>
                    <ArrowRight size={16} color="#64748b" />
                  </View>
                </View>
              </ScrollView>
            </Glass>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  barGlass: {
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  stripLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stripTextCol: {
    flex: 1,
  },
  stripTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  stripSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 12,
  },
  micBtn: {
    padding: 7,
    borderRadius: 12,
  },
  // Modal Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '80%',
  },
  sheetGlass: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  dragPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    height: 44,
  },
  inputSearchIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  closeText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetScroll: {
    maxHeight: 400,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  roleToolsList: {
    gap: 8,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toolInfo: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  toolDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
