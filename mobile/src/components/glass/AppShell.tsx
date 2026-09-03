// mobile/src/components/glass/AppShell.tsx
// Universal shell wrapper for all CallMedex Liquid Health screens.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §3.11

import React, { ReactNode } from 'react';
import { View, StyleSheet, StatusBar, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackdrop } from './AuroraBackdrop';

export interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
  floatingOmnibar?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollable?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  header,
  floatingOmnibar,
  style,
  contentContainerStyle,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <AuroraBackdrop>
      <StatusBar barStyle="light-content" backgroundColor="#070d18" translucent />
      <SafeAreaView style={[styles.safeArea, style]} edges={['top', 'left', 'right']}>
        {header && <View style={styles.headerContainer}>{header}</View>}
        <View style={[styles.content, { paddingBottom: insets.bottom + 80 }, contentContainerStyle]}>
          {children}
        </View>
        {floatingOmnibar && (
          <View style={[styles.omnibarWrapper, { bottom: insets.bottom + 12 }]}>
            {floatingOmnibar}
          </View>
        )}
      </SafeAreaView>
    </AuroraBackdrop>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  omnibarWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
  },
});
