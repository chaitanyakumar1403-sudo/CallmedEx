// mobile/src/components/glass/GlassTabBar.tsx
// Floating G2 chrome bottom tab bar with fluid active indicator & haptics.
// Sourced from CALLMEDEX-LIQUID-HEALTH.md §3.12

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Glass } from './Glass';
import { useGlass } from '../../theme/GlassProvider';

export const GlassTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { roleAccent } = useGlass();

  return (
    <View style={[styles.outerContainer, { bottom: Math.max(insets.bottom, 12) }]}>
      <Glass tier="G2" style={styles.tabBarGlass} specular>
        <View style={styles.tabsRow}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const IconComponent = options.tabBarIcon;

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={[
                  styles.tabItem,
                  isFocused && {
                    backgroundColor: `${roleAccent.primary}22`,
                  },
                ]}
              >
                {IconComponent && (
                  <View style={styles.iconWrapper}>
                    {IconComponent({
                      focused: isFocused,
                      color: isFocused ? roleAccent.primary : '#94a3b8',
                      size: 22,
                    })}
                  </View>
                )}
                {typeof label === 'string' && (
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isFocused ? roleAccent.primary : '#94a3b8' },
                      isFocused && styles.tabLabelFocused,
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Glass>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 40,
  },
  tabBarGlass: {
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 18,
    marginHorizontal: 2,
  },
  iconWrapper: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  tabLabelFocused: {
    fontWeight: '700',
  },
});
