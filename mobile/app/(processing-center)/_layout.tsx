import React from 'react';
import { Tabs } from 'expo-router';
import { TestTube, CheckSquare, Layers, Users } from 'lucide-react-native';

export default function ProcessingCenterTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#059669',
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
        name="queue"
        options={{
          title: 'Queue',
          tabBarIcon: ({ color, size }) => <TestTube size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="intake"
        options={{
          title: '5-Pt Intake',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="batches"
        options={{
          title: 'Batches',
          tabBarIcon: ({ color, size }) => <Layers size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: 'Roster',
          tabBarIcon: ({ color, size }) => <Users size={size || 20} color={color} />,
        }}
      />
    </Tabs>
  );
}
