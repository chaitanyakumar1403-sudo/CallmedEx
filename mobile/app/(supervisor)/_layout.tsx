import React from 'react';
import { Tabs } from 'expo-router';
import { Radar, AlertTriangle, Flame } from 'lucide-react-native';

export default function SupervisorTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#475569',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#070d18',
          borderTopColor: 'rgba(255,255,255,0.08)',
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
        name="radar"
        options={{
          title: 'Field Radar',
          tabBarIcon: ({ color, size }) => <Radar size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sla"
        options={{
          title: 'SLA Monitor',
          tabBarIcon: ({ color, size }) => <AlertTriangle size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="heatmap"
        options={{
          title: 'Heat Map',
          tabBarIcon: ({ color, size }) => <Flame size={size || 20} color={color} />,
        }}
      />
    </Tabs>
  );
}
