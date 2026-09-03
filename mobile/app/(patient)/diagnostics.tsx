import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { Header } from '../../src/components/ui/Header';
import { TestCard, LabTestData } from '../../src/components/ui/TestCard';
import { Pill } from '../../src/components/ui/Pill';
import { Button } from '../../src/components/ui/Button';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { api } from '../../src/services/api';
import FIXED_PRICES from '../../src/data/lab-test-prices.json';

type CategoryFilter = 'all' | 'blood' | 'imaging' | 'special';

export default function DiagnosticsMarketplaceScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [apiTests, setApiTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Search API or local fallback
  const fetchMarketplaceTests = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/marketplace/tests/search?q=${encodeURIComponent(query)}`);
      if (res.data && Array.isArray(res.data.tests)) {
        setApiTests(res.data.tests);
      } else {
        setApiTests([]);
      }
    } catch {
      // Offline / local fallback to FIXED_PRICES
      setApiTests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketplaceTests(searchQuery);
  }, [searchQuery, fetchMarketplaceTests]);

  // Combine API results with local fixed prices catalogue
  const allTests = useMemo(() => {
    if (apiTests.length > 0) {
      return apiTests.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category === 'imaging' ? 'Imaging & Radiology' : 'Pathology & Blood',
        mrp: t.mrp || Math.round(t.price * 1.6),
        price: t.price || 499,
        home_available: t.category !== 'imaging',
        typical_turnaround_hours: t.typical_turnaround_hours || 24,
        preparation: t.preparation,
      }));
    }

    // Local fallback
    const q = searchQuery.toLowerCase().trim();
    const local = FIXED_PRICES as LabTestData[];
    return local.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [apiTests, searchQuery]);

  const filteredTests = useMemo(() => {
    if (activeCategory === 'blood') {
      return allTests.filter((t) => t.home_available !== false);
    }
    if (activeCategory === 'imaging') {
      return allTests.filter((t) => t.home_available === false || t.name.toLowerCase().includes('x-ray') || t.name.toLowerCase().includes('mri') || t.name.toLowerCase().includes('ct') || t.name.toLowerCase().includes('ultrasound') || t.name.toLowerCase().includes('ecg'));
    }
    return allTests;
  }, [allTests, activeCategory]);

  const handleBook = (test: LabTestData) => {
    router.push({
      pathname: '/booking/new',
      params: {
        test_id: test.id || '',
        test_name: test.name,
        service_type: test.home_available !== false ? 'lab_test' : 'imaging',
        price: test.price,
        mrp: test.mrp,
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Diagnostics Marketplace"
        subtitle="Two-Model Booking: Partner-Blind Blood Tests + Verified Imaging Centres"
        showBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={styles.searchIcon}>🔬</Text>
          <TextInput
            placeholder="Search 400+ NABL Blood Tests, MRI, CT Scan, Ultrasound..."
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

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <TouchableOpacity
            onPress={() => setActiveCategory('all')}
            style={[
              styles.catPill,
              {
                backgroundColor: activeCategory === 'all' ? themeColors.primary.DEFAULT : themeColors.card,
                borderColor: activeCategory === 'all' ? themeColors.primary.DEFAULT : themeColors.border,
              },
            ]}
          >
            <Text style={[styles.catText, { color: activeCategory === 'all' ? '#fff' : themeColors.textPrimary }]}>
              All Tests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveCategory('blood')}
            style={[
              styles.catPill,
              {
                backgroundColor: activeCategory === 'blood' ? themeColors.primary.DEFAULT : themeColors.card,
                borderColor: activeCategory === 'blood' ? themeColors.primary.DEFAULT : themeColors.border,
              },
            ]}
          >
            <Text style={[styles.catText, { color: activeCategory === 'blood' ? '#fff' : themeColors.textPrimary }]}>
              🩸 Blood & Pathology (Home Collection)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveCategory('imaging')}
            style={[
              styles.catPill,
              {
                backgroundColor: activeCategory === 'imaging' ? themeColors.primary.DEFAULT : themeColors.card,
                borderColor: activeCategory === 'imaging' ? themeColors.primary.DEFAULT : themeColors.border,
              },
            ]}
          >
            <Text style={[styles.catText, { color: activeCategory === 'imaging' ? '#fff' : themeColors.textPrimary }]}>
              🩻 Imaging & Scans (Walk-in Verified)
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Model Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>NABL Accredited Quality Protocol</Text>
            <Text style={styles.infoText}>
              Cold-chain sample verification with geotagged barcodes & certified digital reports.
            </Text>
          </View>
        </View>

        {/* Test List */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={themeColors.primary.DEFAULT} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Searching marketplace tests...
            </Text>
          </View>
        ) : filteredTests.length > 0 ? (
          <View style={styles.listSection}>
            <View style={styles.resultsCountRow}>
              <Text style={[styles.resultsCount, { color: themeColors.textSecondary }]}>
                Showing {filteredTests.length} verified diagnostic test(s)
              </Text>
            </View>

            {filteredTests.slice(0, 50).map((test, idx) => (
              <TestCard
                key={test.id || idx}
                testData={test}
                onBook={handleBook}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              No diagnostic tests matched &quot;{searchQuery}&quot;
            </Text>
            <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
              Search for routine tests like Thyroid (TSH), Vitamin D, or Lipid Profile.
            </Text>
          </View>
        )}
      </ScrollView>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.body,
    padding: 0,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: spacing.pillRadius,
    borderWidth: 1,
    marginRight: 8,
  },
  catText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  infoTitle: {
    fontSize: typography.fontSize.caption,
    fontWeight: '800',
    color: '#0369a1',
  },
  infoText: {
    fontSize: typography.fontSize.tiny,
    color: '#1e40af',
    marginTop: 2,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.caption,
    marginTop: 8,
  },
  listSection: {
    marginBottom: spacing.lg,
  },
  resultsCountRow: {
    marginBottom: spacing.sm,
  },
  resultsCount: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
  },
  emptyBox: {
    padding: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: typography.fontSize.caption,
    marginTop: 4,
    textAlign: 'center',
  },
});
