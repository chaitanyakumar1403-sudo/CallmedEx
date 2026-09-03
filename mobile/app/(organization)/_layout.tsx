import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

export default function OrgTabsLayout() {
  const { themeColors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: themeColors.textMuted,
        tabBarStyle: {
          backgroundColor: isDark ? themeColors.bottomTabBackground : '#0A2540',
          borderTopColor: themeColors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Organization KPIs',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏥</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Org Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏢</Text>,
        }}
      />
    </Tabs>
  );
}
