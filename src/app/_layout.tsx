import '../global.css';

import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AuthProvider, { useAuth } from '@/components/auth/AuthProvider';
import OnboardingOverlay from '@/components/OnboardingOverlay';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

// Friend events open the Freunde tab; post events (new place, comment, save)
// open the feed.
function routeForEvent(event: unknown): '/friends' | '/activities' {
  return event === 'friend_request' || event === 'friend_accept' ? '/friends' : '/activities';
}

function RootNavigator() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  // Route to the relevant screen when a push notification is tapped, both for
  // in-session taps and for a cold start launched by a notification.
  useEffect(() => {
    if (loading) return;

    const handle = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as { event?: string } | undefined;
      if (data?.event) router.push(routeForEvent(data.event));
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handle(response);
        // Clear it so a later normal launch doesn't re-navigate.
        Notifications.clearLastNotificationResponseAsync();
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [loading]);

  if (loading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator />
            <OnboardingOverlay />
            <StatusBar style="dark" />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
