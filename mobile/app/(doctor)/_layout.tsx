import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

export default function DoctorTabsLayout() {
  const { themeColors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00D4B2',
        tabBarInactiveTintColor: themeColors.textMuted,
        tabBarStyle: {
          backgroundColor: isDark ? themeColors.bottomTabBackground : '#0A2540',
          borderTopColor: themeColors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'OPD Queue',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="consultations"
        options={{
          title: 'Teleconsult',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🎥</Text>,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: 'EHR / Patients',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Doctor Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🩺</Text>,
        }}
      />
    </Tabs>
  );
}
