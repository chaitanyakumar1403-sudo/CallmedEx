import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { HealthPackageData, formatINR } from '../ui/PackageCard';
import labTestsCatalog from '../../data/lab-test-prices.json';

export interface SelectedMobileAddon {
  name: string;
  originalPrice: number;
  discountedPrice: number;
  savings: number;
}

interface PackageAddonModalProps {
  packageData: HealthPackageData | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    pkg: HealthPackageData,
    planType: 'single' | 'couple',
    totalPrice: number,
    selectedAddons: SelectedMobileAddon[]
  ) => void;
}

const FEATURED_IMAGING = [
  { name: 'Ultrasound Scan (USG Abdomen & Pelvis)', mrp: 1600, price: 1200 },
  { name: 'ECG (12-Lead Electrocardiogram)', mrp: 400, price: 300 },
  { name: '2D Echo (Echocardiography with Doppler)', mrp: 2200, price: 1600 },
  { name: 'TMT (Treadmill Stress Test)', mrp: 2500, price: 1800 },
  { name: 'Doppler Ultrasound Study', mrp: 2600, price: 1900 },
  { name: 'Digital Chest X-Ray (PA View)', mrp: 600, price: 450 },
];

export const PackageAddonModal: React.FC<PackageAddonModalProps> = ({
  packageData,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { themeColors, isDark } = useTheme();
  const [planType, setPlanType] = useState<'single' | 'couple'>('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('recommended');
  const [selectedAddons, setSelectedAddons] = useState<SelectedMobileAddon[]>([]);

  // Reset state on open
  React.useEffect(() => {
    if (isOpen) {
      setPlanType('single');
      setSelectedAddons([]);
      setSearchQuery('');
      setActiveCategory('recommended');
    }
  }, [isOpen, packageData?.id]);

  // Combine featured imaging and full lab catalog
  const allTests = useMemo(() => {
    const list = [...FEATURED_IMAGING, ...(labTestsCatalog as any[])];
    const map = new Map<string, any>();
    for (const item of list) {
      if (!map.has(item.name)) {
        map.set(item.name, item);
      }
    }
    return Array.from(map.values());
  }, []);

  // Filter tests based on category and search query
  const filteredTests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = allTests;

    if (activeCategory === 'recommended') {
      list = [
        ...FEATURED_IMAGING,
        ...allTests.filter((t) => {
          const n = t.name.toLowerCase();
          return (
            n.includes('vitamin d') ||
            n.includes('vitamin b12') ||
            n.includes('hba1c') ||
            n.includes('thyroid') ||
            n.includes('calcium') ||
            n.includes('ferritin') ||
            n.includes('lipid')
          );
        }),
      ];
    } else if (activeCategory === 'imaging') {
      list = allTests.filter((t) => {
        const n = t.name.toLowerCase();
        return (
          n.includes('scan') ||
          n.includes('x-ray') ||
          n.includes('echo') ||
          n.includes('ecg') ||
          n.includes('tmt') ||
          n.includes('doppler')
        );
      });
    } else if (activeCategory === 'vitamins') {
      list = allTests.filter((t) => {
        const n = t.name.toLowerCase();
        return n.includes('vitamin') || n.includes('calcium') || n.includes('iron') || n.includes('ferritin');
      });
    } else if (activeCategory === 'diabetes') {
      list = allTests.filter((t) => {
        const n = t.name.toLowerCase();
        return n.includes('glucose') || n.includes('sugar') || n.includes('hba1c') || n.includes('insulin');
      });
    } else if (activeCategory === 'cardiac') {
      list = allTests.filter((t) => {
        const n = t.name.toLowerCase();
        return n.includes('cardiac') || n.includes('lipid') || n.includes('cholesterol') || n.includes('ecg') || n.includes('crp');
      });
    }

    if (q) {
      list = allTests.filter((t) => t.name.toLowerCase().includes(q));
    }

    return list.slice(0, 35);
  }, [allTests, activeCategory, searchQuery]);

  if (!isOpen || !packageData) return null;

  const singlePrice = packageData.single_price || packageData.price;
  const couplePrice = packageData.couple_price;
  const currentPkgPrice = planType === 'couple' && couplePrice ? couplePrice : singlePrice;

  const toggleAddon = (test: any) => {
    const isSelected = selectedAddons.some((a) => a.name === test.name);
    if (isSelected) {
      setSelectedAddons((prev) => prev.filter((a) => a.name !== test.name));
    } else {
      const basePrice = Number(test.price || test.mrp || 0);
      const discounted = Math.round(basePrice * 0.70); // Flat 30% discount
      const savings = basePrice - discounted;
      setSelectedAddons((prev) => [
        ...prev,
        {
          name: test.name,
          originalPrice: basePrice,
          discountedPrice: discounted,
          savings,
        },
      ]);
    }
  };

  const totalAddonsPrice = selectedAddons.reduce((sum, a) => sum + a.discountedPrice, 0);
  const totalAddonsSavings = selectedAddons.reduce((sum, a) => sum + a.savings, 0);
  const finalTotalPrice = currentPkgPrice + totalAddonsPrice;

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
          {/* Header Banner */}
          <View style={styles.headerBanner}>
            <View style={styles.badgeRow}>
              <View style={styles.promoPill}>
                <Text style={styles.promoPillText}>🎁 FLAT 30% OFF ON ANY ADD-ON TEST</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.headerTitle}>{packageData.name}</Text>
            <Text style={styles.headerSubtitle}>
              Select any test or scan below to bundle with your package at 30% discount!
            </Text>

            {/* Single vs Couple Selector */}
            <View style={styles.planSelectorRow}>
              <TouchableOpacity
                onPress={() => setPlanType('single')}
                style={[
                  styles.planOption,
                  planType === 'single' ? styles.planOptionActive : styles.planOptionInactive,
                ]}
              >
                <Text
                  style={[
                    styles.planOptionText,
                    planType === 'single' ? styles.planOptionTextActive : styles.planOptionTextInactive,
                  ]}
                >
                  👤 Single • {formatINR(singlePrice)}
                </Text>
              </TouchableOpacity>

              {couplePrice ? (
                <TouchableOpacity
                  onPress={() => setPlanType('couple')}
                  style={[
                    styles.planOption,
                    planType === 'couple' ? styles.planOptionActiveCouple : styles.planOptionInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.planOptionText,
                      planType === 'couple' ? styles.planOptionTextActive : styles.planOptionTextInactive,
                    ]}
                  >
                    👥 Couple • {formatINR(couplePrice)}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Search Box */}
          <View style={styles.searchWrap}>
            <View style={[styles.searchBox, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                placeholder="Search tests (Vitamin D, Ultrasound, HbA1c)..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: isDark ? '#f8fafc' : '#0f172a' }]}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={{ color: '#94a3b8', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {[
                { id: 'recommended', label: '⭐ Recommended' },
                { id: 'imaging', label: '📷 Scans & Imaging' },
                { id: 'vitamins', label: '🧪 Vitamins & Iron' },
                { id: 'diabetes', label: '🩸 Diabetes' },
                { id: 'cardiac', label: '❤️ Heart & Lipid' },
                { id: 'all', label: '🔬 All Tests' },
              ].map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setActiveCategory(cat.id)}
                  style={[
                    styles.categoryChip,
                    activeCategory === cat.id ? styles.categoryChipActive : styles.categoryChipInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      activeCategory === cat.id ? styles.categoryChipTextActive : styles.categoryChipTextInactive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Individual Test Cards List */}
          <ScrollView contentContainerStyle={styles.testsListContent}>
            {packageData.special_add_on && (
              <View style={styles.specialAddonBanner}>
                <Text style={styles.specialAddonTag}>⭐ DESIGNATED SCAN FOR THIS PACKAGE</Text>
                <Text style={styles.specialAddonName}>{packageData.special_add_on}</Text>
                <Text style={styles.specialAddonDesc}>
                  Clinically recommended to pair with {packageData.name} (30% discount applied)
                </Text>
              </View>
            )}

            {filteredTests.map((test) => {
              const isSelected = selectedAddons.some((a) => a.name === test.name);
              const basePrice = Number(test.price || test.mrp || 0);
              const discountedPrice = Math.round(basePrice * 0.70);
              const savings = basePrice - discountedPrice;

              return (
                <TouchableOpacity
                  key={test.name}
                  onPress={() => toggleAddon(test)}
                  activeOpacity={0.7}
                  style={[
                    styles.testCard,
                    {
                      borderColor: isSelected ? '#0284c7' : isDark ? '#334155' : '#e2e8f0',
                      backgroundColor: isSelected ? (isDark ? '#082f49' : '#f0f9ff') : isDark ? '#1e293b' : '#ffffff',
                    },
                  ]}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.testName, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                      {test.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.strikethroughPrice}>{formatINR(basePrice)}</Text>
                      <Text style={styles.discountedPrice}>{formatINR(discountedPrice)}</Text>
                      <View style={styles.offPill}>
                        <Text style={styles.offPillText}>30% OFF</Text>
                      </View>
                    </View>
                    <Text style={styles.savingsText}>Save {formatINR(savings)} on this test</Text>
                  </View>

                  <View
                    style={[
                      styles.actionBtn,
                      isSelected ? styles.actionBtnSelected : styles.actionBtnUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionBtnText,
                        isSelected ? styles.actionBtnTextSelected : styles.actionBtnTextUnselected,
                      ]}
                    >
                      {isSelected ? '✓ Added' : '+ Add'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Sticky Bottom Bar */}
          <View style={[styles.bottomBar, { borderTopColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.packageTotalLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {packageData.name} ({planType === 'single' ? 'Single' : 'Couple'})
                </Text>
                {selectedAddons.length > 0 && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981' }}>
                    + {selectedAddons.length} Add-on{selectedAddons.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <Text style={[styles.finalTotalText, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  {formatINR(finalTotalPrice)}
                </Text>
                {totalAddonsSavings > 0 && (
                  <Text style={styles.totalSavingsPill}>
                    🎉 Saved {formatINR(totalAddonsSavings)} (30% OFF)
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              onPress={() => onConfirm(packageData, planType, finalTotalPrice, selectedAddons)}
              style={styles.confirmBtn}
            >
              <Text style={styles.confirmBtnText}>Proceed to Book →</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  headerBanner: {
    backgroundColor: '#0A2540',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  promoPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  promoPillText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  planSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  planOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  planOptionActive: {
    backgroundColor: '#0284c7',
  },
  planOptionActiveCouple: {
    backgroundColor: '#059669',
  },
  planOptionInactive: {
    backgroundColor: 'transparent',
  },
  planOptionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planOptionTextActive: {
    color: '#ffffff',
  },
  planOptionTextInactive: {
    color: '#94a3b8',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  categoryScroll: {
    gap: 6,
    paddingBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  categoryChipInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  categoryChipTextInactive: {
    color: '#475569',
  },
  testsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  specialAddonBanner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  specialAddonTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  specialAddonName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065f46',
    marginTop: 2,
  },
  specialAddonDesc: {
    fontSize: 11,
    color: '#047857',
  },
  testCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  testName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  strikethroughPrice: {
    fontSize: 11,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  offPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  offPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  savingsText: {
    fontSize: 10,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnSelected: {
    backgroundColor: '#0284c7',
  },
  actionBtnUnselected: {
    backgroundColor: '#e2e8f0',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnTextSelected: {
    color: '#ffffff',
  },
  actionBtnTextUnselected: {
    color: '#1e293b',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#ffffff',
  },
  packageTotalLabel: {
    fontSize: 11,
  },
  finalTotalText: {
    fontSize: 19,
    fontWeight: '900',
  },
  totalSavingsPill: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  confirmBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
