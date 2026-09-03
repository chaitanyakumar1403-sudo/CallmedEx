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
import { PackageCard } from '../../src/components/ui/PackageCard';
import { TestCard } from '../../src/components/ui/TestCard';
import { DoctorCard } from '../../src/components/ui/DoctorCard';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

import healthPackagesData from '../../src/data/health-packages.json';
import labTestsData from '../../src/data/lab-test-prices.json';

export default function UniversalSearchScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const [query, setQuery] = useState('');

  const packages = healthPackagesData as any[];
  const labTests = labTestsData as any[];

  const matchedPackages = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return packages.filter((p) => p.name.toLowerCase().includes(q) || p.tests.toLowerCase().includes(q)).slice(0, 5);
  }, [query, packages]);

  const matchedTests = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return labTests.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query, labTests]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Header
        title="Universal Search"
        subtitle="Search all CallMedex healthcare services"
        showBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.searchBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Search packages, blood tests, doctors, scans..."
            placeholderTextColor={themeColors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={{ color: themeColors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {query.trim().length === 0 ? (
          <View style={styles.suggestionsBox}>
            <Text style={[styles.suggestHeading, { color: themeColors.textSecondary }]}>
              POPULAR HEALTH SEARCHES
            </Text>
            <View style={styles.tagWrap}>
              {['Complete Blood Count', 'Diabetes HBA1C', 'Full Body Checkup', 'Thyroid Profile', 'Vitamin D3', 'Lipid Profile', 'Senior Citizen Care'].map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => setQuery(tag)}
                  style={[styles.tagPill, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                >
                  <Text style={[styles.tagText, { color: themeColors.textPrimary }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View>
            {/* Packages */}
            {matchedPackages.length > 0 && (
              <View style={styles.resultGroup}>
                <Text style={[styles.groupTitle, { color: themeColors.textPrimary }]}>
                  Health Packages ({matchedPackages.length})
                </Text>
                {matchedPackages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    packageData={pkg}
                    onBook={() => {
                      router.push({
                        pathname: '/booking/new',
                        params: {
                          package_id: pkg.id,
                          package_name: pkg.name,
                          price: pkg.price,
                          mrp: pkg.mrp,
                        },
                      });
                    }}
                  />
                ))}
              </View>
            )}

            {/* Individual Tests */}
            {matchedTests.length > 0 && (
              <View style={styles.resultGroup}>
                <Text style={[styles.groupTitle, { color: themeColors.textPrimary }]}>
                  Diagnostic Tests ({matchedTests.length})
                </Text>
                {matchedTests.map((t, idx) => (
                  <TestCard
                    key={idx}
                    testData={t}
                    onBook={() => {
                      router.push({
                        pathname: '/booking/new',
                        params: {
                          test_name: t.name,
                          price: t.price,
                          mrp: t.mrp,
                        },
                      });
                    }}
                  />
                ))}
              </View>
            )}

            {matchedPackages.length === 0 && matchedTests.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                  No direct matches for &quot;{query}&quot;
                </Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                  Try general terms like &quot;Blood Test&quot; or &quot;Screening&quot;.
                </Text>
              </View>
            )}
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
    marginBottom: spacing.lg,
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
  suggestionsBox: {
    paddingTop: spacing.sm,
  },
  suggestHeading: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: spacing.pillRadius,
    borderWidth: 1,
  },
  tagText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
  },
  resultGroup: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    fontSize: typography.fontSize.bodyLarge,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  emptyState: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: typography.fontSize.caption,
    marginTop: 4,
    textAlign: 'center',
  },
});
