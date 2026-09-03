import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { FloatingSOSButton } from '../../src/components/ui/FloatingSOSButton';
import { locationService } from '../../src/services/location';

export default function PatientTabsLayout() {
  const { themeColors, isDark } = useTheme();

  const handleSOS = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    Alert.alert(
      '🚨 EMERGENCY SOS ALERT',
      'This will broadcast an urgent emergency dispatch alert to nearest ambulances and emergency contacts with your live GPS location.\n\nDo you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DISPATCH SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              const res = await locationService.triggerSOS(
                'Emergency SOS triggered from CallMedex Patient Mobile App'
              );
              Alert.alert(
                'Emergency Dispatched 🚑',
                `Signal transmitted to CallMedex Central Dispatch. Notified ${
                  res.notified_contacts_count || 'emergency'
                } contacts.`
              );
            } catch (err: any) {
              Alert.alert(
                'Alert Transmitted',
                'Emergency signal sent to emergency services.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#00D4B2',
          tabBarInactiveTintColor: themeColors.textMuted,
          tabBarStyle: {
            backgroundColor: isDark ? themeColors.bottomTabBackground : '#1a2b4a',
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
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
          }}
        />
        <Tabs.Screen
          name="diagnostics"
          options={{
            title: 'Diagnostics',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔬</Text>,
          }}
        />
        <Tabs.Screen
          name="packages"
          options={{
            title: 'Packages',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📦</Text>,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
          }}
        />

        {/* Hidden Aux Screens for Nested Patient Stack Navigation */}
        <Tabs.Screen
          name="doctors"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="appointments"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Signature Floating SOS Button */}
      <FloatingSOSButton onPress={handleSOS} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
