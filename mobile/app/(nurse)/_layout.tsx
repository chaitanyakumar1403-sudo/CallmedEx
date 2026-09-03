import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

export default function NurseTabsLayout() {
  const { themeColors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10B981',
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
        name="visits"
        options={{
          title: 'Home Care',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👩‍⚕️</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Nurse Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
