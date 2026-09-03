import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { PackageCard, HealthPackageData } from '../../src/components/ui/PackageCard';
import { PackageAddonModal, SelectedMobileAddon } from '../../src/components/widgets/PackageAddonModal';
import { Pill } from '../../src/components/ui/Pill';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

import healthPackagesData from '../../src/data/health-packages.json';

export default function HealthPackagesScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPkgForAddon, setSelectedPkgForAddon] = useState<HealthPackageData | null>(null);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);

  const packages = healthPackagesData as HealthPackageData[];

  // Filter packages based on query
  const filteredPackages = useMemo(() => {
    if (!searchQuery.trim()) return packages;
    const q = searchQuery.toLowerCase().trim();
    return packages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tests.toLowerCase().includes(q)
    );
  }, [searchQuery, packages]);

  const handleBookPackage = (pkg: HealthPackageData, planType: 'single' | 'couple') => {
    const pkgPrice = planType === 'couple' && pkg.couple_price ? pkg.couple_price : pkg.single_price || pkg.price;
    router.push({
      pathname: '/booking/new',
      params: {
        package_id: pkg.id,
        package_name: planType === 'couple' ? `${pkg.name} (Couple Plan)` : pkg.name,
        service_type: 'health_package',
        plan_type: planType,
        price: pkgPrice,
        mrp: pkg.mrp,
        tests: pkg.tests,
      },
    });
  };

  const handleOpenAddons = (pkg: HealthPackageData) => {
    setSelectedPkgForAddon(pkg);
    setIsAddonModalOpen(true);
  };

  const handleConfirmAddonBooking = (
    pkg: HealthPackageData,
    planType: 'single' | 'couple',
    totalPrice: number,
    selectedAddons: SelectedMobileAddon[]
  ) => {
    setIsAddonModalOpen(false);
    router.push({
      pathname: '/booking/new',
      params: {
        package_id: pkg.id,
        package_name: planType === 'couple' ? `${pkg.name} (Couple Plan)` : pkg.name,
        service_type: 'health_package',
        plan_type: planType,
        price: totalPrice,
        mrp: pkg.mrp,
        tests: pkg.tests,
        addons: selectedAddons.length > 0 ? JSON.stringify(selectedAddons) : undefined,
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Health Packages"
        subtitle="Fixed CallMedex rates • Home collection included"
        showBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Search 15 health packages, CBC, diabetes..."
            placeholderTextColor={themeColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: themeColors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Attention-Grabbing 30% Add-On Promotion Banner */}
        <View style={[styles.addonPromoBanner, { backgroundColor: '#ecfdf5', borderColor: '#10b981' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 18, marginRight: 6 }}>🎁</Text>
            <Text style={styles.addonPromoTitle}>Special Package Add-On Offer</Text>
          </View>
          <Text style={styles.addonPromoSubtitle}>
            Book any health package and get a guaranteed <Text style={{ fontWeight: '800', color: '#047857' }}>Flat 30% OFF</Text> on any individual lab test or scan you add!
          </Text>
        </View>

        {/* Health Packages List */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              Available Packages ({filteredPackages.length})
            </Text>
            <Pill label="15 Curated Packages" variant="done" />
          </View>

          {filteredPackages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              packageData={pkg}
              onBook={handleBookPackage}
              onAddons={handleOpenAddons}
            />
          ))}
        </View>

        {/* Empty state when no matches found */}
        {filteredPackages.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📦</Text>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              No packages found for &quot;{searchQuery}&quot;
            </Text>
            <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
              Try searching for &quot;Screening&quot;, &quot;Diabetic&quot;, or &quot;Fever&quot;.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* In-Screen 30% Add-On Test Modal */}
      <PackageAddonModal
        packageData={selectedPkgForAddon}
        isOpen={isAddonModalOpen}
        onClose={() => setIsAddonModalOpen(false)}
        onConfirm={handleConfirmAddonBooking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.xxl,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  addonPromoBanner: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: spacing.md,
  },
  addonPromoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065f46',
  },
  addonPromoSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#047857',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
  },
});
