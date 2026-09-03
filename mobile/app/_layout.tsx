import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { OfflineProvider } from '../src/context/OfflineContext';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';

import { GlassProvider } from '../src/theme/GlassProvider';

const ALL_ROLE_GROUPS = [
  '(patient)',
  '(doctor)',
  '(phlebotomist)',
  '(organization)',
  '(pharmacy)',
  '(nurse)',
  '(staff)',
  '(admin)',
  '(processing-center)',
  '(supervisor)',
];

function getRoleDashboard(userRole: string): any {
  switch (userRole) {
    case 'patient':
      return '/(patient)/home';
    case 'doctor':
      return '/(doctor)/dashboard';
    case 'phlebotomist':
      return '/(phlebotomist)/tasks';
    case 'organization':
      return '/(organization)/dashboard';
    case 'pharmacy':
      return '/(pharmacy)/queue';
    case 'nurse':
      return '/(nurse)/visits';
    case 'staff':
      return '/(staff)/intake';
    case 'admin':
      return '/(admin)/dashboard';
    case 'processingCenter':
      return '/(processing-center)/queue';
    case 'supervisor':
      return '/(supervisor)/radar';
    default:
      return '/(patient)/home';
  }
}

function RootNavigation() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string | undefined;
    const inAuthGroup = firstSegment === '(auth)';

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (isAuthenticated && role) {
      const targetGroup = role === 'processingCenter' ? '(processing-center)' : `(${role})`;
      const targetDashboard = getRoleDashboard(role);

      if (inAuthGroup) {
        router.replace(targetDashboard);
      } else if (firstSegment && ALL_ROLE_GROUPS.includes(firstSegment)) {
        // Enforce strict role boundary: if accessing a different role's group, block and redirect
        if (firstSegment !== targetGroup) {
          router.replace(targetDashboard);
        }
      } else if (!firstSegment || firstSegment === 'index') {
        router.replace(targetDashboard);
      }
    }
  }, [isAuthenticated, role, isLoading, segments]);

  if (isLoading) {
    return <LoadingScreen message="Initializing CallMedex Secure Session..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(patient)" options={{ headerShown: false }} />
      <Stack.Screen name="(doctor)" options={{ headerShown: false }} />
      <Stack.Screen name="(phlebotomist)" options={{ headerShown: false }} />
      <Stack.Screen name="(organization)" options={{ headerShown: false }} />
      <Stack.Screen name="(pharmacy)" options={{ headerShown: false }} />
      <Stack.Screen name="(nurse)" options={{ headerShown: false }} />
      <Stack.Screen name="(staff)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(processing-center)" options={{ headerShown: false }} />
      <Stack.Screen name="(supervisor)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <OfflineProvider>
            <GlassProvider>
              <RootNavigation />
            </GlassProvider>
          </OfflineProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

